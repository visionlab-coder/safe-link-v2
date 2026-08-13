# SQ Link 데이터 보존·삭제 정책

## 상태

이 문서는 구현에 사용되는 **기술 기본값**이다. 정식 운영 전에 서원건설의 개인정보 처리방침, 산업안전보건 기록 보존 의무 및 법무 검토 결과로 기간을 확정해야 한다.

| 데이터 | 기술 기본값 | 탈퇴 시 처리 |
| --- | ---: | --- |
| 계정 프로필 | 0일 | 이메일·전화·이름을 즉시 가명 처리하고 로그인·역할·현장 권한 해제 |
| 보안 감사 기록 | 5년 | 사용자 본문과 분리하여 보존 |
| TBM·서명·작업중지 등 안전 기록 | 5년 | 안전 기록의 무결성을 위해 보존 |
| 현장 채팅 | 1년 | 기간 만료 후 삭제 대상으로 전환 |
| 연결되지 않은 임시 업로드 | 30일 | 기간 만료 후 Object Storage와 DB 메타데이터에서 삭제 |

## 운영 절차

1. 탈퇴 요청은 본인 인증 세션에서 `회원탈퇴` 확인 문구를 입력해야 한다.
2. ROOT 계정은 서비스 내 셀프 삭제를 막고 다른 ROOT가 권한을 이관한 뒤 별도 처리한다.
3. 만료 파일 조회는 기본적으로 dry-run으로 수행한다.
4. 실제 삭제는 ROOT 권한, 변경 승인, 삭제 대상 백업 확인 후에만 `dryRun=false&confirm=DELETE_EXPIRED_FILES`로 실행한다.
5. 법적 보존 또는 분쟁 대상 파일은 `legal_hold=true`로 설정하여 자동 삭제에서 제외한다.

## 운영 API

- `GET /api/v1/system/retention/policies`: 현재 적용 중인 기간 확인(ROOT)
- `POST /api/v1/system/retention/files/purge?dryRun=true`: 삭제 예정 파일 점검(ROOT)
- `POST /api/v1/system/retention/files/purge?dryRun=false&confirm=DELETE_EXPIRED_FILES`: 실제 삭제(ROOT, 별도 승인 필요)

실제 삭제 작업은 감사 로그와 실행 결과를 보존하고, 실패한 Object Storage 키를 재처리해야 한다.
