import type { Metadata } from "next";
import Image from "next/image";
import { Download, Smartphone } from "lucide-react";

export const metadata: Metadata = {
  title: "SQ LINK | 앱 다운로드 및 사용 안내",
  description: "안드로이드 테스트 앱 다운로드와 설치 방법을 안내합니다.",
};

export default function DownloadPage() {
  return (
    <main className="min-h-dvh bg-[#eef3f8] px-5 py-12 text-[#172033] sm:py-16">
      <div className="mx-auto max-w-xl">
        <header className="mb-10 text-center">
          <Image src="/brand/seowon-logo-compact-transparent.png" alt="SEOWON" width={180} height={64} className="mx-auto mb-6 h-auto w-40" priority />
          <p className="mb-3 text-sm font-bold tracking-widest text-blue-700">SQ LINK</p>
          <h1 className="text-3xl font-black sm:text-4xl">앱 다운로드 및 사용 안내</h1>
          <p className="mt-4 leading-relaxed text-slate-600">안드로이드 휴대폰에 SQ LINK 앱을 설치해 주세요.</p>
        </header>

        <div>
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-labelledby="android-heading">
            <Smartphone className="mb-4 text-blue-700" size={30} aria-hidden="true" />
            <h2 id="android-heading" className="text-2xl font-black">안드로이드</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">APK 파일을 내려받아 앱을 설치합니다.</p>
            <a href="/downloads/sq-link.apk" download="sq-link.apk" className="mt-6 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-blue-700 px-4 py-3 font-bold text-[#ffffff] transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">
              <Download size={20} aria-hidden="true" /> APK 다운로드
            </a>
            <p className="mt-2 text-center text-xs text-slate-500">스토어 출시 전 테스트용 · SQ Link Dev</p>
            <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-slate-700">
              <li>위 버튼을 눌러 APK 파일을 다운로드합니다.</li>
              <li>휴대폰의 <strong>내 파일 → 다운로드</strong>에서 파일을 엽니다.</li>
              <li>설치 권한 안내가 뜨면 해당 브라우저 또는 내 파일의 <strong>이 출처 허용</strong>을 켜고 설치합니다.</li>
              <li>앱을 열고 언어와 역할을 선택한 뒤 로그인합니다. 알림·마이크는 기능 이용 시 허용해 주세요.</li>
            </ol>
            <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">다운로드가 안 되면 Chrome에서 이 페이지를 열어 주세요. 설치 후에는 이 출처의 설치 허용을 다시 꺼도 됩니다.</p>
          </section>

        </div>
        <footer className="mt-8 text-center text-sm leading-relaxed text-slate-600">로그인 계정이나 소속 현장을 모르는 경우 현장 관리자에게 문의해 주세요.</footer>
      </div>
    </main>
  );
}
