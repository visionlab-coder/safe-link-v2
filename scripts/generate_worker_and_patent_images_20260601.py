# -*- coding: utf-8 -*-
from __future__ import annotations

from pathlib import Path
from textwrap import wrap

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "generated"
WORKER_DIR = OUT / "worker-screens-20260601"
PATENT_DIR = OUT / "patent-claim-images-20260601"

INK = "#111827"
MUTED = "#5B6472"
PAPER = "#F7F4EE"
WHITE = "#FFFFFF"
LINE = "#DDD6CC"
BLUE = "#2563EB"
GREEN = "#16A34A"
AMBER = "#F59E0B"
RED = "#DC2626"
NAVY = "#111827"
PINK = "#EF3D9A"
PURPLE = "#7C3AED"


def font(size: int, bold: bool = False):
    path = Path(r"C:\Windows\Fonts\malgunbd.ttf" if bold else r"C:\Windows\Fonts\malgun.ttf")
    return ImageFont.truetype(str(path), size=size) if path.exists() else ImageFont.load_default()


def rounded(draw, box, r=18, fill=WHITE, outline=LINE, width=2):
    draw.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)


def text(draw, xy, s, size=28, fill=INK, bold=False, anchor=None, max_width=None, line_gap=6):
    f = font(size, bold)
    if max_width:
        lines = []
        for part in str(s).split("\n"):
            chars = max(1, int(max_width / max(size * 0.58, 1)))
            lines.extend(wrap(part, chars) or [""])
        x, y = xy
        for line in lines:
            draw.text((x, y), line, font=f, fill=fill, anchor=anchor)
            y += size + line_gap
        return y
    draw.text(xy, str(s), font=f, fill=fill, anchor=anchor)


def arrow(draw, start, end, fill=BLUE, width=4):
    draw.line([start, end], fill=fill, width=width)
    x1, y1 = start
    x2, y2 = end
    if abs(x2 - x1) >= abs(y2 - y1):
        direction = 1 if x2 > x1 else -1
        pts = [(x2, y2), (x2 - 16 * direction, y2 - 9), (x2 - 16 * direction, y2 + 9)]
    else:
        direction = 1 if y2 > y1 else -1
        pts = [(x2, y2), (x2 - 9, y2 - 16 * direction), (x2 + 9, y2 - 16 * direction)]
    draw.polygon(pts, fill=fill)


def make_worker_screen(filename, title, subtitle, sections, accent=BLUE):
    img = Image.new("RGB", (900, 1600), PAPER)
    d = ImageDraw.Draw(img)
    rounded(d, (170, 60, 730, 1540), 46, fill="#0B1020", outline="#1F2937", width=5)
    rounded(d, (205, 115, 695, 1485), 30, fill="#0F172A", outline="#111827", width=2)
    d.rectangle((205, 115, 695, 255), fill="#111827")
    text(d, (235, 158), "SAFE-LINK", 26, WHITE, True)
    text(d, (235, 202), title, 34, WHITE, True)
    text(d, (235, 252), subtitle, 18, "#CBD5E1", False, max_width=420)
    y = 335
    for idx, (head, body, status) in enumerate(sections):
        rounded(d, (235, y, 665, y + 165), 22, fill="#FFFFFF", outline="#E5E7EB", width=2)
        d.ellipse((258, y + 28, 310, y + 80), fill=accent)
        text(d, (284, y + 42), str(idx + 1), 20, WHITE, True, anchor="mm")
        text(d, (330, y + 28), head, 24, INK, True)
        text(d, (330, y + 66), body, 17, MUTED, False, max_width=300)
        if status:
            rounded(d, (330, y + 118, 610, y + 148), 12, fill="#EFF6FF", outline="#BFDBFE", width=1)
            text(d, (470, y + 133), status, 15, BLUE, True, anchor="mm")
        y += 195
    rounded(d, (260, 1370, 640, 1435), 22, fill=accent, outline=accent, width=1)
    text(d, (450, 1402), "확인하고 다음 단계로 이동", 20, WHITE, True, anchor="mm")
    img.save(WORKER_DIR / filename)


def make_worker_assets():
    WORKER_DIR.mkdir(parents=True, exist_ok=True)
    make_worker_screen(
        "worker_01_login_entry.png",
        "근로자 입장",
        "QR/NFC 또는 전화번호로 현장 교육에 접속",
        [
            ("언어 선택", "한국어, 베트남어, 태국어 등 본인 언어 선택", "다국어 UI"),
            ("본인 확인", "전화번호·이름 또는 NFC/QR로 인증", "현장 배정 확인"),
            ("교육 화면 이동", "오늘 TBM, 퀴즈, 서명, 채팅 메뉴 표시", "자동 라우팅"),
        ],
        GREEN,
    )
    make_worker_screen(
        "worker_02_tbm_confirm.png",
        "TBM 확인",
        "오늘 작업 위험요인과 안전약속을 읽고 서명",
        [
            ("작업 내용", "관리자가 발송한 TBM 공지를 본인 언어로 확인", "번역 표시"),
            ("위험요인", "추락, 낙하물, 이동 동선, 보호구 항목 확인", "위험성평가 연결"),
            ("전자서명", "확인 후 서명하면 시간과 해시 증빙 저장", "법적 증빙"),
        ],
        BLUE,
    )
    make_worker_screen(
        "worker_03_quiz.png",
        "안전 퀴즈",
        "TBM 이해도를 문항으로 확인하고 보충교육 대상 분류",
        [
            ("문항 수신", "TBM 내용 기반 문제를 본인 언어로 확인", "AI 생성"),
            ("응답 제출", "객관식 또는 OX 응답 저장", "점수 산정"),
            ("결과 확인", "이수, 미이수, 재교육 필요 상태 표시", "보충교육"),
        ],
        AMBER,
    )
    make_worker_screen(
        "worker_04_chat_live.png",
        "채팅·실시간 통역",
        "관리자와 1:1 대화하고 현장 방송을 본인 언어로 수신",
        [
            ("1:1 대화", "근로자 언어와 관리자 언어를 자동 번역", "대화 로그"),
            ("라이브 방송", "관리자 음성 발화를 텍스트·번역으로 수신", "translations JSON"),
            ("위험 표현", "작업중지·사고 표현은 별도 증거와 연결 가능", "청구항 15 보강 대상"),
        ],
        PINK,
    )
    make_worker_screen(
        "worker_05_stop_work.png",
        "작업중지·신고",
        "위험 상황을 발견하면 즉시 신고하고 조치 이력을 남김",
        [
            ("위험 신고", "위험 위치와 상황을 본인 언어로 입력", "다국어 번역"),
            ("관리자 라우팅", "현장 관리자에게 알림과 조치 요청 전달", "5분 escalation"),
            ("조치 완료", "조치 결과와 완료 시각을 감사기록으로 보존", "해시체인"),
        ],
        RED,
    )


CLAIMS = [
    ("C1", "시스템 기본 구성", ["검증매체", "세션", "다국어", "증거저장", "관리자 화면"], BLUE),
    ("C2", "NFC·QR·서명 URL fallback", ["NFC UID/NDEF", "QR", "서명 URL", "HMAC", "TTL/nonce"], GREEN),
    ("C3", "1인 다매체 매핑·재발급 폐기", ["근로자", "NFC 스티커", "QR 토큰", "재발급", "폐기 이벤트"], AMBER),
    ("C4", "시간·현장·단말 유효성", ["교육 시작", "현장 매칭", "관리자 단말", "중복 방지", "단일 이벤트"], PURPLE),
    ("C5", "위험성평가 자동 연결", ["작업조", "작업 위치", "작업 시간", "보호구", "점검사항"], RED),
    ("C6", "원문·정규화·번역 3단 저장", ["source_text", "normalized_text", "translated_text", "glossary", "model id"], BLUE),
    ("C7", "1:1 다국어 대화와 위험키워드", ["근로자 메시지", "번역", "위험 표현", "관리자 알림", "증거 연결"], GREEN),
    ("C8", "이수·미이수·재교육 분류", ["퀴즈", "점수", "threshold", "passed", "remedial"], AMBER),
    ("C9", "안전약속·전자서명", ["위험성평가", "안전약속", "서명", "PIN/생체", "해시체인"], PURPLE),
    ("C10", "정규화 직렬화·해시체인", ["canonical JSON", "SHA-256", "개별 해시", "체인 해시", "검증 RPC"], RED),
    ("C11", "보고서·QR·검증 URL", ["보고서", "report_hash", "검증 ID", "QR", "verify URL"], BLUE),
    ("C12", "작업중지·안전신고 라우팅", ["신고", "번역", "관리자 라우팅", "조치 이력", "완료 시각"], GREEN),
    ("C13", "이력 집계·ESG 보고서", ["TBM", "서명", "퀴즈", "채팅", "ESG export"], AMBER),
    ("C14", "방법 청구 S100~S200", ["태그 인식", "TBM", "퀴즈", "응답", "보고서"], PURPLE),
    ("C15", "안전대화 로그·위험키워드 증거", ["음성/텍스트", "키워드 탐지", "신호 생성", "작업중지", "감사 이벤트"], RED),
]


def make_claim_image(claim, title_s, nodes, accent):
    img = Image.new("RGB", (1600, 1000), PAPER)
    d = ImageDraw.Draw(img)
    text(d, (80, 60), f"{claim}. {title_s}", 44, INK, True)
    text(d, (82, 120), "SAFE-LINK v2.0 특허출원 참고 이미지 · 청구항 매칭 도면", 24, MUTED, True)
    x0, y0 = 95, 255
    box_w, box_h = 245, 135
    centers = []
    for i, node in enumerate(nodes):
        x = x0 + i * 292
        rounded(d, (x, y0, x + box_w, y0 + box_h), 22, WHITE, LINE, 3)
        d.rectangle((x, y0, x + box_w, y0 + 38), fill=accent)
        text(d, (x + box_w / 2, y0 + 19), f"단계 {i+1}", 17, WHITE, True, anchor="mm")
        text(d, (x + 22, y0 + 64), node, 25, INK, True, max_width=box_w - 44)
        centers.append((x + box_w, y0 + box_h / 2))
        if i:
            arrow(d, (x - 47, y0 + box_h / 2), (x - 5, y0 + box_h / 2), accent, 5)

    rounded(d, (120, 520, 1480, 770), 28, "#FFFFFF", LINE, 3)
    text(d, (160, 555), "도면 설명", 30, accent, True)
    explanation = {
        "C1": "근로자의 검증매체 입력부터 다국어 교육, 세션 생성, 증거 저장, 관리자 확인까지 이어지는 기본 시스템 구성.",
        "C2": "NFC가 우선 동작하고, QR 또는 서명 URL이 fallback으로 동작하며 HMAC 토큰으로 위변조를 방지.",
        "C3": "한 근로자에게 여러 검증매체를 매핑하고, 재발급 시 기존 매체 폐기 이벤트를 기록.",
        "C4": "교육 시간, 현장, 단말, 관리자 권한과 중복 이벤트를 검증해 유효한 단일 교육 이벤트만 인정.",
        "C5": "작업조·위치·시간·보호구·점검사항을 기준으로 TBM과 위험성평가 라이브러리를 자동 연결.",
        "C6": "현장 발화와 교육 문구를 원문, 정규화문, 번역문으로 함께 저장하고 사전/모델 버전을 남김.",
        "C7": "관리자와 외국인 근로자 간 1:1 대화에서 위험 표현을 탐지하고 관련 증거와 연결.",
        "C8": "퀴즈 응답을 점수화해 이수, 미이수, 재교육 필요 상태로 분류하고 보충 콘텐츠로 연결.",
        "C9": "위험성평가와 안전약속을 근로자에게 제시하고 전자서명 또는 PIN/생체 확인으로 증빙.",
        "C10": "모든 증거 payload를 정규화 직렬화한 뒤 SHA 계열 해시와 체인 해시로 무결성을 검증.",
        "C11": "보고서 생성 시 검증 ID, QR, 검증 URL, report_hash를 함께 제공해 외부 진위 확인 가능.",
        "C12": "작업중지 또는 안전신고를 다국어로 접수하고 담당 관리자에게 라우팅하며 조치 이력을 보존.",
        "C13": "TBM, 서명, 퀴즈, 출입, 대화, 신고 이력을 집계해 ESG/안전 보고서로 내보냄.",
        "C14": "태그 인식에서 교육, 퀴즈, 응답, 약속, 보고서 생성까지의 방법 청구 단계 흐름.",
        "C15": "안전대화 로그에서 위험키워드를 추출해 작업중지 신호, 증거 연결, 해시 감사 이벤트를 생성.",
    }[claim]
    text(d, (160, 610), explanation, 26, INK, False, max_width=1240)
    rounded(d, (120, 835, 1480, 910), 18, "#EFF6FF", "#BFDBFE", 2)
    text(d, (160, 858), "특허사무실 전달용: 실제 UI 화면 캡처와 함께 명세서 도면/설명 보조자료로 사용", 24, BLUE, True)
    safe = "".join(ch if ch.isalnum() or ch in ("_", "-", "~") else "_" for ch in title_s.replace(" ", "_"))
    img.save(PATENT_DIR / f"{claim}_{safe}.png")


def make_patent_assets():
    PATENT_DIR.mkdir(parents=True, exist_ok=True)
    for claim, title_s, nodes, accent in CLAIMS:
        make_claim_image(claim, title_s, nodes, accent)
    make_index()


def make_index():
    lines = [
        "# SAFE-LINK v2.0 특허출원 참고 이미지 목록",
        "",
        "생성일: 2026-06-01",
        "",
        "| 청구항 | 이미지 파일 | 용도 |",
        "| --- | --- | --- |",
    ]
    for claim, title_s, _, _ in CLAIMS:
        filename = next(PATENT_DIR.glob(f"{claim}_*.png")).name
        lines.append(f"| {claim} | {filename} | {title_s} 설명 도면 |")
    (PATENT_DIR / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    make_worker_assets()
    make_patent_assets()
    print(f"worker_dir={WORKER_DIR}")
    print(f"patent_dir={PATENT_DIR}")
