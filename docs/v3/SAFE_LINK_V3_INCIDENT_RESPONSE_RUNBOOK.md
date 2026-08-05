# SQ Link V3 비상 연락·장애 대응 절차

## 연락망

- 발주처 1차 연락: 서원건설 미래전략TF 김무빈 차장 (`visionlab@seowonenc.co.kr`)
- 개발 운영 담당: 배포를 수행한 저장소 운영 담당자
- AWS 담당: 회사 AWS IAM/결제 권한 보유자

연락처가 바뀌면 오픈 전에 이 문서와 운영 인수인계 문서를 함께 갱신한다.

## 장애 등급

- P0: 로그인 불가, 데이터 손실 의심, 권한/현장 정보 노출, 전체 서비스 중단
- P1: TBM·서명·QR/NFC·채팅·AI 핵심 기능 중 하나가 지속 실패
- P2: 우회 가능한 일부 기능 또는 표시 오류

## 최초 15분

1. 발견자는 발생 시각, 사용자/현장, URL, request id, 재현 절차를 기록한다.
2. P0이면 즉시 김무빈 차장과 개발 운영 담당자에게 동시에 알리고 추가 배포를 중지한다.
3. `https://api.safe-link.co.kr/actuator/health/readiness`와 frontend/backend systemd 상태를 확인한다.
4. 비밀값을 출력하지 않고 nginx·frontend·backend 로그에서 동일 request id를 추적한다.
5. 데이터 손상이나 권한 노출이 의심되면 쓰기 기능을 제한하고 DB/Object Storage 백업을 보존한다.

## 복구 기준

- 애플리케이션 오류: 마지막 정상 release로 롤백하고 readiness 및 로그인/TBM/서명 smoke test를 수행한다.
- DB 장애: readiness DOWN 여부를 확인하고 DB 복구 후 Flyway version과 중요 테이블 건수를 확인한다.
- Redis 장애: 세션과 AI quota가 우회되지 않는지 확인하고 Redis 복구 후 신규 로그인·quota를 재검증한다.
- Object Storage 장애: DB metadata만 생성된 불완전 파일이 없는지 확인하고 최근 DB/object backup hash를 대조한다.
- 계정 잠금: 감사 로그를 확인한 뒤 승인된 관리자만 잠금 해제 또는 비밀번호 재설정 절차를 수행한다.
- 보안 사고: 관련 키를 폐기·재발급하고 세션을 무효화한 뒤 접근 로그와 감사 로그를 보존한다.

## 종료 조건

- readiness가 UP이고 핵심 smoke test가 통과한다.
- 데이터 건수와 파일 hash에 이상이 없다.
- 원인, 영향 범위, 조치, 재발 방지, 담당자와 완료 시각을 기록한다.
- 발주처가 복구 결과를 확인한다.

