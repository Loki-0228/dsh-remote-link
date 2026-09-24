import Foundation

struct Connection: Codable, Equatable {
    let base: URL
    let device: String
    static func pairing(_ text: String) throws -> (URL, String) {
        guard let parts = URLComponents(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
              ["http", "https"].contains(parts.scheme?.lowercased() ?? ""),
              parts.host != nil, parts.user == nil, parts.password == nil,
              let token = parts.queryItems?.first(where: { $0.name == "pair" })?.value, !token.isEmpty else {
            throw RemoteError.message("链接无效，请粘贴电脑「远程链接」生成的完整配对链接。")
        }
        if parts.scheme?.lowercased() == "http" {
            let host = (parts.host ?? "").lowercased()
            let octets = host.split(separator:".").compactMap {Int($0)}
            let localIPv4 = octets.count == 4 && octets.allSatisfy{(0...255).contains($0)} &&
                (octets[0] == 10 || octets[0] == 127 || (octets[0] == 192 && octets[1] == 168) ||
                 (octets[0] == 172 && (16...31).contains(octets[1])) || (octets[0] == 169 && octets[1] == 254))
            let localName = host == "localhost" || host.hasSuffix(".local")
            let localIPv6 = host == "[::1]" || host == "::1" || host.hasPrefix("[fe80:") || host.hasPrefix("[fd") || host.hasPrefix("[fc")
            guard localIPv4 || localName || localIPv6 else {throw RemoteError.message("外网配对请使用 HTTPS 链接。HTTP 仅用于局域网。")}
        }
        var origin = URLComponents()
        origin.scheme = parts.scheme?.lowercased(); origin.host = parts.host; origin.port = parts.port
        guard let url = origin.url else { throw RemoteError.message("无法识别电脑地址。") }
        return (url, token)
    }
}
enum RemoteError: LocalizedError {
    case status(Int), message(String)
    var errorDescription: String? {
        switch self {
        case .status(401), .status(403): return "设备授权已失效，请重新配对。"
        case .status(409): return "请求已处理或取消。"
        case .status(503): return "电脑尚未启用此功能，请更新并重启 DSH-Web。"
        case .status(let code): return "电脑返回错误（\(code)），请稍后重试。"
        case .message(let text): return text
        }
    }
}
enum NotificationKind: String, CaseIterable, Identifiable {
    case started = "task-started", completed = "task-completed", failed = "task-failed"
    case approval, question, info
    var id: String { rawValue }
    var title: String {
        switch self {
        case .started: return "任务开始"
        case .completed: return "本轮结束"
        case .failed: return "任务失败"
        case .approval: return "操作审批"
        case .question: return "需要回答的问题"
        case .info: return "其他插件消息"
        }
    }
    var symbol: String {
        switch self {
        case .started: return "play.circle"
        case .completed: return "checkmark.circle"
        case .failed: return "exclamationmark.triangle"
        case .approval: return "hand.raised"
        case .question: return "questionmark.circle"
        case .info: return "bell"
        }
    }
}
struct RemoteEvent: Codable, Identifiable, Equatable {
    let id: String
    var seq: Int?
    var time: Double?
    var kind: String?
    var title: String?
    var body: String?
    var source: String?
    var sessionId: String?
    var requestId: String?
    var taskTitle: String?
    var summary: String?
    var category: NotificationKind { NotificationKind(rawValue: kind ?? "") ?? .info }
    var displayTitle: String {
        if let task = taskTitle, !task.isEmpty { return "\(category.title) · \(task)" }
        if let title, !title.isEmpty { return title }
        return category.title
    }
    func text(brief: Bool) -> String {
        let value = brief && !(summary ?? "").isEmpty ? summary! : (body ?? "")
        if !value.isEmpty { return String(value.prefix(brief ? 160 : 4000)) }
        return category == .completed ? "本轮已结束。打开远程会话查看详情。" : "打开远程会话查看详情。"
    }
    var date: Date? { time.map { Date(timeIntervalSince1970: $0 / 1000) } }
}
struct Snapshot: Decodable {
    let epoch: String
    let cursor: Int
    let reset: Bool
    let events: [RemoteEvent]
    let pending: [RemoteEvent]
}
struct PairResponse: Decodable { let deviceId: String }
struct PushStatus: Decodable {
    var configured: Bool
    var registered: Bool?
    var topic: String?
    var error: String?
}
struct Receipt: Decodable { var ok: Bool? }

struct Preferences: Codable, Equatable {
    var disabled: Set<String> = []
    var brief = true
    var backgroundPush = true
    var environment = "production"
    var previewContent = true
    func enabled(_ kind: NotificationKind) -> Bool { !disabled.contains(kind.rawValue) }
    static func load() -> Preferences {
        guard let data = UserDefaults.standard.data(forKey: "notification-preferences"),
              let value = try? JSONDecoder().decode(Preferences.self, from: data) else { return Preferences() }
        return value
    }
    func save() { UserDefaults.standard.set(try? JSONEncoder().encode(self), forKey: "notification-preferences") }
}