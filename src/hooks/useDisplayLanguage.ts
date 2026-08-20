"use client";

import { useEffect, useState } from "react";

export const DISPLAY_LANGUAGE_CHANGED = "safe-link-language-changed";

export function readDisplayLanguage(fallback = "ko"): string {
  if (typeof window === "undefined") return fallback;
  const fromUrl = new URL(window.location.href).searchParams.get("lang");
  return fromUrl || window.localStorage.getItem("safe-link-lang") || fallback;
}

/**
 * 화면 공통 언어 상태. 헤더에서 바꾼 언어를 하위 페이지와 공통 컴포넌트가
 * 같은 탭 안에서도 즉시 수신하도록 한다.
 */
export function useDisplayLanguage(fallback = "ko"): string {
  const [language, setLanguage] = useState(fallback);

  useEffect(() => {
    const sync = () => setLanguage(readDisplayLanguage(fallback));
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(DISPLAY_LANGUAGE_CHANGED, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(DISPLAY_LANGUAGE_CHANGED, sync);
    };
  }, [fallback]);

  return language;
}

export function persistDisplayLanguage(language: string): void {
  window.localStorage.setItem("safe-link-lang", language);
  window.dispatchEvent(new Event(DISPLAY_LANGUAGE_CHANGED));
}
