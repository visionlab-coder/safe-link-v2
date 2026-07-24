# App Review Notes 템플릿

심사 제출 전에 아래 내용을 실제 값으로 채운다. 비밀번호는 git에 커밋하지 않는다.

```text
Review contact:
- Name: <담당자명>
- Phone: <담당자 전화번호>
- Email: <담당자 이메일>

Demo account:
- Email: <심사용 제한 관리자 계정>
- Password: <App Store Connect에만 입력, git 커밋 금지>

Test environment:
- Web app: https://app.safe-link.co.kr
- API: https://api.safe-link.co.kr
- Test site: <심사용 테스트 현장명>
- Test worker: <심사용 테스트 근로자명>
- Test QR URL: <심사용 QR URL>

Important review path:
1. Launch the app.
2. Sign in with the demo account.
3. Open the test site dashboard.
4. Review TBM list and worker confirmation state.
5. Open QR/TBM worker flow using the test QR URL.
6. Confirm camera and microphone permission prompts are used only for QR/voice-related features.
7. Account deletion can be initiated from <in-app location or direct URL>.

Notes:
- This app is for authorized construction-site operations.
- Backend services must remain live during review.
- Test data is not production worker data.
```
