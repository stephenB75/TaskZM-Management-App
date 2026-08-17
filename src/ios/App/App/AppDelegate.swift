import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    private let nativeBuildDefaultsKey = "TaskZMNativeBuildNumber"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        purgeWebViewCacheIfBuildChanged()
        scheduleLocalCapacitorPluginRegistration()
        return true
    }

    /// Capacitor 6+ requires manual registration for local app plugins (not on npm).
    private var didRegisterLocalCapacitorPlugins = false

    private func scheduleLocalCapacitorPluginRegistration(attempt: Int = 0) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if self.registerLocalCapacitorPluginsIfReady() {
                return
            }
            guard attempt < 40 else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
                self?.scheduleLocalCapacitorPluginRegistration(attempt: attempt + 1)
            }
        }
    }

    @discardableResult
    private func registerLocalCapacitorPluginsIfReady() -> Bool {
        guard !didRegisterLocalCapacitorPlugins else { return true }
        guard let bridgeViewController = window?.rootViewController as? CAPBridgeViewController,
              let bridge = bridgeViewController.bridge else {
            return false
        }

        bridge.registerPluginInstance(AppIconBadgePlugin())
        didRegisterLocalCapacitorPlugins = true
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    /// Clear WKWebView cache when the bundled shell changes.
    /// Cloud WebView mode (server.url in capacitor.config.json) must NOT wipe website data —
    /// that would erase localStorage for app.taskzm.com (auth, calendar status, notification settings).
    private func purgeWebViewCacheIfBuildChanged() {
        if loadsRemoteWebApp() {
            URLCache.shared.removeAllCachedResponses()
            return
        }

        guard let bundledBuild = readBundledBuildNumber() else {
            return
        }

        let storedBuild = UserDefaults.standard.string(forKey: nativeBuildDefaultsKey)
        if storedBuild == bundledBuild {
            return
        }

        UserDefaults.standard.set(bundledBuild, forKey: nativeBuildDefaultsKey)

        guard storedBuild != nil else {
            return
        }

        let dataStore = WKWebsiteDataStore.default()
        let dataTypes = WKWebsiteDataStore.allWebsiteDataTypes()
        dataStore.removeData(ofTypes: dataTypes, modifiedSince: Date(timeIntervalSince1970: 0)) { }
        URLCache.shared.removeAllCachedResponses()
    }

    /// True when Capacitor loads UI from server.url (cloud) instead of bundled dist/.
    private func loadsRemoteWebApp() -> Bool {
        guard let config = readBundledCapacitorConfig(),
              let server = config["server"] as? [String: Any],
              let url = server["url"] as? String else {
            return false
        }
        return !url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func readBundledCapacitorConfig() -> [String: Any]? {
        let resourceNames = ["public/capacitor.config", "capacitor.config"]
        for resourceName in resourceNames {
            let parts = resourceName.split(separator: "/")
            let subdirectory = parts.count > 1 ? String(parts[0]) : nil
            let name = parts.count > 1 ? String(parts[1]) : resourceName

            if let url = Bundle.main.url(forResource: name, withExtension: "json", subdirectory: subdirectory),
               let data = try? Data(contentsOf: url),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                return json
            }
        }
        return nil
    }

    private func readBundledBuildNumber() -> String? {
        let resourceNames = ["public/build-info", "build-info"]
        for resourceName in resourceNames {
            let parts = resourceName.split(separator: "/")
            let subdirectory = parts.count > 1 ? String(parts[0]) : nil
            let name = parts.count > 1 ? String(parts[1]) : resourceName

            if let url = Bundle.main.url(forResource: name, withExtension: "json", subdirectory: subdirectory),
               let data = try? Data(contentsOf: url),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let buildNumber = json["buildNumber"] as? String {
                return buildNumber
            }
        }
        return nil
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
