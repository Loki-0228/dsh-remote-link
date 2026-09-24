import SwiftUI
import UserNotifications

enum Destination: String, CaseIterable, Identifiable {
    case connection, sessions, inbox, settings
    var id: String { rawValue }
    var title: String {
        switch self { case .connection: return "连接电脑"; case .sessions: return "远程会话"; case .inbox: return "通知与审批"; case .settings: return "通知设置" }
    }
    var symbol: String {
        switch self { case .connection: return "desktopcomputer"; case .sessions: return "bubble.left.and.bubble.right"; case .inbox: return "tray"; case .settings: return "bell.badge" }
    }
}
@MainActor final class RemoteStore: ObservableObject {
    @Published var connection = CredentialStore.load()
    @Published var selection: Destination? = .connection
    @Published var events: [RemoteEvent] = []
    @Published var pending: [RemoteEvent] = []
    @Published var selectedEvent: RemoteEvent?
    @Published var preferences = Preferences.load()
    @Published var status = "尚未连接"
    @Published var pushStatus = "尚未注册后台推送"
    @Published var busy = false
    @Published var error: String?
    let browser = BrowserSession()
    private let api = RemoteAPI()
    private var polling: Task<Void, Never>?
    private var pushSync: Task<Void, Never>?
    private var active = false
    private var epoch = ""
    private var cursor = 0
    private var token: String?
    init() {
        if let connection { selection = .sessions; browser.connect(connection) }
        if ProcessInfo.processInfo.arguments.contains("--ui-testing") {
            connection = Connection(base:URL(string:"https://example.invalid")!,device:"ui-fixture"); selection = .inbox; status = "界面测试"
            browser.loadRotationFixture()
            events = [RemoteEvent(id:"ui-example",kind:"task-completed",title:"本轮已结束",body:"测试数据：报表已导出，共 120 行。",taskTitle:"导出季度报表",summary:"测试数据：报表已导出，共 120 行。")]
        }
    }
    var testing: Bool { ProcessInfo.processInfo.arguments.contains("--ui-testing") }
    func setActive(_ value: Bool) {
        active = value
        if value { startPolling(); synchronizePush() }
        else { polling?.cancel(); polling = nil }
    }
    func pair(base: URL, token: String) async {
        busy = true; defer { busy = false }
        do {
            let result: PairResponse = try await api.call(Connection(base:base,device:""), path:"api/pair/accept",body:["token":token])
            let next = Connection(base:base,device:result.deviceId)
            let snapshot: Snapshot = try await api.call(next,path:"api/remote-notifications/poll",query:[URLQueryItem(name:"wait",value:"0")])
            // Unregister the old push subscription before changing desktops.
            if let old = connection {
                let _: Receipt = try await api.call(old,path:"api/remote-notifications/push/unregister",body:[:])
            }
            try CredentialStore.save(next)
            polling?.cancel(); polling = nil
            connection = next; epoch = ""; cursor = 0; events = []; pending = []
            apply(snapshot); browser.connect(next); selection = .sessions; status = "已连接电脑"
            startPolling()
            await requestPushPermission()
        } catch { self.error = error.localizedDescription }
    }
    func disconnect() async {
        guard let connection else { return }
        busy = true; defer { busy = false }
        do {
            let _: Receipt = try await api.call(connection,path:"api/remote-notifications/push/unregister",body:[:])
            polling?.cancel(); polling = nil; pushSync?.cancel()
            CredentialStore.clear(); self.connection = nil
            browser.clear(); events = []; pending = []; epoch = ""; cursor = 0
            status = "已断开连接"; pushStatus = "后台推送已注销"; selection = .connection
        } catch { self.error = "无法注销电脑端推送。请连接电脑后重试，或在电脑「远程链接」中撤销此设备。" }
    }
    private func startPolling() {
        guard active, polling == nil, let connection, !testing else { return }
        polling = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled && self.connection == connection {
                do {
                    let snapshot: Snapshot = try await api.call(connection,path:"api/remote-notifications/poll",query:[
                        URLQueryItem(name:"epoch",value:epoch),URLQueryItem(name:"after",value:String(cursor))])
                    guard !Task.isCancelled, self.connection == connection else { return }
                    apply(snapshot); status = "已连接 · 正在接收通知"
                } catch {
                    if Task.isCancelled { return }
                    status = error.localizedDescription
                    if case RemoteError.status(let code) = error, [401,403].contains(code) {
                        pending = []; polling = nil; return
                    }
                    try? await Task.sleep(nanoseconds:3_000_000_000)
                }
            }
        }
    }
    private func apply(_ snapshot: Snapshot) {
        epoch = snapshot.epoch; cursor = snapshot.cursor; pending = snapshot.pending
        if snapshot.reset { events = [] }
        for event in snapshot.events where !events.contains(where:{$0.id == event.id}) { events.insert(event,at:0) }
        events = Array(events.prefix(200))
        let valid = Set(pending.map(\.id))
        UNUserNotificationCenter.current().getDeliveredNotifications { delivered in
            let stale = delivered.compactMap { item -> String? in
                let event = item.request.content.userInfo["dsh"] as? [String:Any]
                guard let request = event?["requestId"] as? String, !request.isEmpty, !valid.contains(request) else { return nil }
                return item.request.identifier
            }
            UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers:stale)
        }
    }
    func refresh() async {
        guard let connection else { return }
        do {
            let snapshot: Snapshot = try await api.call(connection,path:"api/remote-notifications/poll",query:[
                URLQueryItem(name:"epoch",value:epoch),URLQueryItem(name:"after",value:String(cursor)),URLQueryItem(name:"wait",value:"0")])
            apply(snapshot)
        } catch { self.error = error.localizedDescription }
    }
    func respond(_ request: RemoteEvent, value: String) async {
        guard let connection else { return }
        busy = true; defer { busy = false }
        do {
            let _: Receipt = try await api.call(connection,path:"api/remote-notifications/respond",body:["id":request.id,"value":value])
            selectedEvent = nil
            await refresh()
        } catch { self.error = error.localizedDescription; await refresh() }
    }
    func requestPushPermission() async {
        guard !testing else { return }
        do {
            let allowed = try await UNUserNotificationCenter.current().requestAuthorization(options:[.alert,.badge,.sound])
            if allowed { UIApplication.shared.registerForRemoteNotifications() }
            else { pushStatus = "系统通知权限已关闭，可在系统设置中开启" }
        } catch { pushStatus = "无法申请系统通知权限" }
    }
    func registered(token data: Data) {
        token = data.map { String(format:"%02x",$0) }.joined()
        synchronizePush()
    }
    func registrationFailed(_ error: Error) {
        pushStatus = "APNs 注册失败。确认侧载签名和描述文件包含此 Bundle ID 的推送权限。"
    }
    func preferencesChanged() { preferences.save(); synchronizePush() }
    func synchronizePush() {
        guard !testing, let connection else { return }
        pushSync?.cancel()
        pushSync = Task { [weak self] in
            guard let self else { return }
            try? await Task.sleep(nanoseconds:250_000_000)
            guard !Task.isCancelled else { return }
            do {
                if !preferences.backgroundPush {
                    let _: Receipt = try await api.call(connection,path:"api/remote-notifications/push/unregister",body:[:])
                    pushStatus = "后台推送已关闭"; return
                }
                let state: PushStatus
                if let token {
                    state = try await api.call(connection,path:"api/remote-notifications/push/register",body:[
                        "token":token,"environment":preferences.environment,"topic":Bundle.main.bundleIdentifier ?? "",
                        "disabled":Array(preferences.disabled),"brief":preferences.brief,"previewContent":preferences.previewContent])
                } else {
                    state = try await api.call(connection,path:"api/remote-notifications/push/status")
                    let settings = await UNUserNotificationCenter.current().notificationSettings()
                    if [.authorized,.provisional,.ephemeral].contains(settings.authorizationStatus) { UIApplication.shared.registerForRemoteNotifications() }
                }
                guard !Task.isCancelled else { return }
                pushStatus = state.configured
                    ? ((state.registered ?? false) && token != nil ? "已注册 APNs 后台推送" : "电脑推送已配置，等待 iPad 注册")
                    : "电脑 APNs 待配置：需要 Team ID、Key ID 和 .p8 密钥"
            } catch { if !Task.isCancelled { pushStatus = error.localizedDescription } }
        }
    }
    func receivePush(_ payload: [AnyHashable:Any]) {
        guard let raw = payload["dsh"], let data = try? JSONSerialization.data(withJSONObject:raw),
              let event = try? JSONDecoder().decode(RemoteEvent.self,from:data) else { return }
        selection = .inbox
        if !events.contains(where:{$0.id == event.id}) { events.insert(event,at:0) }
        Task {
            await refresh()
            selectedEvent = pending.first(where:{$0.id == event.requestId}) ?? events.first(where:{$0.id == event.id}) ?? event
        }
    }
}