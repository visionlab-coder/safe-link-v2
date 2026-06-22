import "server-only";
import { Redis } from "@upstash/redis";
import { encrypt, decrypt } from "@/utils/crypto";

/**
 * 🧪 SAFE-LINK Lab — 런타임 통번역 엔진/API키 스위처 (테스트 전용).
 *
 * 격리 원칙:
 *  - APP_MODE !== "lab" 이면 getLabOverride()는 **항상 null** → 운영 라우트는 기존 env 그대로 사용(무영향).
 *  - 키는 AES-256-GCM 암호화 저장(crypto.ts). 평문은 절대 저장/로그 금지.
 *  - 저장소: Upstash Redis(배포), 미설정 시 in-memory(로컬 dev 단일 인스턴스).
 */

export type TranslateEngine = "papago" | "google" | "gemini" | "flitto";

export interface LabEngineConfig {
    translateEngine?: TranslateEngine;   // 강제 엔진(미지정 시 기존 우선순위)
    papagoId?: string;
    papagoSecret?: string;
    googleKey?: string;
    geminiKey?: string;
    flittoToken?: string;
    updatedAt?: string;
}

/** setLabConfig/route 입력용 — translateEngine은 ""(=해제) 허용 */
export interface LabConfigInput {
    translateEngine?: string;
    papagoId?: string;
    papagoSecret?: string;
    googleKey?: string;
    geminiKey?: string;
    flittoToken?: string;
}

const REDIS_KEY = "lab:engine-config:v1";
type SecretField = "papagoId" | "papagoSecret" | "googleKey" | "geminiKey" | "flittoToken";
const SECRET_FIELDS: SecretField[] = [
    "papagoId", "papagoSecret", "googleKey", "geminiKey", "flittoToken",
];

export function isLabMode(): boolean {
    return process.env.APP_MODE?.trim() === "lab";
}

let _redis: Redis | null = null;
function redis(): Redis | null {
    if (_redis) return _redis;
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (!url || !token) return null;
    _redis = new Redis({ url, token });
    return _redis;
}

// in-memory fallback (로컬 dev 단일 인스턴스 전용)
let _memStore: string | null = null;

/** 암호화된 raw 레코드 read */
async function readRaw(): Promise<Record<string, string> | null> {
    const r = redis();
    if (r) return (await r.get<Record<string, string>>(REDIS_KEY)) ?? null;
    return _memStore ? (JSON.parse(_memStore) as Record<string, string>) : null;
}

async function writeRaw(record: Record<string, string>): Promise<void> {
    const r = redis();
    if (r) { await r.set(REDIS_KEY, record); return; }
    _memStore = JSON.stringify(record);
}

/**
 * 운영 라우트용 — lab 모드가 아니면 null(=기존 env 사용). lab 모드면 복호화된 오버라이드 반환.
 */
export async function getLabOverride(): Promise<LabEngineConfig | null> {
    if (!isLabMode()) return null;
    try {
        const raw = await readRaw();
        if (!raw) return null;
        const out: LabEngineConfig = {
            translateEngine: raw.translateEngine as TranslateEngine | undefined,
            updatedAt: raw.updatedAt,
        };
        for (const f of SECRET_FIELDS) {
            if (raw[f]) {
                try { out[f] = decrypt(raw[f]); } catch { /* 손상 값 무시 */ }
            }
        }
        return out;
    } catch {
        return null;
    }
}

/** /lab UI용 — 키는 마스킹(****1234)해서 노출. lab 모드 아니면 null. */
export async function getLabConfigMasked(): Promise<(Omit<LabEngineConfig, never> & { _masked: true }) | null> {
    const cfg = await getLabOverride();
    if (!cfg) return null;
    const mask = (v?: string) => (v ? `••••${v.slice(-4)}` : undefined);
    return {
        translateEngine: cfg.translateEngine,
        papagoId: mask(cfg.papagoId),
        papagoSecret: mask(cfg.papagoSecret),
        googleKey: mask(cfg.googleKey),
        geminiKey: mask(cfg.geminiKey),
        flittoToken: mask(cfg.flittoToken),
        updatedAt: cfg.updatedAt,
        _masked: true,
    };
}

/** 부분 업데이트 — 전달된 필드만 암호화 저장. 빈 문자열이면 해당 필드 삭제. */
export async function setLabConfig(patch: LabConfigInput): Promise<void> {
    if (!isLabMode()) throw new Error("Lab mode disabled (APP_MODE!=lab)");
    const raw = (await readRaw()) ?? {};
    if (patch.translateEngine !== undefined) {
        if (patch.translateEngine) raw.translateEngine = patch.translateEngine;
        else delete raw.translateEngine;
    }
    for (const f of SECRET_FIELDS) {
        const v = patch[f];
        if (v === undefined) continue;
        if (v === "") delete raw[f];
        else raw[f] = encrypt(v);
    }
    raw.updatedAt = new Date().toISOString();
    await writeRaw(raw);
}
