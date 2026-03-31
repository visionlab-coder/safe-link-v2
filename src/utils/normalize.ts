import { CONSTRUCTION_GLOSSARY } from "@/constants/glossary";
import { createClient } from "@/utils/supabase/client";

export interface NormalizeResult {
    original: string;
    normalized: string;
    changes: { from: string; to: string }[];
}

// ─────────────────────────────────────────────
// 인메모리 캐시: DB에서 한 번 가져오면 재사용
// ─────────────────────────────────────────────
let _dbGlossaryCache: Record<string, string> | null = null;

/**
 * fetchGlossaryFromDB
 * Supabase의 전역 construction_glossary 테이블에서 사전을 가져옵니다.
 * 실패 시 로컬 상수(CONSTRUCTION_GLOSSARY)를 fallback으로 사용합니다.
 */
export async function fetchGlossaryFromDB(): Promise<Record<string, string>> {
    if (_dbGlossaryCache) return _dbGlossaryCache;

    try {
        const supabase = createClient();
        const { data, error } = await supabase
            .from("construction_glossary")
            .select("slang, standard")
            .eq("is_active", true);

        if (error || !data || data.length === 0) {
            console.warn("[normalize] DB 사전 불러오기 실패, 로컬 fallback 사용");
            _dbGlossaryCache = CONSTRUCTION_GLOSSARY;
        } else {
            const dbDict: Record<string, string> = {};
            for (const row of data) {
                dbDict[row.slang] = row.standard;
            }
            _dbGlossaryCache = dbDict;
            console.info(`[normalize] DB 사전 로드 완료: ${data.length}개 항목`);
        }
    } catch {
        console.warn("[normalize] DB 연결 오류, 로컬 fallback 사용");
        _dbGlossaryCache = CONSTRUCTION_GLOSSARY;
    }

    return _dbGlossaryCache;
}

/** 캐시 초기화 (관리자가 사전 수정 후 즉시 반영 시 사용) */
export function clearGlossaryCache() {
    _dbGlossaryCache = null;
}

// ─────────────────────────────────────────────
// 동기 버전: 로컬 상수 사전 사용 (TBM 즉시 전파 등)
// ─────────────────────────────────────────────

/**
 * normalizeKo (동기)
 * 로컬 상수 사전 기반 은어 → 표준어 변환 (최장 일치 우선)
 */
export function normalizeKo(text: string, dict: Record<string, string> = CONSTRUCTION_GLOSSARY): NormalizeResult {
    const changes: { from: string; to: string }[] = [];

    // 긴 표현(구절)부터 먼저 치환 (최장 일치)
    const sorted = Object.entries(dict)
        .sort((a, b) => b[0].length - a[0].length);

    // 플레이스홀더 기반 치환: 치환된 영역이 재치환되지 않도록 보호
    const placeholders: string[] = [];
    let result = text;

    for (const [slang, standard] of sorted) {
        if (result.includes(slang)) {
            changes.push({ from: slang, to: standard });
            const ph = `\x00${placeholders.length}\x00`;
            placeholders.push(standard);
            result = result.split(slang).join(ph);
        }
    }

    // 플레이스홀더를 실제 표준어로 복원
    for (let i = 0; i < placeholders.length; i++) {
        result = result.split(`\x00${i}\x00`).join(placeholders[i]);
    }

    return { original: text, normalized: result, changes };
}

// ─────────────────────────────────────────────
// 비동기 버전: DB 사전 우선, 실패 시 로컬 fallback
// ─────────────────────────────────────────────

import { formalizeKo } from "./politeness";

/**
 * normalizeKoAsync (비동기, 권장)
 * DB 전역 사전을 우선 사용하고, 문장을 존댓말로 변환합니다.
 */
export async function normalizeKoAsync(text: string): Promise<NormalizeResult> {
    const dict = await fetchGlossaryFromDB();
    const normalizedData = normalizeKo(text, dict);
    // 문장을 존댓말 지침에 맞게 변환 (불변성 유지)
    return {
        ...normalizedData,
        normalized: formalizeKo(normalizedData.normalized),
    };
}

/**
 * 변환 결과를 읽기 좋은 텍스트로 포맷
 */
export function formatChanges(changes: { from: string; to: string }[]): string {
    if (changes.length === 0) return "";
    return changes.map(c => `"${c.from}" → "${c.to}"`).join(", ");
}
