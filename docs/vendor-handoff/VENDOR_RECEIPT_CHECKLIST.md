# 범소프트웨어 SAFE-LINK V2 수령 체크리스트

## 전달물 확인

- [ ] ZIP과 SHA-256 체크섬이 일치한다.
- [ ] `HANDOFF_MANIFEST.txt`의 Git SHA가 안내 메일과 일치한다.
- [ ] `.env`, API 키, 비밀번호, 인증서가 ZIP에 없다.
- [ ] `node_modules`, `.next`, `.open-next`, Android build 산출물이 없다.
- [ ] `npm ci`, `npm run check:web`, `npm run build:cloudflare`가 성공한다.

## 기능·권한 확인

- [ ] 관리자 4계층과 근로자 역할 경계를 검토했다.
- [ ] API 69개와 migration 53개 인벤토리를 검토했다.
- [ ] 운영 DB와 migration history 대조 책임자를 정했다.
- [ ] 네이티브 재구현과 웹/API 재사용 범위를 확정했다.
- [ ] TBM·라이브 통역·1:1 대화를 최우선 수락 시나리오로 확정했다.

## 별도 보안 전달

- [ ] 시크릿 전달 채널과 수신 담당자를 확정했다.
- [ ] staging과 production 키를 분리했다.
- [ ] Apple/Google 계정과 서명키 소유자를 확정했다.
- [ ] 인수 후 키 회전 일정을 확정했다.

수령일: __________  담당자: __________  확인 서명: __________
