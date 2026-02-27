import { NextRequest, NextResponse } from 'next/server';

/**
 * 📡 Swarm Status API (Phase 4)
 * 2,500개 이상의 에이전트 상태를 시뮬레이션 및 집계하여 시각화 컴포넌트에 전달합니다.
 */
export async function GET(request: NextRequest) {
    // 실제 환경에서는 DB의 profiles 및 agent_logs에서 통계를 가져오지만,
    // 시연을 위해 25개 현장과 총 2,500개의 노드 상태를 즉시 생성합니다.

    const sites = Array.from({ length: 25 }, (_, i) => {
        const siteId = i + 1;
        const totalNodes = 100 + Math.floor(Math.random() * 10); // 현장당 약 100~110개 노드 (총 2500+)

        return {
            id: siteId,
            name: `SITE ${String.fromCharCode(65 + (i % 26))}${i > 25 ? Math.floor(i / 26) : ''}`,
            activeNodes: Math.floor(totalNodes * (0.9 + Math.random() * 0.1)), // 90~100% 활성
            totalNodes: totalNodes,
            alerts: Math.random() > 0.8 ? 1 : 0, // 20% 확률로 현장 경고 발생
            avgNoise: 30 + Math.random() * 40,
        };
    });

    return NextResponse.json({
        timestamp: new Date().toISOString(),
        totalSwarmNodes: sites.reduce((acc, s) => acc + s.totalNodes, 0),
        activeSwarmNodes: sites.reduce((acc, s) => acc + s.activeNodes, 0),
        globalRiskLevel: "LOW",
        sites
    });
}
