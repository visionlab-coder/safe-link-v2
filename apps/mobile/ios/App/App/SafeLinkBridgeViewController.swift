import AVFoundation
import Capacitor
import CoreNFC
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
        bridge?.registerPluginInstance(SafeLinkNativePlugin())
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

private final class SafeLinkNativePlugin: CAPPlugin, CAPBridgedPlugin, NFCNDEFReaderSessionDelegate {
    let identifier = "SafeLinkNativePlugin"
    let jsName = "SafeLinkNative"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "capabilities", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanQr", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scanNfc", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    private var qrScanner: SafeLinkQrScannerViewController?
    private var qrCall: CAPPluginCall?
    private var nfcSession: NFCNDEFReaderSession?
    private var nfcCall: CAPPluginCall?
    private var backgroundObserver: NSObjectProtocol?

    override func load() {
        backgroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.cancelActiveScans(code: "cancelled", message: "App entered background")
        }
    }

    deinit {
        if let backgroundObserver {
            NotificationCenter.default.removeObserver(backgroundObserver)
        }
    }

    @objc func capabilities(_ call: CAPPluginCall) {
        call.resolve([
            "qr": AVCaptureDevice.default(for: .video) != nil,
            "nfc": NFCNDEFReaderSession.readingAvailable
        ])
    }

    @objc func scanQr(_ call: CAPPluginCall) {
        guard qrCall == nil, nfcCall == nil else {
            call.reject("Another native scan is active", "busy")
            return
        }
        guard AVCaptureDevice.default(for: .video) != nil else {
            call.reject("Camera is unavailable", "unsupported")
            return
        }
        guard let presenter = bridge?.viewController else {
            call.reject("Native view controller is unavailable", "error")
            return
        }

        let scanner = SafeLinkQrScannerViewController()
        scanner.onResult = { [weak self] result in
            self?.finishQr(result)
        }
        qrScanner = scanner
        qrCall = call
        DispatchQueue.main.async {
            presenter.present(scanner, animated: true)
        }
    }

    @objc func scanNfc(_ call: CAPPluginCall) {
        guard qrCall == nil, nfcCall == nil else {
            call.reject("Another native scan is active", "busy")
            return
        }
        guard NFCNDEFReaderSession.readingAvailable else {
            call.reject("NFC reading is unavailable", "unsupported")
            return
        }

        nfcCall = call
        let session = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: true)
        session.alertMessage = "SAFE-LINK NFC 태그를 iPhone 상단에 가까이 대세요."
        nfcSession = session
        session.begin()
    }

    @objc func cancel(_ call: CAPPluginCall) {
        cancelActiveScans(code: "cancelled", message: "Scan cancelled")
        call.resolve()
    }

    func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        guard let call = nfcCall else {
            nfcSession = nil
            return
        }

        nfcCall = nil
        nfcSession = nil
        let readerError = error as? NFCReaderError
        if readerError?.code == .readerSessionInvalidationErrorUserCanceled ||
            readerError?.code == .readerSessionInvalidationErrorSessionTimeout ||
            readerError?.code == .readerSessionInvalidationErrorFirstNDEFTagRead {
            call.reject("NFC scan cancelled", "cancelled")
        } else {
            call.reject("NFC scan failed", "error")
        }
    }

    func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {
        guard let call = nfcCall else {
            session.invalidate()
            return
        }

        let records = messages.flatMap(\.records).compactMap(Self.decodeNdefRecord)
        guard let target = records.compactMap({ $0["value"] as? String }).first(where: Self.isAllowedResult) else {
            nfcCall = nil
            nfcSession = nil
            session.invalidate(errorMessage: "지원되는 SAFE-LINK 태그가 아닙니다.")
            call.reject("NFC payload is not an allowed SAFE-LINK target", "invalid_result")
            return
        }

        nfcCall = nil
        nfcSession = nil
        session.alertMessage = "SAFE-LINK 태그를 확인했습니다."
        session.invalidate()
        call.resolve([
            "value": target,
            "records": records
        ])
    }

    private func finishQr(_ result: SafeLinkQrScannerResult) {
        let call = qrCall
        qrCall = nil
        qrScanner = nil

        switch result {
        case .value(let value):
            guard Self.isAllowedResult(value) else {
                call?.reject("QR payload is not an allowed SAFE-LINK target", "invalid_result")
                return
            }
            call?.resolve(["value": value])
        case .cancelled:
            call?.reject("QR scan cancelled", "cancelled")
        case .permissionDenied:
            call?.reject("Camera permission was denied", "permission_denied")
        case .failure:
            call?.reject("QR scan failed", "error")
        }
    }

    private func cancelActiveScans(code: String, message: String) {
        if let scanner = qrScanner {
            scanner.cancel()
            qrScanner = nil
        }
        qrCall?.reject(message, code)
        qrCall = nil

        nfcSession?.invalidate()
        nfcSession = nil
        nfcCall?.reject(message, code)
        nfcCall = nil
    }

    private static func isAllowedResult(_ value: String) -> Bool {
        guard
            value.utf8.count <= 2048,
            let url = URL(string: value),
            url.origin == "https://safe-link-v2.vercel.app"
        else {
            return false
        }

        return ["/qr", "/n", "/w", "/nfc"].contains {
            url.path == $0 || url.path.hasPrefix("\($0)/")
        }
    }

    private static func decodeNdefRecord(_ record: NFCNDEFPayload) -> JSObject? {
        switch record.typeNameFormat {
        case .nfcWellKnown where record.type == Data([0x55]):
            guard let value = decodeUriPayload(record.payload) else {
                return nil
            }
            return ["recordType": "url", "value": value]
        case .nfcWellKnown where record.type == Data([0x54]):
            guard record.payload.count >= 1 else {
                return nil
            }
            let languageLength = Int(record.payload[0] & 0x3F)
            let textStart = 1 + languageLength
            guard record.payload.count >= textStart,
                  let value = String(data: record.payload.dropFirst(textStart), encoding: .utf8) else {
                return nil
            }
            return ["recordType": "text", "value": value]
        case .absoluteURI:
            guard let value = String(data: record.type, encoding: .utf8) else {
                return nil
            }
            return ["recordType": "absolute-url", "value": value]
        default:
            return nil
        }
    }

    private static func decodeUriPayload(_ payload: Data) -> String? {
        guard let prefixCode = payload.first else {
            return nil
        }
        let prefixes = [
            "", "http://www.", "https://www.", "http://", "https://",
            "tel:", "mailto:", "ftp://anonymous:anonymous@", "ftp://ftp.",
            "ftps://", "sftp://", "smb://", "nfs://", "ftp://", "dav://",
            "news:", "telnet://", "imap:", "rtsp://", "urn:", "pop:",
            "sip:", "sips:", "tftp:", "btspp://", "btl2cap://", "btgoep://",
            "tcpobex://", "irdaobex://", "file://", "urn:epc:id:",
            "urn:epc:tag:", "urn:epc:pat:", "urn:epc:raw:", "urn:epc:",
            "urn:nfc:"
        ]
        guard Int(prefixCode) < prefixes.count,
              let suffix = String(data: payload.dropFirst(), encoding: .utf8) else {
            return nil
        }
        return prefixes[Int(prefixCode)] + suffix
    }
}

private enum SafeLinkQrScannerResult {
    case value(String)
    case cancelled
    case permissionDenied
    case failure
}

private final class SafeLinkQrScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onResult: ((SafeLinkQrScannerResult) -> Void)?

    private let session = AVCaptureSession()
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var completed = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configureCancelButton()
        requestCameraAndStart()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    func cancel() {
        finish(.cancelled)
    }

    private func requestCameraAndStart() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configureSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    granted ? self?.configureSession() : self?.finish(.permissionDenied)
                }
            }
        default:
            finish(.permissionDenied)
        }
    }

    private func configureSession() {
        guard
            let device = AVCaptureDevice.default(for: .video),
            let input = try? AVCaptureDeviceInput(device: device),
            session.canAddInput(input)
        else {
            finish(.failure)
            return
        }

        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else {
            finish(.failure)
            return
        }

        session.addInput(input)
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]

        let preview = AVCaptureVideoPreviewLayer(session: session)
        preview.videoGravity = .resizeAspectFill
        preview.frame = view.bounds
        view.layer.insertSublayer(preview, at: 0)
        previewLayer = preview

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.session.startRunning()
        }
    }

    private func configureCancelButton() {
        let button = UIButton(type: .system)
        button.setTitle("취소", for: .normal)
        button.setTitleColor(.white, for: .normal)
        button.backgroundColor = UIColor.black.withAlphaComponent(0.55)
        button.layer.cornerRadius = 8
        button.translatesAutoresizingMaskIntoConstraints = false
        button.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
        view.addSubview(button)
        NSLayoutConstraint.activate([
            button.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            button.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -16),
            button.widthAnchor.constraint(equalToConstant: 72),
            button.heightAnchor.constraint(equalToConstant: 44)
        ])
    }

    @objc private func cancelTapped() {
        finish(.cancelled)
    }

    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard
            let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
            object.type == .qr,
            let value = object.stringValue
        else {
            return
        }
        finish(.value(value))
    }

    private func finish(_ result: SafeLinkQrScannerResult) {
        guard !completed else {
            return
        }
        completed = true
        session.stopRunning()
        dismiss(animated: true) { [weak self] in
            self?.onResult?(result)
            self?.onResult = nil
        }
    }
}
