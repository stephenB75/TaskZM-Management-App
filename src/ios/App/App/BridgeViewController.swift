import UIKit
import Capacitor

/// Capacitor 6+ does not auto-register local app plugins; register them here.
class BridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppIconBadgePlugin())
    }
}
