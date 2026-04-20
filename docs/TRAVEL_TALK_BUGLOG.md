# Travel Talk 버그 박제 — 반복 실수 방지 규칙

> 이 파일은 실제로 발생한 버그들의 근본 원인과 교훈을 기록합니다.
> 새 기능 추가 전 반드시 이 파일을 읽고 같은 실수를 반복하지 마세요.

---

## BUG-01: 존댓말 미적용 (반말 번역 출력)

**증상:** 한국어로 번역된 결과가 반말로 출력됨 (중국어, 일본어 등 → 한국어)

**근본 원인:** `/api/translate/route.ts`에는 `formalizeKo()`가 있었으나
`/api/travel/translate/route.ts`에는 누락됨.
두 파일이 별개로 관리되면서 한쪽만 적용되고 한쪽은 빠짐.

**수정:** `to === 'ko'`일 때 양쪽 모두 `formalizeKo(translated)` 통과 필수.

**체크리스트:**
- [ ] 번역 API 신규 추가 시 → `to === 'ko'` 분기에서 `formalizeKo` 적용 여부 확인
- [ ] `/api/translate`와 `/api/travel/translate` 양쪽 동시 확인

---

## BUG-02: Supabase 브로드캐스트 자기수신 (self-echo)

**증상:** 호스트가 보낸 메시지를 호스트 자신도 수신 →
호스트 기기에서 일본어/중국어 TTS 재생 →
호스트 마이크(동시통역 중 항상 ON)가 TTS 소리를 STT로 재처리 →
게스트에게 엉뚱한 메시지 전송

**근본 원인:** Supabase Realtime 브로드캐스트 기본값은 `self: true`.
채널 생성 시 `broadcast: { self: false }` 설정을 빠뜨림.

**수정:**
```ts
supabase.channel(`travel-${code}`, {
  config: {
    broadcast: { self: false }, // 반드시 명시
  },
});
```

**체크리스트:**
- [ ] 새 Supabase 채널 생성 시 항상 `self: false` 포함
- [ ] 브로드캐스트 이벤트 핸들러가 내가 보낸 메시지도 처리하고 있지 않은지 확인

---

## BUG-03: STT mute가 결과만 버리고 API 호출은 계속함 (VAD 레이스 컨디션)

**증상:** TTS 재생 중 마이크가 TTS 소리를 잡아 STT 처리 → 엉뚱한 메시지 전송

**근본 원인 (3단계 레이스):**
```
TTS 재생(3초) → mute 호출
TTS 종료 → 300ms 후 unmute   ← 너무 빠름
VAD 침묵 감지(1500ms) → 청크 전송  ← 이미 unmuted → TTS 포함 오디오 처리!
```

초기 수정(결과만 버리기)은 불충분. API는 여전히 호출되고,
unmute 시점보다 늦게 도착한 결과는 그대로 처리됨.

**수정:**
1. `sendChunk()` 진입 시 `if (mutedRef.current) return;` — API 호출 자체 스킵
2. TTS onEnd 후 unmute 딜레이: 300ms → **2000ms** (VAD silenceDuration 1500ms 초과)

**규칙:** unmute 딜레이 ≥ VAD silenceDuration + 500ms 항상 유지.
silenceDuration이 변경되면 unmute 딜레이도 함께 변경.

---

## BUG-04: speaking-end 안전타이머가 TTS 재생 중 unmute 발동

**증상:** "서로 말하지 않는 대화" — 아무도 안 한 말이 메시지로 나옴

**근본 원인:**
```
t=1.6s: new-message 수신 → TTS 재생 시작
t=1.6s: speaking-end 수신 → setTimeout(unmute, 2000ms) 등록
t=3.6s: 안전타이머 발동 → UNMUTE ← TTS 아직 재생 중!
t=4.6s: TTS 소리가 이미 열린 마이크로 유입 → STT 처리 → 메시지 전송
```

speaking-end는 **호스트가 전송을 완료한 시점**에 오며,
게스트 TTS 재생 시간과 무관하게 일찍 도착함.
speaking-end에서 unmute 타이머를 걸면 반드시 TTS와 충돌.

**수정:**
- `speaking-end` 핸들러에서 unmute 타이머 완전 제거
- unmute는 `speakTTS` onEnd 콜백(+2000ms)에서만 처리
- 최후 안전장치는 `speaking-start`에 8초 타이머 부여

---

## BUG-05: 여러 mute/unmute 타이머 충돌

**증상:** 연속 메시지 수신 시 중간에 unmute 발동 → 간헐적 간섭

**근본 원인:** `setTimeout(unmute, X)` 호출이 여러 곳에 분산.
새 mute 호출이 왔을 때 이전 unmute 타이머를 취소하지 않아
오래된 타이머가 새 mute를 덮어씀.

**수정 패턴 (반드시 준수):**
```ts
const unmuteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const scheduleUnmute = (delayMs: number) => {
  if (unmuteTimerRef.current) clearTimeout(unmuteTimerRef.current); // 반드시 취소
  unmuteTimerRef.current = setTimeout(() => {
    unmuteTimerRef.current = null;
    unmuteSTTRef.current();
  }, delayMs);
};

const safeMute = () => {
  if (unmuteTimerRef.current) { clearTimeout(unmuteTimerRef.current); unmuteTimerRef.current = null; }
  muteSTTRef.current();
};
```

**규칙:** unmute를 setTimeout으로 예약할 때는 항상 단일 ref로 관리.
`setTimeout(unmute, X)` 직접 호출 금지.

---

## BUG-06: 게스트 자동 동시통역 진입

**증상:** 게스트가 입장하자마자 STT가 자동 시작되어 동시통역 모드처럼 동작

**근본 원인:** `joinRoom()` 함수 마지막에 `toggleSTT()` 직접 호출.
"외국인이 UI를 몰라서 자동 시작이 필요하다"는 의도였으나
결과적으로 게스트가 의도치 않게 항상 동시통역 모드로 진입.

**수정:** `joinRoom()`에서 `toggleSTT()` 제거.
게스트도 마이크 버튼을 직접 눌러야 STT 시작.

**규칙:** STT 자동 시작은 사용자가 명시적으로 요청한 경우에만 허용.

---

## BUG-07: 한 곳만 고치고 동일 로직 다른 파일은 안 고침

**반복 패턴:** 같은 기능을 하는 코드가 여러 파일에 분산되어 있을 때
한 파일만 수정하고 나머지는 누락.

**발생 사례:**
- `formalizeKo`: `/api/translate` 수정 ✓, `/api/travel/translate` 누락 ✗
- STT mute 체크: 결과 레벨만 적용, `sendChunk` 진입 레벨 누락

**필수 수칙:**
1. 번역 관련 로직 수정 시 → 두 translate API 파일 모두 확인
2. STT 관련 수정 시 → `useCloudSTT.ts` + `travel/page.tsx` + `stt/route.ts` 동시 검토
3. 수정 완료 전 `grep -r "동일키워드" src/` 로 동일 패턴 파일 전수 확인

---

## 핵심 아키텍처 원칙

### mute/unmute 규칙
```
mute 발생 조건:
  - speaking-start 수신 (safeMute 사용 → 기존 unmute 타이머 취소)
  - speakTTS() 호출 시 (safeMute 사용)

unmute 발생 조건:
  - speakTTS() onEnd 콜백 + 2000ms (scheduleUnmute 사용)
  - TTS off 또는 빈 텍스트: scheduleUnmute(0)
  - speaking-start 안전타이머: scheduleUnmute(8000)
  
절대 금지:
  - speaking-end에서 unmute
  - setTimeout(unmute, X) 직접 호출 (항상 scheduleUnmute 사용)
  - unmute 딜레이 < VAD silenceDuration (현재 1500ms)
```

### 브로드캐스트 규칙
- 채널 생성 시 `broadcast: { self: false }` 필수
- 내 메시지는 sendMessage() 내에서 직접 로컬 상태에 추가
- 브로드캐스트 수신 핸들러에서 mine 여부 별도 체크 불필요 (self=false이므로)

### 번역 존댓말 규칙
- 모든 번역 API에서 `to === 'ko'` → 반드시 `formalizeKo()` 통과
- 새 번역 경로 추가 시 이 규칙 체크리스트에 추가
