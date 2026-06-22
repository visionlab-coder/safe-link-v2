import { Capacitor } from "@capacitor/core";

export type PlatformInfo = {
  platform: "android" | "ios" | "web";
  native: boolean;
};

export function getPlatformInfo(): PlatformInfo {
  const platform = Capacitor.getPlatform();
  return {
    platform: platform === "android" || platform === "ios" ? platform : "web",
    native: Capacitor.isNativePlatform()
  };
}
