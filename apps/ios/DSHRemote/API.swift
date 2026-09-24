import Foundation
import Security

final class NoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
final class RemoteAPI {
    private let delegate = NoRedirect()
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 35
        config.timeoutIntervalForResource = 40
        config.urlCache = nil
        return URLSession(configuration: config, delegate: delegate, delegateQueue: nil)
    }()
    func call<T: Decodable>(_ connection: Connection, path: String, query: [URLQueryItem] = [], body: [String: Any]? = nil) async throws -> T {
        var parts = URLComponents(url: connection.base.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { parts.queryItems = query }
        var request = URLRequest(url: parts.url!)
        request.setValue("DSH-Remote-iPad/0.2", forHTTPHeaderField: "User-Agent")
        if !connection.device.isEmpty { request.setValue(connection.device, forHTTPHeaderField: "x-dsh-remote-device") }
        if let body {
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw RemoteError.message("无法读取电脑响应。") }
        guard http.statusCode == 200 else { throw RemoteError.status(http.statusCode) }
        guard data.count <= 2 * 1024 * 1024 else { throw RemoteError.message("电脑返回的内容过大。") }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
enum CredentialStore {
    private static var query: [String: Any] { [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: Bundle.main.bundleIdentifier ?? "com.dsh.remote",
        kSecAttrAccount as String: "paired-desktop"
    ] }
    static func load() -> Connection? {
        var search = query; search[kSecReturnData as String] = true; search[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(search as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(Connection.self, from: data)
    }
    static func save(_ connection: Connection) throws {
        let data = try JSONEncoder().encode(connection)
        let attributes: [String: Any] = [kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let updated = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updated == errSecItemNotFound {
            var item = query; attributes.forEach { item[$0.key] = $0.value }
            guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { throw RemoteError.message("无法安全保存配对凭据。") }
        } else if updated != errSecSuccess { throw RemoteError.message("无法更新配对凭据。") }
    }
    static func clear() { SecItemDelete(query as CFDictionary) }
}