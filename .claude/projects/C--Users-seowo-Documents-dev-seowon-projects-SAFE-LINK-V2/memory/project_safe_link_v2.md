---
name: SAFE-LINK V2 프로젝트 현황
description: 프로젝트 구조, 기술 스택, 배포 상태, 주요 수정 이력
type: project
---

## 기술 스택
- Next.js 15 + React 19 + TypeScript + Supabase + Tailwind CSS
- STT: Google Cloud Speech-to-Text + Gemini 2.5 Flash 문맥 보정 (2026-04 추가)
- Translation: Google Cloud Translation + Gemini 2.5 Flash (하이브리드)
- TTS: Google Cloud TTS + Browser SpeechSynthesis (이중 엔진)
- 20개 언어 지원

## 2026-04 업그레이드 (현장 피드백 대응)
1. **LLM 문맥 보정**: STT 파이프라인에 Gemini 기반 건설 문맥 교정 단계 추가
2. **용어 사전 확장**: 28개 신규 은어 + 30개 STT 힌트 추가 (CPB, 알폼, 구루마 등)
3. **작업중지권 버튼**: Worker 메인 화면에 9개 언어 긴급 정지 버튼 + 감성 메시지 추가

**Why:** 건설 현장 STT 오인식(CPB→CPD, 알폼→아이폰), 외국인 근로자 소통 단절, 심리적 이탈 문제
**How to apply:** STT 관련 수정은 /api/stt/route.ts, 용어는 constants/glossary.ts + construction-terms.ts, UI는 worker/page.tsx
