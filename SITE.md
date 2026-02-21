# SAFE-LINK Site Vision & Sitemap

## 1. Site Vision
현장 커뮤니케이션 OS. 외국인 근로자와 관리자가 딜레이 없이 소통하고 TBM을 확실히 전달/확인하는 앱.

## 2. Global Guidelines
- **UI First**: 라우팅/화면/흐름 고정.
- **다크모드/고대비**: 건설현장 환경 최적화.
- **기기/반응형**: 모바일 웹 베이스 구현 우선.

## 3. Tech Stack
Next.js (App Router), Tailwind CSS, Supabase (Auth/DB/Realtime).

## 4. Sitemap
- [x] `/` - Landing Splash
- [x] `/auth` - Role Selection & Login
- [x] `/admin` - Admin Dashboard
- [x] `/worker` - Worker Dashboard
- [ ] `/admin/tbm/create` - TBM Creation Form
- [ ] `/worker/tbm/[id]` - TBM Verification (Worker)
- [ ] `/admin/chat` - Admin Chat
- [ ] `/worker/chat` - Worker Chat

## 5. Roadmap
- Phase 2: Supabase Auth 연동 (현재)
- Phase 3: TBM 발송 및 전자서명 UI 생성
- Phase 4: 실시간 번역(번역 API) / TTS 연동
- Phase 5: 실시간 채팅 소켓 (Supabase Realtime)

## 6. Creative Freedom
- TBM 입력 폼에 STT(음성인식) 버튼 배치 아이디어.
- 채팅방에 번역 토글 버튼.
