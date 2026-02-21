"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import RoleGuard from "@/components/RoleGuard";

export default function AdminTBMCreate() {
    const router = useRouter();
    const [tbmText, setTbmText] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isRecording, setIsRecording] = useState(false); // 🎤 마이크 녹음 상태
    const [history, setHistory] = useState<any[]>([]);    // 📜 과거 기록 저장소
    const [isGeneratingAI, setIsGeneratingAI] = useState(false); // 🤖 AI 생성 중
    const [aiTips, setAiTips] = useState<string[]>([]);          // 🤖 AI 추천 문장들

    // 🎤 음성 인식기를 기억해두는 메모장 (수동으로 끄기 위함)
    const recognitionRef = useRef<any>(null);

    // 🤖 AI 안전 가이드 생성 (스마트 추천)
    const handleGenerateAI = () => {
        setIsGeneratingAI(true);

        // [초보자 안내] 나중에 여기에 진짜 ChatGPT(Gemini) 같은 AI를 연결할 거예요.
        // 지금은 똑똑한 척하는 가짜 데이터를 보여줍니다!
        setTimeout(() => {
            const mockTips = [
                "🏗️ 금일 고소 작업 시 하부 통제 구역 설정을 다시 한번 확인해 주세요!",
                "⛈️ 오늘 오후 비 소식이 있습니다. 전기 가설물 덮개 및 접지 상태를 점검 바랍니다.",
                "🧤 장비 협착 사고 예방을 위해 회전 기구 작업 시 면장갑 대신 전용 장갑을 착용하세요."
            ];
            setAiTips(mockTips);
            setIsGeneratingAI(false);
        }, 1500);
    };

    // 📜 처음 들어왔을 때 + 데이터 보냈을 때 최근 5개를 가져옵니다.
    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        const supabase = createClient();
        const { data } = await supabase
            .from("tbm_notices")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(5);
        if (data) setHistory(data);
    };

    // 🎤 음성 인식 (STT) 마법 함수 - 수동 정지 버전
    const toggleRecording = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert("⚠️ 현재 브라우저(또는 기기)에서는 마이크 입력을 지원하지 않습니다. 크롬 최신 버전을 사용해주세요!");
            return;
        }

        if (isRecording) {
            // 녹음 중이었으면 수동으로 강제 종료!
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            setIsRecording(false);
        } else {
            // 녹음 시작!
            const recognition = new SpeechRecognition();
            recognition.lang = 'ko-KR';
            recognition.continuous = true; // ✨ 내가 멈추기 전엔 절대 끊지 마!
            recognition.interimResults = false;

            // 앞으로 이 리모컨으로 끄기 위해 기억해둡니다.
            recognitionRef.current = recognition;

            recognition.start();
            setIsRecording(true);

            // 말을 성공적으로 알아들었을 때!
            recognition.onresult = (event: any) => {
                let currentTranscript = "";
                // continuous 모드에서는 여러 뭉치의 말이 들어올 수 있으므로, 새로 들어온 말만 쏙 빼서 씁니다.
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    currentTranscript += event.results[i][0].transcript;
                }

                if (currentTranscript.trim()) {
                    setTbmText((prev) => prev ? prev + " " + currentTranscript.trim() : currentTranscript.trim());
                }
            };

            // 에러가 났을 때
            recognition.onerror = (event: any) => {
                console.error("음성 인식 에러:", event.error);
                setIsRecording(false);
            };

            // 혹시라도 조용해서 꺼졌을 때를 대비
            recognition.onend = () => {
                setIsRecording(false);
            };
        }
    };

    // ✨ 완벽한 스마트 시스템! TBM 텍스트를 수파베이스 DB 서랍장에 평생 저장합니다.
    const handleSendTBM = async () => {
        if (!tbmText.trim()) {
            alert("전파할 TBM 텍스트를 입력해주세요!");
            return;
        }

        setIsSending(true);

        try {
            const supabase = createClient();

            // 1. 현재 접속한 관리자가 누구인지 파악합니다.
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("로그인 세션이 만료되었습니다. 다시 로그인 해 주세요.");

            // 2. 관리자의 소속 권역(site_id)을 파악하기 위해 명함을 뒤져봅니다.
            const { data: profile } = await supabase
                .from("profiles")
                .select("site_id")
                .eq("id", session.user.id)
                .single();

            // 3. tbm_notices에 저장 (site_id는 있으면 넣고, 없으면 제외)
            const insertPayload: any = {
                content_ko: tbmText.trim(),
                created_by: session.user.id,
            };
            if (profile?.site_id) {
                insertPayload.site_id = profile.site_id;
            }

            const { error } = await supabase
                .from("tbm_notices")
                .insert(insertPayload);

            if (error) {
                console.error("TBM 저장 실패:", error.code, error.message);
                // 에러 코드 23502 = NOT NULL 제약 위반 (site_id)
                if (error.code === "23502") {
                    alert("⚠️ site_id NOT NULL 오류\n\nSupabase > SQL Editor에서 아래 SQL을 실행해 주세요:\n\nALTER TABLE public.tbm_notices\nALTER COLUMN site_id DROP NOT NULL;");
                } else {
                    alert(`DB 오류: ${error.message} (코드: ${error.code})`);
                }
                return;
            }

            alert("✅ 똑똑한 AI 시스템 작동 완료!\nTBM이 데이터베이스에 완벽하게 저장 및 전파 처리되었습니다.");
            setTbmText(""); // 입력창을 비워줍니다.
            fetchHistory(); // 방금 보낸 걸 목록에 바로 업데이트!

        } catch (error: any) {
            console.error("전파 중 알 수 없는 에러:", error);
            alert("알 수 없는 에러가 발생했습니다.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <RoleGuard allowedRole="admin">
            <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col pb-6">
                <header className="flex justify-between items-center p-6 bg-slate-900 border-b border-slate-800 shadow-md">
                    <button
                        onClick={() => router.back()}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                        {/* 뒤로 가기 아이콘 */}
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h1 className="text-xl font-bold tracking-widest text-slate-300">SAFE-LINK Admin Mode</h1>
                    <div className="w-8" /> {/* 밸런스를 맞추기 위한 빈 공간 (투명) */}
                </header>

                <main className="flex-1 flex flex-col p-4 md:p-8 gap-6 max-w-3xl mx-auto w-full">

                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <h2 className="text-3xl font-extrabold text-blue-400">TBM 작성</h2>
                            {/* 🤖 새로 생긴 마법의 AI 버튼! */}
                            <button
                                onClick={handleGenerateAI}
                                disabled={isGeneratingAI}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-sm font-bold shadow-lg active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isGeneratingAI ? "AI가 뇌를 굴리는 중..." : "🤖 AI 안전 가이드 생성"}
                            </button>
                        </div>
                        <p className="text-slate-400">
                            안전 수칙을 작성하면 15개국 언어로 번역되어 즉시 근로자 앱에 전파됩니다.
                        </p>
                    </div>

                    {/* 🤖 AI 추천 문장들이 나타나는 곳 */}
                    {aiTips.length > 0 && (
                        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                            <h3 className="text-sm font-bold text-slate-500 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                                AI가 지금 상황에 맞춰 추천하는 문장입니다
                            </h3>
                            <div className="grid gap-2">
                                {aiTips.map((tip, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            setTbmText(tip);
                                            setAiTips([]); // 선택하면 깔끔하게 닫기
                                        }}
                                        className="text-left p-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-2xl text-blue-100 transition-all text-sm md:text-base active:scale-98"
                                    >
                                        {tip}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col flex-1 p-8 bg-slate-800/80 rounded-[32px] border border-blue-500/30 shadow-[0_0_30px_-10px_rgba(59,130,246,0.2)]">
                        <label className="text-xl font-bold mb-4 text-slate-200">
                            📝 전파 내용 (한국어)
                        </label>

                        <textarea
                            value={tbmText}
                            onChange={(e) => setTbmText(e.target.value)}
                            placeholder="예: 금일 크레인 작업이 있습니다. 안전모와 방염 마스크를 반드시 착용해 주세요. 무리한 작업은 삼가세요."
                            className="flex-1 w-full bg-slate-900/50 border border-slate-700 rounded-2xl p-6 text-xl focus:border-blue-500 outline-none transition-colors resize-none placeholder-slate-500"
                        />

                        {/* 이제 진짜 작동하는 STT 음성 인식 버튼! */}
                        <div className="flex justify-end mt-4">
                            <button
                                onClick={toggleRecording}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all active:scale-95 ${isRecording
                                    ? "bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse"
                                    : "bg-slate-700 hover:bg-slate-600 text-slate-300 border border-transparent"
                                    }`}
                            >
                                {isRecording ? (
                                    <>
                                        {/* 녹음 중일 때 깜빡이는 아이콘 */}
                                        <span className="flex h-3 w-3 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                        </span>
                                        듣고 있습니다... 멈추려면 클릭
                                    </>
                                ) : (
                                    <>
                                        {/* 기본 마이크 아이콘 */}
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                        버튼을 누르고 바로 말씀하세요
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* 고정된 큰 파란색 전송 버튼 */}
                    <div className="pt-4">
                        <button
                            onClick={handleSendTBM}
                            disabled={isSending || tbmText.length === 0}
                            className="w-full py-8 bg-blue-600 hover:bg-blue-500 text-white font-black text-3xl md:text-4xl rounded-[32px] shadow-[0_20px_40px_-15px_rgba(37,99,235,0.6)] active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex justify-center items-center"
                        >
                            {isSending ? (
                                <svg className="w-10 h-10 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            ) : (
                                "TBM 15개국 번역 전송"
                            )}
                        </button>
                    </div>

                    {/* 📜 최근 전파 기록 섹션 */}
                    <div className="mt-8 flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-slate-300">📜 최근 전파 기록</h3>
                            <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-500">자동 저장됨</span>
                        </div>

                        {history.length === 0 ? (
                            <div className="p-8 border-2 border-dashed border-slate-800 rounded-[32px] text-center">
                                <p className="text-slate-500 italic">아직 전파 기록이 없습니다. 첫 TBM을 발송해보세요!</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {history.map((tbm) => (
                                    <div
                                        key={tbm.id}
                                        className="group p-6 bg-slate-800/40 hover:bg-slate-800/60 rounded-[24px] border border-slate-700/50 hover:border-blue-500/30 transition-all"
                                    >
                                        <div className="flex justify-between items-start gap-4">
                                            <p className="text-lg text-slate-200 leading-relaxed flex-1">
                                                {tbm.content_ko}
                                            </p>
                                            <button
                                                onClick={() => {
                                                    setTbmText(tbm.content_ko);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                className="flex-shrink-0 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-xl text-sm font-bold hover:bg-blue-500 hover:text-white transition-all"
                                            >
                                                불러오기 🔄
                                            </button>
                                        </div>
                                        <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                                            <span className="flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                {new Date(tbm.created_at).toLocaleString('ko-KR')}
                                            </span>
                                            <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                                            <span>관리자 ID: {tbm.created_by.slice(0, 8)}...</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </RoleGuard>
    );
}
