import SwiftUI
import UserNotifications

@MainActor final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    private var pendingPush: [AnyHashable:Any]?
    weak var store: RemoteStore? {
        didSet {
            if let payload = pendingPush, let store {
                pendingPush = nil
                store.receivePush(payload)
            }
        }
    }
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey:Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) { store?.registered(token:token) }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) { store?.registrationFailed(error) }
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completion: @escaping (UNNotificationPresentationOptions)->Void) {
        let data = notification.request.content.userInfo["dsh"] as? [String:Any]
        let kind = NotificationKind(rawValue:data?["kind"] as? String ?? "") ?? .info
        completion(Preferences.load().enabled(kind) ? [.banner,.list,.sound] : [])
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completion: @escaping ()->Void) {
        let payload = response.notification.request.content.userInfo
        if let store { store.receivePush(payload) } else { pendingPush = payload }
        completion()
    }
}
@main struct DSHRemoteApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var store = RemoteStore()
    @Environment(\.scenePhase) private var phase
    var body: some Scene {
        WindowGroup {
            RootView().environmentObject(store)
                .onAppear { delegate.store = store; store.setActive(phase == .active) }
                .onChange(of:phase) { store.setActive($0 == .active) }
        }
    }
}