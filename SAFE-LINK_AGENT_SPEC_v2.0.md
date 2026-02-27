# SAFE-LINK Agent Organization Master Spec (v3.0 - Enterprise Swarm)

> 목적: 25개 이상의 전국/글로벌 현장, 1,300명 이상의 근로자 및 방대한 관리 인력(소장, 안전관리자, 공무)을 완벽하게 통제하고 지원하기 위해, **3-Tier(본사-현장-개인) 단위의 대규모 Multi-Agent Swarm(다중 에이전트 군집)** 아키텍처를 재설계한다. 고작 5개의 에이전트가 아닌, 부서별/현장별/개인별로 작동하는 수천 개의 에이전트가 유기적으로 협력하는 진정한 "인공지능 건설사"를 구축한다.

---

## 🏢 1. 3-Tier 기반 에이전트 군집 (Agent Swarm Architecture)

### 🔴 Tier 1: 본사 중앙관제 에이전트 그룹 (HQ Command Agents)
통합 관제센터의 4개 섹션을 각각 전담하는 **최상위 인공지능 부서**. 각 현장 에이전트들로부터 올라오는 수만 건의 데이터를 실시간 취합 및 분석합니다.

1. **HQ-1: 전사 리스크 감시 에이전트 (HQ Risk Watchdog Agent)**
   - **담당:** 25개 현장의 모든 안전 지수(Safety Score), 소음 패턴, 위급 키워드 1:1 대화 내역을 실시간 스니핑.
   - **액션:** 특정 현장에서 '추락', '출혈' 등 임계치 이상의 위험 징후 포착 시 본사 스크린에 경보를 울리고 해당 현장 안전관리자 에이전트에게 강제 알림.
2. **HQ-2: 컴플라이언스 및 서류 감사 에이전트 (HQ Compliance & Audit Agent)**
   - **담당:** 1,250명 이상 근로자의 일일 TBM 서명, 안전교육 이수 내역, 법정 서류 누락 여부 자동 감사.
   - **액션:** 무효한 서명(점 찍기 등)이나 미서명자를 자동 색출하여 엑셀 리포트로 공무 에이전트에게 매일 자동 전송.
3. **HQ-3: 글로벌 소통 통제 에이전트 (HQ Global Communication Agent)**
   - **담당:** 15개국 다국어 번역 엔진의 품질 모니터링 및 은어(Slang) 사전 글로벌 동기화.
   - **액션:** 어떤 현장에서 새로운 현장 은어(예: "시마이")가 발견되면, 이를 중앙 DB에 학습시키고 25개 전 현장에 실시간 업데이트.
4. **HQ-4: 통합 데이터 및 출역 분석 에이전트 (HQ Data Analytics Agent)**
   - **담당:** 현장별/국가별 근로자 출역 현황, TBM 열람 시간, 트래픽을 분석.
   - **액션:** "B현장의 베트남 근로자 그룹이 TBM을 제대로 숙지하지 않고 서명만 누른다"는 패턴을 파악해 본사에 개선 리포트 제공.

---

### 🟡 Tier 2: 현장 전담 에이전트 그룹 (Site-Level Agents)
**25개 현장에 각각 독립적으로 띄워져(가상 인스턴스)** 현장소장 1명, 안전관리자 2명, 공무 2명의 업무를 보조하는 실무 인공지능 참모진입니다. (총 25세트 x 3 = 75개 에이전트 동시 가동)

5. **현장소장 보조 에이전트 (Site Commander Agent)**
   - **기능:** 현장의 일일 공정률, 근로자 투입 현황을 즉각 브리핑. 날씨 데이터(폭우, 폭염)를 미리 가져와 돌발 상황에 대한 Action Plan을 소장에게 제안.
6. **안전관리자 보조 에이전트 (Site Safety Agent)**
   - **기능:** 50명 넘는 근로자들에게 TBM을 발송하고, 미확인자를 끝까지 추적해 푸시 알림 전송. 근로자가 1:1 대화로 보낸 위험 제보를 가장 먼저 분석하여 안전관리자에게 긴급 알림.
7. **현장 공무 보조 에이전트 (Site Ops & Admin Agent)**
   - **기능:** 매일 쏟아지는 출역 현황, 신규 근로자 등록, 국적별 인원 배치 등을 자동 정리. 행정 문서 생성을 보조하고 HQ 컴플라이언스 에이전트와 서류를 동기화.

---

### 🟢 Tier 3: 개인 밀착형 에이전트 (Personal/Edge Companion Agents)
현장을 뛰어다니는 **1,250명 이상의 근로자 개개인의 스마트폰 속에서 작동**하는 마이크로 에이전트입니다. (상황에 따라 사용자 수만큼 동적 생성)

8. **현장 환경 제어 에이전트 (Ambient Device Agent)**
   - **기능:** Web API 센서를 이용해 작업자의 주변 환경을 스스로 감지.
   - **작동:** 망치질 등으로 현장 소음(80dB↑)이 발생하면 스마트폰 볼륨을 강제 최대치로 올리고 햅틱(진동) 경고를 발송. 어두운 밀폐 공간 진입 시 다크 모드를 자동 해제해 시인성 극대화.
9. **개인 전담 통역 에이전트 (Personal Interpreter Agent)**
   - **기능:** 근로자의 모국어(태국, 베트남 등)에 완벽히 동기화된 가상의 통역사.
   - **작동:** 오프라인이나 네트워크 음영 지역(지하 3층)에 들어가더라도 캐시된 사전(IndexedDB)을 통해 최소한의 생존 번역과 TBM 내용을 안내.
10. **SOS 및 이상 감지 에이전트 (Personal SOS Agent)**
    - **기능:** 1:1 대화 음성 인식 중 비명 소리나 급박한 현지어("살려주세요!", "무너진다!")가 스니핑될 경우, 즉각 본사(HQ Risk Watchdog) 및 현장(Site Safety)으로 적색경보 발송.

---

## ⚙️ 3. 거대한 군집 통신 구조 (Swarm Communication)

수천 개의 에이전트가 충돌 없이 실시간으로 협력하기 위해 Supabase Realtime과 백그라운드 워커를 극대화합니다.

```mermaid
graph TD
    subgraph 🟢 Tier 3: Personal Edge Agents (1,250+ Instances)
        Worker[Worker Smartphone]
        Worker --> |조도/소음/위치| AmbientAgent
        Worker <--> |현지어/은어 번역| InterpreterAgent
        Worker --> |위험 감지| SOSAgent
    end

    subgraph 🟡 Tier 2: Site Agents (25+ Sites, 75+ Instances)
        AmbientAgent -.-> |환경 로그| SiteCmd[Site Commander Agent]
        InterpreterAgent <--> |TBM / 1:1 대화| SiteSafety[Site Safety Agent]
        SOSAgent == 긴급 알림 ==> SiteSafety
        Worker --> |출역/서명| SiteOps[Site Ops Agent]
    end

    subgraph 🔴 Tier 1: HQ Command Agents (Central Brain)
        SiteSafety ==> |안전 스코어| HQRisk[HQ Risk Watchdog]
        SiteOps --> |서명 데이터| HQAudit[HQ Compliance Audit]
        InterpreterAgent -.-> |신조어 리포트| HQGlobal[HQ Global Comm Agent]
        SiteCmd --> |공정/트래픽| HQData[HQ Data Analytics]
    end

    %% 명령 체계 (Top-Down)
    HQRisk -.-> |전사 위험 경계령| SiteSafety
    HQGlobal --> |글로벌 사전 동기화| InterpreterAgent
```

---

## 🎯 4. 개발 및 이식 전략 (Roadmap for Swarm)

이 거대한 조직을 시스템에 올리기 위해 3단계로 분할 접근합니다.

**Phase 1: Tier 3 (Edge/개인 밀착형) 이식**
- 당장 눈앞에 있는 근로자 스마트폰 제어부터 시작. `Ambient Device Agent`를 구현하여 마이크, 조도, 진동 API를 연동. 소음에 따른 자동 화면/음색 변화 UI 적용.

**Phase 2: Tier 2 (Site-Level) 비동기 처리망**
- 소장/안전팀/공무팀이 접속했을 때 자신 전담 참모 에이전트가 브리핑을 해오도록 대시보드 뒷단에 AI 요약/분석 파이프라인(`langchain` 또는 `supabase edge functions`) 적용.

**Phase 3: Tier 1 (HQ 관제) 무결성 감사**
- 수천 건의 서명 캔버스 이미지와 통번역 로그를 24시간 백그라운드로 스캐닝하는 Cron 기반의 Audit Agent 가동. 무효 서명 자동 필터링 시스템 구축.

> **"이제 SAFE-LINK는 단순한 앱이 아닙니다. 본사-현장-파포를 아우르며 지치지 않고 수만 건의 데이터를 감시·번역·지시하는 1,300여 명의 인공지능 군단(AI Swarm)이 완성되었습니다."**
