import Capacitor
import UIKit
import WebKit

private struct SafeLinkNavigationPolicy: Decodable {
    let defaultAction: String
    let allowedOrigins: [String]
    let externalLinks: String
}

@objc(SafeLinkBridgeViewController)
final class SafeLinkBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(SafeLinkNavigationPolicyPlugin())
    }
}

private final class SafeLinkNavigationPolicyPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "SafeLinkNavigationPolicyPlugin"
    let jsName = "SafeLinkNavigationPolicy"
    let pluginMethods: [CAPPluginMethod] = []

    private lazy var allowedOrigins: Set<String> = {
        guard
            let policyURL = Bundle.main.url(forResource: "navigation-policy", withExtension: "json"),
            let data = try? Data(contentsOf: policyURL),
            let policy = try? JSONDecoder().decode(SafeLinkNavigationPolicy.self, from: data),
            policy.defaultAction == "deny",
            policy.externalLinks == "system-browser"
        else {
            return []
        }

        return Set(policy.allowedOrigins.compactMap(Self.exactHTTPSOrigin))
    }()

    override func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        guard let url = navigationAction.request.url else {
            return true
        }

        if isAllowedApplicationURL(url) {
            return false
        }

        let isTopLevel = navigationAction.targetFrame == nil ||
            navigationAction.targetFrame?.isMainFrame == true

        if isTopLevel, UIApplication.shared.applicationState == .active {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }

        return true
    }

    private func isAllowedApplicationURL(_ url: URL) -> Bool {
        if let localOrigin = bridge?.config.localURL.origin,
           url.origin == localOrigin {
            return true
        }

        guard url.scheme?.lowercased() == "https" else {
            return false
        }

        return allowedOrigins.contains(url.origin)
    }

    private static func exactHTTPSOrigin(_ value: String) -> String? {
        guard
            let components = URLComponents(string: value),
            components.scheme?.lowercased() == "https",
            components.host != nil,
            components.path.isEmpty,
            components.query == nil,
            components.fragment == nil,
            let url = components.url
        else {
            return nil
        }

        return url.origin
    }
}

private extension URL {
    var origin: String {
        guard let scheme, let host else {
            return ""
        }

        if let port {
            return "\(scheme.lowercased())://\(host.lowercased()):\(port)"
        }

        return "\(scheme.lowercased())://\(host.lowercased())"
    }
}
