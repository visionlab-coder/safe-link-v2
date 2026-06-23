import { Capacitor, registerPlugin } from "@capacitor/core";

type NativeCapabilities = {
  qr: boolean;
  nfc: boolean;
};

type NativeScanResult = {
  value: string;
  records?: Array<{ recordType: string; value: string }>;
};

interface SafeLinkNativePlugin {
  capabilities(): Promise<NativeCapabilities>;
  scanQr(): Promise<NativeScanResult>;
  scanNfc(): Promise<NativeScanResult>;
  cancel(): Promise<void>;
}

const SafeLinkNative = registerPlugin<SafeLinkNativePlugin>("SafeLinkNative");

export function isIosNativeScanner(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export async function getIosNativeCapabilities(): Promise<NativeCapabilities> {
  if (!isIosNativeScanner()) return { qr: false, nfc: false };
  return SafeLinkNative.capabilities();
}

export async function scanIosQr(): Promise<NativeScanResult> {
  return SafeLinkNative.scanQr();
}

export async function scanIosNfc(): Promise<NativeScanResult> {
  return SafeLinkNative.scanNfc();
}

export async function cancelIosScan(): Promise<void> {
  if (isIosNativeScanner()) await SafeLinkNative.cancel();
}

export function nativeScanError(error: unknown): {
  error: "permission_denied" | "unsupported" | "cancelled" | "error";
  message?: string;
} {
  const candidate = error as { code?: string; message?: string };
  const code = candidate?.code;
  if (code === "permission_denied") return { error: "permission_denied", message: candidate.message };
  if (code === "unsupported") return { error: "unsupported", message: candidate.message };
  if (code === "cancelled") return { error: "cancelled", message: candidate.message };
  return { error: "error", message: candidate?.message };
}
