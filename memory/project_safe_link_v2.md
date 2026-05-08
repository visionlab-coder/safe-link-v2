---
name: SAFE-LINK V2 프로젝트 현황
description: 프로젝트 현황, 권한 체계, SUPER_ADMIN 구성, POC 목표
type: project
---

## 현재 버전: V2.0 (POC 준비 완료 단계)

**핵심 방침**: V3.0 전환 보류 — 스마트글라스 미도입, 현장 POC 안정성 최우선

## SUPER_ADMIN 구성 (2026-05-01 확정)
- 김무빈: wo3ai4ni3@naver.com ✅
- 천지연 (김지연으로 등록): hr@seowonenc.co.kr ✅
- 임성윤: adonisace@naver.com ✅
- 조재훈: jh.cho@seowonenc.co.kr ✅
- 박순기: 미가입 — 가입 후 `update public.profiles set role = 'SUPER_ADMIN' where display_name = '박순기';`

## P0 패키지 완료 (2026-05-01)
- roles.ts: SUPER_ADMIN + ROLE_HIERARCHY + canAccessSystem() 헬퍼
- middleware.ts: /system 서버사이드 보호
- system/page.tsx: 클라이언트 2차 방어선 (defense-in-depth)
- RLS_SUPER_ADMIN_PATCH_20260501.sql: is_super_admin(), is_admin(), is_system_operator() 확장 → 운영 적용 완료
- 테스트 계정(a@a.com) 삭제 완료

## profiles 테이블 주의사항
- email 컬럼 없음 → auth.users join 필요
- 천지연 = 김지연으로 등록됨

## 다음 단계 (P1 — 미착수)
- V3 테이블 통합
- Alert 데이터 출처 정리
- 현장 POC 이후 판단

**Why:** 스마트글라스 미도입 + POC 현장 안정성 검증이 V3 전환보다 우선
**How to apply:** V3 관련 작업 요청 시 POC 완료 여부 먼저 확인
