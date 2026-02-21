"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";

export default function WorkerTBMDetail() {
    const router = useRouter();
    const signaturePadRef = useRef<SignatureCanvas | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // 가상의 TBM 데이터 (나중에는 진짜 DB에서 가져올 거예요!)
    const tbmData = {
        originalText: "안전모 착용 방염 마스크 착용 필수",
        translatedText: "MUST WEAR SAFETY HELMET & MASK",
        date: "2026-02-21 오전 8:00",
    };

    // 소리 듣기(TTS) 버튼 눌렀을 때
    const handlePlayAudio = () => {
        setIsPlaying(true);
        // [초보자 안내] 나중에는 진짜 사람 목소리 파일이 나옵니다.
        // 지금은 예시로 컴퓨터가 영어로 읽어주게 했어요!
        const utterance = new SpeechSynthesisUtterance(tbmData.translatedText);
        utterance.lang = "en-US";
        utterance.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
    };

    // 서명 지우기
    const handleClearSignature = () => {
        signaturePadRef.current?.clear();
    };

    // 최종 확인 및 서명 제출!
    const handleSubmit = () => {
        if (signaturePadRef.current?.isEmpty()) {
            alert("Please sign in the box before confirming. (서명을 먼저 해주세요!)");
            return;
        }

        // [초보자 안내] 이 다음부터는 서명된 그림을 수파베이스(DB)에 쏙 넣는 코드가 들어갑니다.
        alert("서명이 완료되었습니다! 오늘도 안전하게 작업하세요!");
        router.push("/worker");
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col pb-6">
            <header className="flex justify-center items-center p-6 bg-slate-900 border-b border-slate-800 shadow-md">
                <h1 className="text-xl font-bold tracking-widest text-slate-300">SAFE-LINK Worker Mode</h1>
            </header>

            <main className="flex-1 flex flex-col p-4 md:p-8 gap-6 max-w-2xl mx-auto w-full">
                {/* TBM 경고 카드 */}
                <div className="relative overflow-hidden p-8 bg-slate-800/60 rounded-[32px] border-2 border-red-500 shadow-[0_0_50px_-15px_rgba(239,68,68,0.4)] backdrop-blur-md">
                    {/* 날짜 */}
                    <div className="text-slate-400 font-medium mb-4">{tbmData.date}</div>

                    {/* 원본 텍스트 (작게) */}
                    <div className="text-slate-500 mb-2 truncate">
                        (한국어) {tbmData.originalText}
                    </div>

                    {/* 번역 텍스트 (엄청 크게!!) */}
                    <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-8 break-words drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                        {tbmData.translatedText}
                    </h2>

                    {/* 소리 듣기 버튼 */}
                    <button
                        onClick={handlePlayAudio}
                        disabled={isPlaying}
                        className="w-full py-5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isPlaying ? (
                            <svg className="w-10 h-10 text-blue-400 animate-pulse" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" /></svg>
                        ) : (
                            <svg className="w-10 h-10 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        )}
                        <span className="text-2xl font-bold text-blue-300">Listen via Voice</span>
                    </button>
                </div>

                {/* 서명 영역 */}
                <div className="flex flex-col flex-1">
                    <div className="flex justify-between items-end mb-3">
                        <h3 className="text-xl font-bold text-slate-300 pl-2">Please sign here (이곳에 서명하세요)</h3>
                        <button
                            onClick={handleClearSignature}
                            className="px-4 py-2 bg-slate-800 text-slate-400 rounded-lg text-sm font-bold hover:bg-slate-700 active:scale-95"
                        >
                            다시 쓰기 (Clear)
                        </button>
                    </div>

                    <div className="bg-white rounded-3xl overflow-hidden border-4 border-slate-700 w-full aspect-video shadow-inner">
                        <SignatureCanvas
                            ref={signaturePadRef}
                            penColor="black"
                            canvasProps={{
                                className: "w-full h-full cursor-crosshair",
                            }}
                        />
                    </div>
                </div>
            </main>

            {/* 고정된 큰 초록색 버튼 */}
            <div className="p-4 mt-auto">
                <button
                    onClick={handleSubmit}
                    className="w-full py-8 bg-green-500 hover:bg-green-400 text-slate-950 font-black text-3xl md:text-4xl rounded-[32px] shadow-[0_20px_40px_-15px_rgba(34,197,94,0.6)] active:scale-95 transition-transform"
                >
                    CONFIRM & SIGN
                </button>
            </div>
        </div>
    );
}
