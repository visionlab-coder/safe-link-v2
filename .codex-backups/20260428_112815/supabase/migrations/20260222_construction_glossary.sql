-- ============================================================
-- SAFE-LINK: 건설현장 전역 용어 사전 (어느 현장에서든 공유)
-- 테이블: construction_glossary
-- 설명: site_id 없이 모든 현장에서 공통 사용하는 전역 은어 DB
-- ============================================================

-- 1. 전역 은어 사전 테이블
CREATE TABLE IF NOT EXISTS public.construction_glossary (
    id          BIGSERIAL PRIMARY KEY,
    slang       TEXT NOT NULL UNIQUE,          -- 은어 (일본어 잔재 등)
    standard    TEXT NOT NULL,                  -- 표준어
    category    TEXT NOT NULL DEFAULT '기타',   -- 분류 (시설/장비, 작업, 인원, 안전, 행정 등)
    origin_lang TEXT DEFAULT 'ja',             -- 어원 언어 코드 (ja=일본어, etc)
    origin_word TEXT,                           -- 원어 표기 (e.g. 足場)
    note        TEXT,                           -- 비고
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 다국어 현장 용어 매칭 테이블 (15개국 외국인 근로자용)
CREATE TABLE IF NOT EXISTS public.site_term_translations (
    id              BIGSERIAL PRIMARY KEY,
    glossary_id     BIGINT REFERENCES public.construction_glossary(id) ON DELETE CASCADE,
    pivot_en        TEXT NOT NULL,              -- 영어 기준어 (Pivot)
    lang_code       TEXT NOT NULL,              -- 언어코드 (vi, th, ph, uz, mn 등)
    local_slang     TEXT NOT NULL,              -- 현지 현장 은어
    local_phonetic  TEXT,                       -- 한국어 발음 표기
    colonial_origin TEXT,                       -- 어원 (佛, 西, 露 등)
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. RLS 설정: 모든 인증 사용자가 읽기 가능 (쓰기는 관리자만)
ALTER TABLE public.construction_glossary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_term_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_glossary"
    ON public.construction_glossary FOR SELECT
    USING (TRUE);

CREATE POLICY "admin_can_manage_glossary"
    ON public.construction_glossary FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

CREATE POLICY "anyone_can_read_translations"
    ON public.site_term_translations FOR SELECT
    USING (TRUE);

CREATE POLICY "admin_can_manage_translations"
    ON public.site_term_translations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- 4. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_glossary_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_glossary_updated_at
    BEFORE UPDATE ON public.construction_glossary
    FOR EACH ROW EXECUTE FUNCTION update_glossary_timestamp();

-- ============================================================
-- SEED: 건설현장 은어 사전 (카테고리별)
-- ============================================================

INSERT INTO public.construction_glossary (slang, standard, category, origin_lang, origin_word, note) VALUES
-- 시설/자재
('함바',     '현장 구내식당',               '시설',   'ja', '飯場(Hanba)',          NULL),
('공구리',   '콘크리트',                    '자재',   'ja', 'コンクリート',         '타설 작업 통칭'),
('빠루',     '쇠지렛대(노루발못뽑이)',       '도구',   'ja', 'バール(Baru)',          NULL),
('빠이프',   '파이프',                      '자재',   'ja', 'パイプ',               NULL),
('스라브',   '슬래브',                      '자재',   'ja', 'スラブ',               NULL),
('슬라브',   '슬래브',                      '자재',   'ja', 'スラブ',               NULL),
('몰탈',     '모르타르',                    '자재',   'ja', 'モルタル',             NULL),
('몰타르',   '모르타르',                    '자재',   'ja', 'モルタル',             NULL),
('시멘트풀', '모르타르',                    '자재',   'ko', NULL,                   '현장 혼용어'),
('빠대',     '퍼티(마감재)',                '자재',   'ja', 'パテ',                 NULL),
('빠데',     '퍼티(마감재)',                '자재',   'ja', 'パテ',                 NULL),
('레미콘',   '레디믹스 콘크리트',           '자재',   'en', 'Ready-Mixed Concrete', 'Ready Mixed CONcrete 약어'),
('갱폼',     '대형 거푸집',                 '자재',   'en', 'Gang Form',            NULL),
('비계',     '가설발판(작업용 비계)',        '시설',   'ja', '飛階',                 NULL),
('족장',     '작업용 비계',                 '시설',   'ko', NULL,                   NULL),
('먹줄',     '먹선(기준선 표시줄)',          '도구',   'ko', NULL,                   NULL),
('먹선',     '기준선',                      '도구',   'ko', NULL,                   NULL),
('쫄대',     '스페이서(간격 유지재)',        '자재',   'ko', NULL,                   NULL),
('단열재',   '보온 단열재',                 '자재',   'ko', NULL,                   NULL),
('가꾸목',   '각목(사각형 단면 목재)',       '자재',   'ja', '角木(Kaku-moku)',      NULL),
('가다와꾸', '거푸집',                      '자재',   'ja', '型枠(Kata-waku)',      NULL),
('가베',     '벽, 벽체',                    '자재',   'ja', '壁(Kabe)',             NULL),
('가이당',   '계단',                        '시설',   'ja', '階段(Kaidan)',         NULL),
('가네',     '직각',                        '검사',   'ja', '矩(Kane)',             '가네가 안 맞다 = 직각이 아님'),
('가랑',     '수도꼭지',                    '설비',   'ja', 'カラン(Karan)',        '네덜란드어 Kraan 유래'),
('가시메',   '리벳, 이음매 조임',           '작업',   'ja', '加締め(Kashime)',      NULL),
('겐바',     '현장',                        '기타',   'ja', '現場(Genba)',          NULL),
('게꼬미',   '챌판(계단 수직면)',            '시설',   'ja', '蹴込み(Kekomi)',      NULL),
('고테',     '흙손(미장용 도구)',             '도구',   'ja', '鏝(Kote)',             NULL),
('기리',     '드릴 날, 송곳',               '도구',   'ja', '錐(Kiri)',             NULL),
('기리빠시', '자투리(쓰고 남은 조각)',       '자재',   'ja', '切り端(Kirippashi)',  NULL),
('기리바리', '버팀대',                      '자재',   'ja', '切り張り(Kiribari)',  NULL),
('나라시',   '고르기, 평탄화',              '작업',   'ja', '均し(Narashi)',        '땅을 평평하게 함'),
('노미',     '끌, 정',                      '도구',   'ja', '鑿(Nomi)',             '콘크리트 파쇄 도구'),
('다가네',   '정(철공용)',                   '도구',   'ja', '鏨(Tagane)',           NULL),
('다루끼',   '서까래, 각목',                '자재',   'ja', '垂木(Taruki)',         '작은 각재'),
('덴조',     '천장',                        '시설',   'ja', '天井(Tenjo)',          NULL),
('도비',     '비계공(중량물 설치공)',         '인원',   'ja', '鳶(Tobi)',             NULL),
('루베',     '입방미터 (m³)',               '단위',   'ja', '立米(Ryube)',          '부피 단위'),
('헤베',     '평방미터 (m²)',               '단위',   'ja', '平米(Heibe)',          '면적 단위'),
('마구사',   '인방(창·문 위 가로재)',        '자재',   'ja', '楣(Magusa)',           NULL),
('메지',     '줄눈(타일·벽돌 사이 틈)',     '자재',   'ja', '目地(Meji)',           NULL),
('반생',     '결속선(굵은 철사)',            '자재',   'ja', '番線(Bansen)',         NULL),
('바라시',   '해체, 뜯기',                  '작업',   'ja', '晴らし(Barashi)',     '거푸집 해체 등'),
('사시낑',   '삽입근(이어치기용 철근)',       '자재',   'ja', '差し筋(Sashikin)',   NULL),
('시아게',   '마무리(최종 손질)',             '작업',   'ja', '仕上げ(Shiage)',      NULL),
('아시바',   '비계(작업 발판)',              '시설',   'ja', '足場(Ashiba)',         NULL),
('야리끼리', '도급·할당제',                 '작업',   'ja', '遣り切り(Yarikiri)', '할당량 채우면 퇴근'),
('우마',     '말비계(발판용 받침대)',         '도구',   'ja', '馬(Uma)',              NULL),
('젠다이',   '창대, 선반',                  '시설',   'ja', '膳台(Zendai)',         NULL),
('하리',     '보 (Beam)',                   '구조',   'ja', '梁(Hari)',             '기둥 위 가로재'),
('하시라',   '기둥 (Column)',               '구조',   'ja', '柱(Hashira)',          NULL),
('하스리',   '쪼아내기(콘크리트 표면 정리)', '작업',   'ja', '斫り(Hatsuri)',       NULL),
('호이스트', '권상기(자재 들어올리는 기계)', '장비',   'en', 'Hoist',               NULL),
('가설',     '임시 설치',                   '행정',   'ja', '仮設(Kasetsu)',        NULL),
('공기',     '공사 기간',                   '행정',   'ja', '工期(Koki)',           NULL),
('시방서',   '공사 설명서',                 '행정',   'ja', '示方書(Shihosho)',     NULL),
('가건물',   '임시 건물',                   '행정',   'ja', '假建物',               NULL),
('하치장',   '짐 두는 곳',                  '시설',   'ja', '荷置場',              '유통/현장 자재 야적'),
('부지',     '터',                          '행정',   'ja', '敷地',                '부동산/건설'),
-- 작업 행위
('단도리',   '작업 준비 및 점검',           '작업',   'ja', '段取り(Dandori)',     NULL),
('타설',     '콘크리트 타설(붓기)',          '작업',   'ja', '打設(Dasetsu)',       NULL),
('양생',     '콘크리트 양생(강도 확보 대기)','작업',  'ja', '養生(Yousei)',        NULL),
('탈형',     '거푸집 해체',                 '작업',   'ja', '脱型(Dakkei)',        NULL),
('배근',     '철근 배치',                   '작업',   'ja', '配筋(Haikin)',         NULL),
('쑤심',     '그라우팅(주입)',               '작업',   'ko', NULL,                   NULL),
('시마이',   '작업 종료, 마감',             '작업',   'ja', '仕舞い(Shimai)',      NULL),
('나가리',   '무산, 허사',                  '기타',   'ja', '流れ(Nagare)',         '흘러감'),
-- 도구
('오함마',   '대형 망치',                   '도구',   'ja', '大ハンマー(O-Hamma)', NULL),
('노기스',   '버니어 캘리퍼스',             '도구',   'ja', 'ノギス(Nogisu)',      '독일어 Nonius 유래'),
('야스리',   '줄(연마 도구)',                '도구',   'ja', '鑢(Yasuri)',          NULL),
('임팩',     '임팩트 렌치',                 '도구',   'en', 'Impact Wrench',       NULL),
('후렌지',   '플랜지(관 이음)',              '도구',   'en', 'Flange',              NULL),
('보루방',   '드릴링 머신',                 '장비',   'ja', 'ボール盤(Boruban)',   '네덜란드어 Boor-bank 유래'),
('샤클',     '섀클(연결 고리)',              '도구',   'en', 'Shackle',             NULL),
('바께쓰',   '양동이',                      '도구',   'ja', 'バケツ(Baketsu)',     'Bucket'),
('단카',     '들것',                        '안전',   'ja', '担架(Tanka)',          NULL),
('스덴',     '스테인리스',                  '자재',   'en', 'Stainless',           NULL),
-- 작업자/인원
('노가다',   '현장 인부',                   '인원',   'ja', '土方(Dokata)',         '건설 노동자(비하어, 사용 자제)'),
('오야지',   '현장 반장/팀장',             '인원',   'ja', '親父(Oyaji)',          NULL),
('오야',     '현장 반장',                   '인원',   'ja', '親(Oya)',              NULL),
('막둥이',   '신입 작업자',                 '인원',   'ko', NULL,                   NULL),
('십장',     '작업 반장',                   '인원',   'ja', '十長',                 NULL),
('십장패',   '작업반(팀)',                   '인원',   'ko', NULL,                   NULL),
('외장공',   '외벽 마감 작업자',            '인원',   'ko', NULL,                   NULL),
('내장공',   '내부 마감 작업자',            '인원',   'ko', NULL,                   NULL),
('철근공',   '철근 배근 작업자',            '인원',   'ko', NULL,                   NULL),
('형틀목수', '거푸집 목수',                 '인원',   'ko', NULL,                   NULL),
('데모도',   '보조공, 조수',                '인원',   'ja', '手元(Temoto)',         '기술자 보조'),
('고참',     '선임',                        '인원',   'ja', '古參',                 '군대/현장 통용'),
('견습',     '수습',                        '인원',   'ja', '見習',                 NULL),
-- 안전/위험
('아찔했어', '아차 사고 발생',              '안전',   'ko', NULL,                   NULL),
('아차사고', '경미한 안전사고',             '안전',   'ko', NULL,                   NULL),
('위험한 데','위험 구역',                   '안전',   'ko', NULL,                   NULL),
('떨어질 뻔','추락 위험 발생',             '안전',   'ko', NULL,                   NULL),
('낄 뻔',   '협착 위험 발생',              '안전',   'ko', NULL,                   NULL),
('맞을 뻔', '낙하물 위험 발생',            '안전',   'ko', NULL,                   NULL),
('안전모',  '안전 헬멧(의무 착용)',         '안전',   'ko', NULL,                   NULL),
('끼임',    '협착 사고',                   '안전',   'ko', NULL,                   NULL),
('깔림',    '압착 사고',                   '안전',   'ko', NULL,                   NULL),
('하이바',  '안전모(Fiber 헬멧)',           '안전',   'ja', 'ファイバー(Faiba)',    'Fiber의 일본식 발음'),
-- 상태/품질
('기스',    '흠집, 스크래치',              '상태',   'ja', '傷(Kizu)',             NULL),
('빠꾸',    '불량, 반품',                  '상태',   'ja', 'バック(Back)',         '후진 또는 불량'),
('엔꼬',    '연료 바닥남, 방전',           '상태',   'ja', 'エンコ(Enko)',         NULL),
('쇼트',    '합선(Short Circuit)',          '상태',   'en', 'Short',               NULL),
-- 행정/계약
('가계약',  '임시 계약',                   '행정',   'ja', '假契約',               NULL),
('가불',    '임시 지급',                   '행정',   'ja', '假拂',                 NULL),
('가처분',  '임시 처분',                   '행정',   'ja', '假處分',               '법률'),
('각서',    '다짐 글',                     '행정',   'ja', '覺書',                 NULL),
('견적',    '추산',                        '행정',   'ja', '見積',                 NULL),
('납기',    '납품 기한',                   '행정',   'ja', '納期',                 NULL),
('내역',    '명세',                        '행정',   'ja', '內譯',                 NULL),
('노임',    '품삯',                        '행정',   'ja', '勞賃',                 NULL),
('대금',    '값',                          '행정',   'ja', '代金',                 NULL),
('시말서',  '경위서',                      '행정',   'ja', '始末書',               NULL),
('식대',    '밥값',                        '행정',   'ja', '食代',                 NULL),
('식비',    '밥값',                        '행정',   'ja', '食費',                 NULL),
('공임',    '품삯',                        '행정',   'ja', '工賃',                 NULL),
('명기',    '분명히 기록',                 '행정',   'ja', '明記',                 NULL),
('납입',    '납부',                        '행정',   'ja', '納入',                 NULL),
('지불',    '지급',                        '행정',   'ja', '支拂',                 NULL),
('회람',    '돌려봄',                      '행정',   'ja', '回覽',                 NULL),
('공람',    '돌려봄',                      '행정',   'ja', '供覽',                 NULL),
('절취선',  '자르는 선',                   '행정',   'ja', '切取線',               NULL),
('게양',    '올림(달기)',                   '행정',   'ja', '揭揚',                 NULL),
('망년회',  '송년회',                      '행정',   'ja', '忘年會',               NULL),
-- 기타 현장어
('짬',      '작업 여유시간',               '기타',   'ko', NULL,                   NULL),
('마이',    '많이',                        '기타',   'ko', NULL,                   '경상도 방언화'),
('쪼끔',    '조금',                        '기타',   'ko', NULL,                   NULL),
('겁나',    '매우',                        '기타',   'ko', NULL,                   NULL),
('엄청',    '매우',                        '기타',   'ko', NULL,                   NULL),
('빨리빨리','신속하게',                    '기타',   'ko', NULL,                   NULL),
('칼같이',  '정확하게',                    '기타',   'ko', NULL,                   NULL),
('쭉',      '계속해서',                    '기타',   'ko', NULL,                   NULL),
('뻥',      '막힘(배관 막힘 또는 터짐)',   '기타',   'ko', NULL,                   NULL),
('만땅',    '가득 채움',                   '기타',   'ja', '満タン(Mantan)',       NULL),
('입빠이',  '가득, 한껏',                  '기타',   'ja', '一杯(Ippai)',          NULL),
('유도리',  '융통성, 여유(공차)',           '기타',   'ja', 'ゆとり(Yutori)',      NULL),
('쿠세',    '기계의 특이한 습성',           '기타',   'ja', '癖(Kuse)',             NULL)
ON CONFLICT (slang) DO UPDATE
    SET standard = EXCLUDED.standard,
        category = EXCLUDED.category,
        origin_lang = EXCLUDED.origin_lang,
        origin_word = EXCLUDED.origin_word,
        note = EXCLUDED.note;

-- ============================================================
-- SEED: 다국어 현장 용어 매칭 (15개국)
-- ============================================================

INSERT INTO public.site_term_translations (glossary_id, pivot_en, lang_code, local_slang, local_phonetic, colonial_origin, note)
SELECT g.id, '결속선 (Binding Wire)', 'vi', 'Kẽm buộc', '껨 북', '佛(프랑스어)', NULL FROM public.construction_glossary g WHERE g.slang = '반생'
UNION ALL
SELECT g.id, '결속선 (Binding Wire)', 'th', 'Luat', '루앗', NULL, 'Luat Pook Lek의 단축형' FROM public.construction_glossary g WHERE g.slang = '반생'
UNION ALL
SELECT g.id, '결속선 (Binding Wire)', 'ph', 'Alambre', '알람브레', '西(스페인어)', NULL FROM public.construction_glossary g WHERE g.slang = '반생'
UNION ALL
SELECT g.id, '결속선 (Binding Wire)', 'id', 'Kawat Beton', '카왓 베톤', NULL, '콘크리트용 철사' FROM public.construction_glossary g WHERE g.slang = '반생'
UNION ALL
SELECT g.id, '결속선 (Binding Wire)', 'uz', 'Sim / Vyazka', '심/비야즈카', '露(러시아어)', NULL FROM public.construction_glossary g WHERE g.slang = '반생'
UNION ALL
SELECT g.id, '결속선 (Binding Wire)', 'mn', 'Төмөр утас', '투무르 우타스', NULL, '철+실의 합성어' FROM public.construction_glossary g WHERE g.slang = '반생'
UNION ALL
SELECT g.id, '결속선 (Binding Wire)', 'lk', 'Kambi', '캄비', NULL, NULL FROM public.construction_glossary g WHERE g.slang = '반생'
UNION ALL
SELECT g.id, '결속선 (Binding Wire)', 'kh', 'Khsae luos', '크싸에 루어', '佛(프랑스어)', NULL FROM public.construction_glossary g WHERE g.slang = '반생'
UNION ALL
SELECT g.id, '결속선 (Binding Wire)', 'bd', 'GI Tar', '지아이 타르', '英(영어)', 'Galvanized Iron Tar(Wire) 약어' FROM public.construction_glossary g WHERE g.slang = '반생'
UNION ALL
SELECT g.id, '결속선 (Binding Wire)', 'np', 'Tar', '타르', '英(힌디어)', NULL FROM public.construction_glossary g WHERE g.slang = '반생'
UNION ALL
SELECT g.id, '결속선 (Binding Wire)', 'mm', 'Than-kyo', '딴쪼', NULL, NULL FROM public.construction_glossary g WHERE g.slang = '반생'
UNION ALL
SELECT g.id, '결속선 (Binding Wire)', 'pk', 'Taar', '타르', '英(우르두어)', 'Binding Taar 혼용' FROM public.construction_glossary g WHERE g.slang = '반생'
UNION ALL
SELECT g.id, '결속선 (Binding Wire)', 'tl', 'Arame', '아라메', '葡(포르투갈어)', NULL FROM public.construction_glossary g WHERE g.slang = '반생'
UNION ALL
SELECT g.id, '결속선 (Binding Wire)', 'zh', 'Tiěsī', '티에쓰', NULL, '철사(鐵絲)' FROM public.construction_glossary g WHERE g.slang = '반생'
-- 오함마 (대형 망치)
UNION ALL
SELECT g.id, '대형 망치 (Sledgehammer)', 'vi', 'Búa tạ', '부아 따', NULL, '망치+무거운' FROM public.construction_glossary g WHERE g.slang = '오함마'
UNION ALL
SELECT g.id, '대형 망치 (Sledgehammer)', 'th', 'Khon Pond', '콘 뽄', '英(영어)', 'Pound Hammer의 태국식 변형' FROM public.construction_glossary g WHERE g.slang = '오함마'
UNION ALL
SELECT g.id, '대형 망치 (Sledgehammer)', 'ph', 'Maso', '마소', '西(스페인어)', 'Mazo에서 유래' FROM public.construction_glossary g WHERE g.slang = '오함마'
UNION ALL
SELECT g.id, '대형 망치 (Sledgehammer)', 'id', 'Palu Bodem', '팔루 보뎀', NULL, '큰 망치' FROM public.construction_glossary g WHERE g.slang = '오함마'
UNION ALL
SELECT g.id, '대형 망치 (Sledgehammer)', 'uz', 'Kuwolda', '쿠발다', '露(러시아어)', 'Kuvalda' FROM public.construction_glossary g WHERE g.slang = '오함마'
UNION ALL
SELECT g.id, '대형 망치 (Sledgehammer)', 'mn', 'Lantuu', '란투', NULL, NULL FROM public.construction_glossary g WHERE g.slang = '오함마'
UNION ALL
SELECT g.id, '대형 망치 (Sledgehammer)', 'tl', 'Martelu Boot', '마르텔루 붓', '葡(포르투갈어)', 'Martelo(망치)+Boot(큰)' FROM public.construction_glossary g WHERE g.slang = '오함마'
UNION ALL
SELECT g.id, '대형 망치 (Sledgehammer)', 'zh', 'Dà chuí', '따 추이', NULL, '大槌' FROM public.construction_glossary g WHERE g.slang = '오함마'
-- 공구리 (콘크리트)
UNION ALL
SELECT g.id, '콘크리트 (Concrete)', 'vi', 'Bê tông', '베 똥', '佛(프랑스어)', 'Béton에서 유래' FROM public.construction_glossary g WHERE g.slang = '공구리'
UNION ALL
SELECT g.id, '콘크리트 (Concrete)', 'th', 'Poon', '뿐', NULL, '시멘트/콘크리트 통칭' FROM public.construction_glossary g WHERE g.slang = '공구리'
UNION ALL
SELECT g.id, '콘크리트 (Concrete)', 'ph', 'Buhos', '부호스', NULL, '붓다(Pour) 행위를 콘크리트로 지칭' FROM public.construction_glossary g WHERE g.slang = '공구리'
UNION ALL
SELECT g.id, '콘크리트 (Concrete)', 'uz', 'Beton', '베톤', '露(러시아어)', NULL FROM public.construction_glossary g WHERE g.slang = '공구리'
UNION ALL
SELECT g.id, '콘크리트 (Concrete)', 'mn', 'Beton', '베톤', '露(러시아어)', NULL FROM public.construction_glossary g WHERE g.slang = '공구리'
UNION ALL
SELECT g.id, '콘크리트 (Concrete)', 'kh', 'Betong', '베똥', '佛(프랑스어)', NULL FROM public.construction_glossary g WHERE g.slang = '공구리'
UNION ALL
SELECT g.id, '콘크리트 (Concrete)', 'bd', 'Dhalai', '달라이', NULL, 'Casting/Pouring 의미' FROM public.construction_glossary g WHERE g.slang = '공구리'
UNION ALL
SELECT g.id, '콘크리트 (Concrete)', 'tl', 'Betaun', '베타운', '葡(포르투갈어)', 'Betão' FROM public.construction_glossary g WHERE g.slang = '공구리'
-- 하이바 (안전모)
UNION ALL
SELECT g.id, '안전모 (Safety Helmet)', 'vi', 'Mũ bảo hộ', '무 바오 호', NULL, '보호 모자' FROM public.construction_glossary g WHERE g.slang = '하이바'
UNION ALL
SELECT g.id, '안전모 (Safety Helmet)', 'th', 'Muak Safety', '무악 세이프티', NULL, 'Muak=모자' FROM public.construction_glossary g WHERE g.slang = '하이바'
UNION ALL
SELECT g.id, '안전모 (Safety Helmet)', 'ph', 'Hard Hat', '하드 햇', '英(영어)', '미국 영향' FROM public.construction_glossary g WHERE g.slang = '하이바'
UNION ALL
SELECT g.id, '안전모 (Safety Helmet)', 'id', 'Helm Proyek', '헬름 프로옉', NULL, '프로젝트 헬멧' FROM public.construction_glossary g WHERE g.slang = '하이바'
UNION ALL
SELECT g.id, '안전모 (Safety Helmet)', 'uz', 'Kaska', '카스카', '露(러시아어)', 'Каска' FROM public.construction_glossary g WHERE g.slang = '하이바'
UNION ALL
SELECT g.id, '안전모 (Safety Helmet)', 'tl', 'Kapasete', '카파세테', '葡(포르투갈어)', 'Capacete' FROM public.construction_glossary g WHERE g.slang = '하이바'
-- 기스 (흠집)
UNION ALL
SELECT g.id, '흠집 (Scratch)', 'vi', 'Vết xước', '벳 씅', NULL, NULL FROM public.construction_glossary g WHERE g.slang = '기스'
UNION ALL
SELECT g.id, '흠집 (Scratch)', 'ph', 'Gasgas', '가스가스', NULL, 'Tagalog로 긁힘' FROM public.construction_glossary g WHERE g.slang = '기스'
UNION ALL
SELECT g.id, '흠집 (Scratch)', 'uz', 'Tsarapina', '차라피나', '露(러시아어)', NULL FROM public.construction_glossary g WHERE g.slang = '기스'
UNION ALL
SELECT g.id, '흠집 (Scratch)', 'zh', 'Huahen', '화흔', NULL, '劃痕' FROM public.construction_glossary g WHERE g.slang = '기스'
-- 빠꾸 (불량/반품)
UNION ALL
SELECT g.id, '불량/반품 (Reject)', 'vi', 'Trả lại', '짜 라이', NULL, '반품' FROM public.construction_glossary g WHERE g.slang = '빠꾸'
UNION ALL
SELECT g.id, '불량/반품 (Reject)', 'ph', 'Reject / Atrás', '리젝트/아트라스', '西(스페인어)', 'Atrás=후진(後退)' FROM public.construction_glossary g WHERE g.slang = '빠꾸'
UNION ALL
SELECT g.id, '불량/반품 (Reject)', 'uz', 'Brak', '브라크', '露(러시아어)', '불량(Брак)' FROM public.construction_glossary g WHERE g.slang = '빠꾸';

-- 인덱스 추가 (검색 최적화)
CREATE INDEX IF NOT EXISTS idx_glossary_slang ON public.construction_glossary(slang);
CREATE INDEX IF NOT EXISTS idx_glossary_category ON public.construction_glossary(category);
CREATE INDEX IF NOT EXISTS idx_translations_glossary ON public.site_term_translations(glossary_id);
CREATE INDEX IF NOT EXISTS idx_translations_lang ON public.site_term_translations(lang_code);
