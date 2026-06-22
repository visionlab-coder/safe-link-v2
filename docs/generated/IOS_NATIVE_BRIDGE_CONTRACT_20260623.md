# SAFE-LINK V2 iOS Native Bridge Contract

## Decision

The production web origin may request a small allowlisted set of native actions. It must never receive raw Keychain values or submit access tokens, refresh tokens, cookies, passwords, signature images, or service credentials through the bridge.

The native layer determines the trusted origin from the current `WKWebView` navigation state. A message-supplied origin is never trusted.

## Allowed operations

| Operation | Direction | Purpose |
|---|---|---|
| `app.capabilities` | Web → native | Query boolean availability only |
| `qr.scan` | Web → native | Start native QR scanner |
| `qr.presentResult` | Native/internal | Validate normalized SAFE-LINK QR target |
| `nfc.scan` | Web → native | Start Core NFC NDEF scan |
| `nfc.presentResult` | Native/internal | Validate normalized SAFE-LINK NFC target |
| `secureSession.status` | Web → native | Return only `present: boolean` |
| `secureSession.clear` | Web → native | Delete native secure session material |

There is deliberately no `secureSession.get`, arbitrary storage, HTTP proxy, shell, file read, JavaScript evaluation, or dynamic plugin invocation operation.

## Native enforcement requirements

1. Register one fixed script-message handler name.
2. Read the current main-frame origin from `WKWebView`; reject subframes.
3. Accept only an exact HTTPS origin in `bridge-contract.json`.
4. Decode into a fixed envelope with version, request ID, operation, and payload.
5. Reject unknown fields and payloads over 4 KiB.
6. Dispatch through a static Swift enum, never reflection or selector names from input.
7. Return structured errors without stack traces or native exception text.
8. Never log complete request or result payloads.
9. QR/NFC results must resolve to an allowed SAFE-LINK origin and path prefix.
10. Cancel active camera/NFC sessions when the WebView navigates away or enters background.

## Session limitation

The current remote web shell stores its browser authentication separately. A native Keychain bridge cannot secure an existing JavaScript-readable web refresh token by itself. Full Keychain protection requires a later authentication architecture change where native code owns token issuance and refresh.

Until then:

- the bridge exposes only `status` and `clear`;
- no token crosses the bridge;
- the existing web session security issue remains a release blocker;
- the bridge must not be described as completed secure-token storage.

## Automated verification

```bash
node apps/mobile/scripts/test-ios-bridge-contract.mjs
```

Expected:

- capability, QR, NFC and secure-clear fixtures pass;
- evil origin, token exfiltration, external URL and unknown operation fixtures fail.

## Next READY

`IOS-003A — design the native-owned authentication and Keychain lifecycle required to remove JavaScript-readable refresh tokens.`
