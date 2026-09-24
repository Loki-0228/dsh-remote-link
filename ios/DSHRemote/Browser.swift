import SwiftUI
import WebKit

@MainActor final class BrowserSession: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate {
    let web: WKWebView
    @Published var error: String?
    @Published var loading = false
    private var current: Connection?
    override init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        config.defaultWebpagePreferences.preferredContentMode = .recommended
        web = WKWebView(frame: .zero, configuration: config)
        super.init()
        web.navigationDelegate = self; web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.scrollView.keyboardDismissMode = .interactive
        web.accessibilityIdentifier = "remoteWebView"
    }
    func connect(_ connection: Connection) {
        guard current != connection else { return }
        current = connection
        var parts = URLComponents(url: connection.base.appendingPathComponent("pair-app"), resolvingAgainstBaseURL: false)!
        parts.queryItems = [URLQueryItem(name: "device", value: connection.device)]
        web.load(URLRequest(url: parts.url!))
    }
    func loadRotationFixture() {
        guard ProcessInfo.processInfo.arguments.contains("--ui-testing") else { return }
        web.loadHTMLString("""
            <!doctype html><html lang="zh"><meta name="viewport" content="width=device-width,initial-scale=1">
            <style>body{font:20px system-ui;padding:24px}input{font:inherit;max-width:90%;padding:12px}</style>
            <h1>旋转测试页面</h1><p>测试数据：输入应在横竖屏切换后保留。</p>
            <label>测试输入 <input aria-label="测试输入" id="rotation-input"></label>
            </html>
            """, baseURL:nil)
    }
    func clear() { current = nil; web.stopLoading(); web.loadHTMLString("", baseURL: nil) }
    func retry() { guard let connection = current else { return }; current = nil; connect(connection) }
    private func allowed(_ url: URL) -> Bool {
        guard let base = current?.base else { return false }
        return url.scheme == base.scheme && url.host == base.host && url.port == base.port
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.absoluteString == "about:blank" || allowed(url) { decisionHandler(.allow); return }
        if navigationAction.navigationType == .linkActivated, ["https","http"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = navigationAction.request.url else { return nil }
        if allowed(url) { webView.load(navigationAction.request) }
        else if ["https","http"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
        return nil
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { loading = true; error = nil }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { loading = false }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { self.error = "远程页面未能加载。检查电脑和网络连接后重试。"; loading = false }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        self.error = "连接中断，可重试加载远程页面。"; loading = false
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { error = "系统回收了网页进程，点击重试恢复会话。"; loading = false }
}
struct RemoteBrowser: UIViewRepresentable {
    @ObservedObject var browser: BrowserSession
    func makeUIView(context: Context) -> WKWebView { browser.web }
    func updateUIView(_ view: WKWebView, context: Context) {}
}