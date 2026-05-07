import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * 📡 Swarm Status API — 실DB 연동 (2026-05-06 PATCH)
 * profiles(근로자 수), stop_work_alerts(경고), tbm_acks(활성률)를
 * 실제 Supabase 데이터로 집계하여 SwarmVisualizer에 전달합니다.
 */
export async function GET() {
    try {
        const supabase = await createClient();

        // 미인증 요청 차단
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. 현장별 근로자 수 (profiles 실집계)
        const { data: workerProfiles } = await supabase
            .from('profiles')
            .select('site_id, site_code')
            .eq('role', 'WORKER')
            .not('site_id', 'is', null);

        // 2. 최근 24시간 작업중지권 알림 (실집계)
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentAlerts } = await supabase
            .from('stop_work_alerts')
            .select('site_id')
            .gte('created_at', since24h);

        // 3. 최근 24시간 TBM 서명 수 — 전체 활성률 근사치 (단일 쿼리)
        const { count: recentAckCount } = await supabase
            .from('tbm_acks')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', since24h);

        // site_id별 근로자 수 집계
        const siteCounts: Record<string, { total: number; code: string }> = {};
        (workerProfiles ?? []).forEach(p => {
            const key = String(p.site_id);
            if (!siteCounts[key]) {
                siteCounts[key] = { total: 0, code: p.site_code ?? `SITE-${key.slice(0, 6)}` };
            }
            siteCounts[key].total += 1;
        });

        // site_id별 경고 수 집계
        const alertsBySite: Record<string, number> = {};
        (recentAlerts ?? []).forEach(a => {
            if (a.site_id) {
                const k = String(a.site_id);
                alertsBySite[k] = (alertsBySite[k] || 0) + 1;
            }
        });

        // 전체 활성률 계산 (TBM 서명 ÷ 전체 근로자)
        const totalWorkers = workerProfiles?.length ?? 0;
        const globalAckRate = totalWorkers > 0
            ? Math.min((recentAckCount ?? 0) / totalWorkers, 1)
            : 0.9; // 데이터 없을 때 기본값

        // 현장별 노드 구성
        // - 근로자 1인 = 개인 통역 에이전트 1노드 (Tier 3)
        // - 현장당 관리 에이전트 3개 고정: 소장·안전·공무 (Tier 2)
        const sites = Object.entries(siteCounts).map(([siteId, info]) => {
            const workerCount = info.total;
            const totalNodes = workerCount + 3;
            const activeNodes = Math.min(
                Math.round(workerCount * globalAckRate) + 3,
                totalNodes
            );
            return {
                id: siteId,
                name: info.code,
                totalNodes,
                activeNodes,
                alerts: alertsBySite[siteId] ?? 0,
                avgNoise: 45, // 건설현장 평균 소음(dB) — 실측 센서 연동 시 대체
            };
        });

        // HQ 에이전트 4개 상시 가동 (Tier 1: Risk·Compliance·GlobalComm·Analytics)
        const HQ_AGENTS = 4;
        const totalSwarmNodes = sites.reduce((acc, s) => acc + s.totalNodes, 0) + HQ_AGENTS;
        const activeSwarmNodes = sites.reduce((acc, s) => acc + s.activeNodes, 0) + HQ_AGENTS;

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            totalSwarmNodes,
            activeSwarmNodes,
            globalRiskLevel: sites.some(s => s.alerts > 0) ? 'ELEVATED' : 'LOW',
            sites,
            _simulated: false,
        });

    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
