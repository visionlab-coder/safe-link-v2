import { CONSTRUCTION_GLOSSARY } from "@/constants/glossary";
import { normalizeKoreanGlossary } from "./korean-glossary";

export interface NormalizeResult {
    original: string;
    normalized: string;
    changes: { from: string; to: string }[];
}

// ─────────────────────────────────────────────
// 인메모리 캐시: DB에서 한 번 가져오면 재사용
// ─────────────────────────────────────────────
let _dbGlossaryCache: Record<string, string> | null = null;
let _dbGlossaryCacheAt = 0;

/**
 * fetchGlossaryFromDB
 * Spring Boot의 전역 construction_glossary 테이블에서 사전을 가져옵니다.
 * 실패 시 로컬 상수(CONSTRUCTION_GLOSSARY)를 fallback으로 사용합니다.
 */
export async function fetchGlossaryFromDB(): Promise<Record<string, string>> {
    if (_dbGlossaryCache && Date.now() - _dbGlossaryCacheAt < 60_000) return _dbGlossaryCache;

    try {
        const response = await fetch("/api/glossary?active=true", { cache: "no-store" });
        const payload = response.ok
            ? await response.json() as { terms?: Array<{ slang: string; standard: string }> }
            : null;
        const data = payload?.terms ?? [];

        if (!response.ok || data.length === 0) {
            console.warn("[normalize] DB 사전 불러오기 실패, 로컬 fallback 사용");
            _dbGlossaryCache = CONSTRUCTION_GLOSSARY;
        } else {
            const dbDict: Record<string, string> = { ...CONSTRUCTION_GLOSSARY };
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

    _dbGlossaryCacheAt = Date.now();
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
    return normalizeKoreanGlossary(text, dict);
}

// ─────────────────────────────────────────────
// 비동기 버전: DB 사전 우선, 실패 시 로컬 fallback
// ─────────────────────────────────────────────

/**
 * normalizeKoAsync (비동기, 권장)
 * DB 전역 사전을 우선 사용합니다. 발언의 어미/금지/부정/조건은 다시 쓰지 않습니다.
 */
export async function normalizeKoAsync(text: string): Promise<NormalizeResult> {
    const dict = await fetchGlossaryFromDB();
    return normalizeKo(text, dict);
}

/**
 * 변환 결과를 읽기 좋은 텍스트로 포맷
 */
export function formatChanges(changes: { from: string; to: string }[]): string {
    if (changes.length === 0) return "";
    return changes.map(c => `"${c.from}" → "${c.to}"`).join(", ");
}
