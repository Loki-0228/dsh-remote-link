import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: RemoteStore
    var body: some View {
        NavigationSplitView {
            List(selection:$store.selection) {
                ForEach(Destination.allCases) { destination in
                    NavigationLink(value:destination) {
                        Label(destination.title,systemImage:destination.symbol)
                    }.accessibilityIdentifier("nav-\(destination.rawValue)")
                }
                Section {
                    Label(store.status,systemImage:store.connection == nil ? "circle" : "network")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }.navigationTitle("DSH Remote").navigationSplitViewColumnWidth(min:220,ideal:260,max:320)
        } detail: {
            NavigationStack {
                Group {
                    switch store.selection ?? .connection {
                    case .connection: ConnectionView()
                    case .sessions: SessionView(browser:store.browser)
                    case .inbox: InboxView()
                    case .settings: NotificationSettingsView()
                    }
                }.navigationTitle((store.selection ?? .connection).title)
                    .navigationBarTitleDisplayMode(.inline)
            }
        }
        .sheet(item:$store.selectedEvent) { EventDetail(event:$0).environmentObject(store) }
        .alert("无法完成操作",isPresented:Binding(get:{store.error != nil},set:{if !$0 {store.error = nil}})) {
            Button("知道了",role:.cancel) {store.error = nil}
        } message: {Text(store.error ?? "")}
    }
}
struct ConnectionView: View {
    @EnvironmentObject private var store: RemoteStore
    @State private var link = ""
    @State private var insecure: (URL,String)?
    @State private var showHTTP = false
    var body: some View {
        Form {
            if let connection = store.connection {
                Section("当前电脑") {
                    LabeledContent("地址",value:connection.base.absoluteString)
                    Text(store.status)
                    Button("打开远程会话") {store.selection = .sessions}
                    Button("断开配对",role:.destructive) {Task {await store.disconnect()}}.disabled(store.busy)
                }
            }
            Section {
                TextField("粘贴完整配对链接",text:$link,axis:.vertical)
                    .textInputAutocapitalization(.never).autocorrectionDisabled().keyboardType(.URL)
                    .accessibilityIdentifier("pair-link")
                PasteButton(payloadType:String.self) {values in if let first = values.first {link = first}}
                Button {
                    do {
                        let (base,token) = try Connection.pairing(link)
                        if base.scheme == "http" {insecure = (base,token);showHTTP = true}
                        else {Task {await store.pair(base:base,token:token)}}
                    } catch {store.error = error.localizedDescription}
                } label: { if store.busy {ProgressView()} else {Text("配对电脑")} }
                    .disabled(store.busy || link.trimmingCharacters(in:.whitespacesAndNewlines).isEmpty)
                    .accessibilityIdentifier("pair-button")
            } header: {Text("连接电脑")} footer: {
                Text("在电脑「远程链接」生成配对链接后粘贴。外网访问时，先开启电脑端隧道。")
            }
            Section("后台通知") {
                Text(store.pushStatus).font(.callout)
                Text("电脑需保持运行。后台提醒通过 Apple 推送服务送达，须配置电脑端 APNs 并使用包含推送权限的签名。")
                    .font(.footnote).foregroundStyle(.secondary)
            }
        }.formStyle(.grouped)
        .confirmationDialog("此链接使用未加密的 HTTP",isPresented:$showHTTP,titleVisibility:.visible) {
            Button("在可信网络中连接") {if let (base,token) = insecure {Task {await store.pair(base:base,token:token)}}}
            Button("取消",role:.cancel) {}
        } message: {Text("HTTP 会明文传输设备凭据与会话内容。外网建议使用 HTTPS。")}
    }
}
struct SessionView: View {
    @EnvironmentObject private var store: RemoteStore
    @ObservedObject var browser: BrowserSession
    var body: some View {
        Group {
            if store.connection != nil {
                VStack(spacing:0) {
                    if browser.loading {ProgressView().progressViewStyle(.linear)}
                    if let error = browser.error {
                        HStack {Text(error).font(.callout);Spacer();Button("重试") {browser.retry()}}
                            .padding().background(.regularMaterial)
                    }
                    RemoteBrowser(browser:browser)
                }
                .toolbar {ToolbarItemGroup(placement:.navigationBarTrailing) {
                    Button {browser.web.goBack()} label:{Image(systemName:"chevron.backward")}.accessibilityLabel("网页后退")
                    Button {browser.retry()} label:{Image(systemName:"arrow.clockwise")}.accessibilityLabel("重新加载会话")
                }}
            } else {
                VStack(spacing:16) {
                    Image(systemName:"desktopcomputer").font(.largeTitle).foregroundStyle(.secondary)
                    Text("先连接电脑").font(.title2)
                    Text("配对后即可在 iPad 查看和操作远程会话。").foregroundStyle(.secondary)
                    Button("前往配对") {store.selection = .connection}.buttonStyle(.borderedProminent)
                }.padding()
            }
        }
    }
}
struct InboxView: View {
    @EnvironmentObject private var store: RemoteStore
    var body: some View {
        List {
            if !store.pending.isEmpty {
                Section("待处理") {
                    ForEach(store.pending) {event in
                        Button {store.selectedEvent = event} label:{EventRow(event:event,brief:false)}
                            .buttonStyle(.plain)
                    }
                }
            }
            Section("最近通知") {
                if store.events.isEmpty {
                    Text("暂时没有通知。任务开始、结束或需要你处理时会显示在这里。")
                        .foregroundStyle(.secondary).padding(.vertical)
                }
                ForEach(store.events) {event in
                    Button {store.selectedEvent = event} label:{EventRow(event:event,brief:store.preferences.brief)}
                        .buttonStyle(.plain)
                }
            }
        }.refreshable {await store.refresh()}
            .toolbar {Button {Task {await store.refresh()}} label:{Image(systemName:"arrow.clockwise")}.accessibilityLabel("刷新通知")}
    }
}
struct EventRow: View {
    let event: RemoteEvent
    let brief: Bool
    var body: some View {
        HStack(alignment:.top,spacing:12) {
            Image(systemName:event.category.symbol).foregroundStyle(.tint).frame(width:24).padding(.top,3)
            VStack(alignment:.leading,spacing:6) {
                Text(event.displayTitle).font(.headline)
                Text(event.text(brief:brief)).font(.subheadline).foregroundStyle(.secondary).lineLimit(brief ? 3 : 6)
                if let date = event.date {Text(date,style:.relative).font(.caption).foregroundStyle(.secondary)}
            }
        }.padding(.vertical,6)
    }
}
struct EventDetail: View {
    @EnvironmentObject private var store: RemoteStore
    @Environment(\.dismiss) private var dismiss
    let event: RemoteEvent
    @State private var confirm = false
    private var request: RemoteEvent? {store.pending.first {$0.id == event.id || $0.id == event.requestId}}
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment:.leading,spacing:20) {
                    Label(event.category.title,systemImage:event.category.symbol).foregroundStyle(.secondary)
                    Text(event.displayTitle).font(.title2).bold()
                    Text(event.text(brief:false)).textSelection(.enabled).frame(maxWidth:.infinity,alignment:.leading)
                    if let session = event.sessionId, !session.isEmpty {
                        LabeledContent("会话",value:session).font(.footnote).foregroundStyle(.secondary).textSelection(.enabled)
                    }
                    if let request, request.category == .approval {
                        HStack {
                            Button("允许本次") {confirm = true}.buttonStyle(.borderedProminent)
                            Button("拒绝",role:.destructive) {Task {await store.respond(request,value:"rejected")}}.buttonStyle(.bordered)
                        }.disabled(store.busy)
                    }
                    if event.category == .approval && request == nil {Text("该审批已处理或取消。").foregroundStyle(.secondary)}
                    Button(event.category == .question ? "打开远程会话回答" : "打开远程会话") {dismiss();store.selection = .sessions}
                        .buttonStyle(.bordered)
                }.padding(24).frame(maxWidth:760,alignment:.leading).frame(maxWidth:.infinity)
            }.navigationTitle("通知详情").navigationBarTitleDisplayMode(.inline)
                .toolbar {ToolbarItem(placement:.confirmationAction) {Button("完成") {dismiss()}}}
                .confirmationDialog("允许这项操作执行一次？",isPresented:$confirm,titleVisibility:.visible) {
                    if let request {Button("允许本次") {Task {await store.respond(request,value:"allowed-once")}}}
                    Button("取消",role:.cancel) {}
                }
        }.presentationDetents([.large])
    }
}
struct NotificationSettingsView: View {
    @EnvironmentObject private var store: RemoteStore
    var body: some View {
        Form {
            Section {
                ForEach(NotificationKind.allCases) {kind in
                    Toggle(kind.title,isOn:Binding(get:{store.preferences.enabled(kind)},set:{enabled in
                        if enabled {store.preferences.disabled.remove(kind.rawValue)} else {store.preferences.disabled.insert(kind.rawValue)}
                    })).accessibilityIdentifier("toggle-\(kind.rawValue)")
                }
            } header:{Text("接收哪些提醒")} footer:{Text("只影响这台 iPad 的提醒。关闭审批或提问提醒后，仍可在「通知与审批」查看待处理请求。")}
            Section("通知内容") {
                Toggle("简略通知",isOn:$store.preferences.brief)
                Toggle("推送中显示任务内容",isOn:$store.preferences.previewContent)
                Text("关闭内容预览后，后台通知只提示有新消息。声音、振动、锁屏预览和勿扰由系统通知设置管理。")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Section("后台推送") {
                Toggle("接收 APNs 后台推送",isOn:$store.preferences.backgroundPush)
                Text(store.pushStatus).font(.callout).accessibilityIdentifier("push-status")
                Button("申请通知权限并注册") {Task {await store.requestPushPermission()}}
                Button("打开系统通知设置") {
                    if let url = URL(string:UIApplication.openNotificationSettingsURLString) {UIApplication.shared.open(url)}
                }
            }
            Section {
                Picker("APNs 环境",selection:$store.preferences.environment) {
                    Text("正式环境").tag("production")
                    Text("开发环境").tag("development")
                }
                LabeledContent("Bundle ID",value:Bundle.main.bundleIdentifier ?? "未知").font(.footnote)
            } header:{Text("签名配置")} footer:{Text("APNs 环境必须与侧载描述文件中的 aps-environment 一致。普通侧载签名未必包含推送权限。修改后会重新注册。")}
        }.formStyle(.grouped).onChange(of:store.preferences) {_ in store.preferencesChanged()}
    }
}