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

/**
 * 화면에서 사용자가 명시적으로 고른 언어(localStorage)를 DB 프로필의 기본 언어보다
 * 우선한다. 개별 페이지가 프로필을 다시 불러오더라도 현재 화면 언어를 한국어로
 * 덮어쓰지 않도록 공통으로 사용한다.
 */
export function resolveDisplayLanguage(
  profileLanguage?: string | null,
  urlLanguage?: string | null,
  fallback = "ko",
): string {
  if (typeof window === "undefined") return urlLanguage || profileLanguage || fallback;
  return urlLanguage || window.localStorage.getItem("safe-link-lang") || profileLanguage || fallback;
}
