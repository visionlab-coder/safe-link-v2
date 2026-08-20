"use client";

import { useEffect, useState, useRef } from "react";
import { Activity, ShieldCheck } from "lucide-react";

interface SwarmSite {
    name: string;
    totalNodes: number;
    activeNodes: number;
    alerts: number;
}

interface SwarmStatus {
    activeSwarmNodes: number;
    totalSwarmNodes: number;
    sites: SwarmSite[];
}

/**
 * 🌌 Swarm Visualizer (Phase 4)
 * 2,500개 이상의 에이전트 노드를 고성능으로 시각화하여 대규모 군집을 증명합니다.
 */
export default function SwarmVisualizer({ lang = "ko" }: { lang?: string }) {
    const [data, setData] = useState<SwarmStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const copy = {
        ko: { title: "실시간 군집 모니터", subtitle: "실시간 자율 마이크로 에이전트 흐름", nodes: "활성 군집 노드", health: "군집 상태", optimal: "정상", loading: "군집을 초기화하고 있습니다…", persona: "활성 담당", task: "처리 작업", risk: "위험 감지", logic: "자율 판단 로직 작동 중" },
        en: { title: "LIVE SWARM MONITOR", subtitle: "Real-time Autonomous Micro-Agent Feed", nodes: "Active Swarm Nodes", health: "Swarm Health", optimal: "OPTIMAL", loading: "Initializing Neural Swarm...", persona: "Active Persona", task: "Processing Task", risk: "Risk Detected", logic: "Autonomous Decision Logic Engaged" },
        zh: { title: "实时集群监控", subtitle: "实时自主微型代理流", nodes: "活动集群节点", health: "集群健康度", optimal: "正常", loading: "正在初始化神经集群…", persona: "活跃负责人", task: "处理任务", risk: "风险检测", logic: "自主判断逻辑运行中" },
        vi: { title: "Theo dõi cụm trực tiếp", subtitle: "Luồng tác nhân vi mô tự động thời gian thực", nodes: "Nút cụm đang hoạt động", health: "Tình trạng cụm", optimal: "TỐT", loading: "Đang khởi tạo cụm thần kinh…", persona: "Nhân sự đang hoạt động", task: "Tác vụ xử lý", risk: "Phát hiện rủi ro", logic: "Đang vận hành logic tự quyết" },
        ru: { title: "Мониторинг кластера", subtitle: "Поток автономных микроагентов в реальном времени", nodes: "Активные узлы кластера", health: "Состояние кластера", optimal: "НОРМА", loading: "Инициализация нейронного кластера…", persona: "Активный исполнитель", task: "Задача обработки", risk: "Обнаружен риск", logic: "Логика автономного принятия решений активна" },
    } as const;
    const t = copy[lang as keyof typeof copy] || copy.en;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/agents/swarm-status');
                const json = await res.json();
                setData(json);
                setLoading(false);
            } catch (e) {
                console.error("Swarm Data Error:", e);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 3000);
        return () => clearInterval(interval);
    }, []);

    // Canvas Rendering for 2500+ dots
    useEffect(() => {
        if (!data || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const width = canvasRef.current.width;
        const height = canvasRef.current.height;
        ctx.clearRect(0, 0, width, height);

        const nodesPerSite = 100; // 가상 그리드 배치를 위함
        const spacing = 6;
        const siteCols = 5;

        data.sites.forEach((site: SwarmSite, sIdx: number) => {
            const sX = (sIdx % siteCols) * (width / siteCols) + 20;
            const sY = Math.floor(sIdx / siteCols) * (height / 5) + 20;

            for (let n = 0; n < site.totalNodes; n++) {
                const col = n % Math.sqrt(nodesPerSite);
                const row = Math.floor(n / Math.sqrt(nodesPerSite));
                const x = sX + col * spacing;
                const y = sY + row * spacing;

                const isActive = n < site.activeNodes;
                const hasAlert = site.alerts > 0 && n % 15 === 0;

                ctx.beginPath();
                ctx.arc(x, y, 1.5, 0, Math.PI * 2);

                if (hasAlert) {
                    ctx.fillStyle = '#ef4444'; // Red for alert
                    ctx.shadowBlur = 4;
                    ctx.shadowColor = '#ef4444';
                } else if (isActive) {
                    ctx.fillStyle = Math.random() > 0.95 ? '#60a5fa' : '#10b981'; // Blue pulse or Green
                    ctx.shadowBlur = 0;
                } else {
                    ctx.fillStyle = '#1e293b'; // Dark for inactive
                }

                ctx.fill();
            }

            // Site Label
            ctx.font = 'bold 8px Inter, sans-serif';
            ctx.fillStyle = '#64748b';
            ctx.fillText(site.name, sX, sY - 5);
        });
    }, [data]);

    return (
        <section className="col-span-1 md:col-span-2 glass rounded-[48px] p-8 border-white/5 relative overflow-hidden bg-slate-950/60 mt-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                        <Activity className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-white italic leading-tight">{t.title}</h3>
                        <p className="text-[10px] text-slate-500 font-bold tracking-widest">{t.subtitle}</p>
                    </div>
                </div>

                <div className="flex gap-6">
                    <div className="text-right">
                        <div className="text-[10px] text-slate-500 font-black">{t.nodes}</div>
                        <div className="text-2xl font-black text-emerald-400 font-mono tracking-tighter">
                            {data?.activeSwarmNodes || '0'} / {data?.totalSwarmNodes || '0'}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-slate-500 font-black">{t.health}</div>
                        <div className="text-2xl font-black text-blue-400 font-mono tracking-tighter italic">{t.optimal}</div>
                    </div>
                </div>
            </div>

            <div className="relative aspect-[21/9] md:aspect-[3/1] bg-black/40 rounded-[32px] border border-white/5 p-4 overflow-hidden">
                <canvas
                    ref={canvasRef}
                    width={1200}
                    height={400}
                    className="w-full h-full opacity-80"
                />

                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-[10px] font-black text-emerald-400 tracking-widest animate-pulse">{t.loading}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-400">{t.persona}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[10px] font-bold text-slate-400">{t.task}</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    <span className="text-[10px] font-bold text-slate-400">{t.risk}</span>
                </div>
                <div className="ml-auto flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] font-black text-slate-300 italic">{t.logic}</span>
                </div>
            </div>
        </section>
    );
}
