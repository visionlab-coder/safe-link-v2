package com.safelink.v3.quiz;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.ai.AiQuotaService;
import com.safelink.v3.ai.AiVendorService;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import com.safelink.v3.support.NotFoundException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/quiz")
public class QuizController {
    private static final Pattern JSON_ARRAY_PATTERN = Pattern.compile("(\\[[\\s\\S]*])");
    private static final List<SeedQuestion> FALLBACK_POOL = List.of(
        new SeedQuestion("추락방지", "고소작업(2m 이상) 시 반드시 착용해야 할 안전장비는?", List.of("안전대(안전벨트)", "방진마스크", "차광안경", "귀마개"), 0),
        new SeedQuestion("안전모", "건설현장에서 안전모를 착용하는 주된 이유는?", List.of("낙하물로부터 머리 보호", "자외선 차단", "보온 유지", "신호 식별"), 0),
        new SeedQuestion("화재예방", "용접·절단 작업 전 반드시 해야 할 조치는?", List.of("주변 가연성 물질 제거", "환기팬 끄기", "방화포 제거", "물 뿌리기"), 0),
        new SeedQuestion("전기안전", "젖은 손으로 전기 기기를 만지면 안 되는 이유는?", List.of("감전 위험 증가", "기기 부식", "화재 발생", "소음 증가"), 0),
        new SeedQuestion("개인보호구", "분진이 발생하는 작업 시 착용해야 할 보호구는?", List.of("방진마스크", "방음 귀마개", "차광 안경", "안전화"), 0),
        new SeedQuestion("중량물취급", "무거운 물건을 혼자 들 때 올바른 자세는?", List.of("무릎을 굽히고 허리를 세운 자세", "허리를 구부려 빠르게 들기", "한 손으로 들기", "발끝으로 서서 들기"), 0),
        new SeedQuestion("정리정돈", "작업장 정리정돈이 중요한 주된 이유는?", List.of("넘어짐·충돌 사고 예방", "작업 속도 향상", "도구 보호", "청결 유지"), 0),
        new SeedQuestion("안전통로", "현장 통로에 자재를 쌓아두면 안 되는 이유는?", List.of("대피로 차단 및 사고 위험", "미관 저해", "자재 손상", "규정상 불필요"), 0),
        new SeedQuestion("화학물질", "유해 화학물질을 취급할 때 가장 먼저 해야 할 일은?", List.of("MSDS(물질안전보건자료) 확인", "맨손으로 취급", "냄새로 확인", "폐기 처리"), 0),
        new SeedQuestion("굴착안전", "굴착작업 시 주변 지반 침하를 막기 위해 설치하는 것은?", List.of("흙막이 지보공", "방호 울타리", "안전망", "추락방지대"), 0),
        new SeedQuestion("TBM목적", "TBM(Tool Box Meeting)의 주요 목적은?", List.of("작업 전 위험요소 공유 및 안전 확인", "작업 성과 평가", "인원 점호", "도구 배분"), 0),
        new SeedQuestion("신호수", "중장비 후진 시 신호수의 역할은?", List.of("장비 이동 방향을 안내하고 충돌을 예방", "짐을 실어주기", "연료 보충", "기계 점검"), 0)
    );

    private final JdbcClient jdbc;
    private final ObjectMapper objectMapper;
    private final SiteGuard siteGuard;
    private final AuditService audit;
    private final AiQuotaService quota;
    private final AiVendorService vendor;

    public QuizController(JdbcClient jdbc, ObjectMapper objectMapper, SiteGuard siteGuard, AuditService audit, AiQuotaService quota, AiVendorService vendor) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.siteGuard = siteGuard;
        this.audit = audit;
        this.quota = quota;
        this.vendor = vendor;
    }

    @GetMapping("/tbm-sessions")
    public Map<String, List<Map<String, Object>>> tbmSessions(@AuthenticationPrincipal SessionPrincipal actor) {
        requireQuizAdmin(actor);
        var rows = listTbmSessions(actor).stream()
            .map(row -> {
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", String.valueOf(row.id()));
                item.put("title", row.title());
                item.put("started_at", row.startedAt().toString());
                item.put("status", row.status());
                item.put("tbm_notices", Map.of(
                    "content_ko", row.contentKo() == null ? "" : row.contentKo(),
                    "title", row.noticeTitle() == null ? "" : row.noticeTitle()
                ));
                return item;
            })
            .toList();
        return Map.of("sessions", rows);
    }

    @GetMapping("/sessions")
    public Map<String, List<QuizSessionSummary>> sessions(@AuthenticationPrincipal SessionPrincipal actor) {
        requireQuizAdmin(actor);
        return Map.of("sessions", listQuizSessions(actor));
    }

    @GetMapping("/responses")
    public Map<String, List<QuizResponseSummary>> responses(@AuthenticationPrincipal SessionPrincipal actor, @RequestParam String quizSessionId) {
        requireQuizAdmin(actor);
        QuizSessionRow session = getQuizSession(parseLong(quizSessionId, "quizSessionId_invalid"));
        siteGuard.requireSiteAccess(actor, session.siteId(), "quiz.responses.read", "tbm_quiz_session", quizSessionId);
        return Map.of("responses", listResponses(session.id()));
    }

    @PostMapping("/generate")
    @Transactional
    public GenerateResponse generate(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody GenerateRequest request) {
        requireQuizAdmin(actor);
        GeneratedQuiz generated = createQuizSession(actor, request.tbmSessionId(), request.tbmText(), request.maxQuestions());
        return new GenerateResponse(generated.questions(), generated.tbmSessionId() == null ? null : String.valueOf(generated.tbmSessionId()), String.valueOf(generated.quizSessionId()), generated.source());
    }

    @GetMapping("/generate")
    public Map<String, List<Map<String, Object>>> generatedSessions(@AuthenticationPrincipal SessionPrincipal actor, @RequestParam String tbmSessionId) {
        requireQuizAdmin(actor);
        Long parsedTbmSessionId = parseLong(tbmSessionId, "tbmSessionId_invalid");
        TbmSessionRow tbmSession = getTbmSession(parsedTbmSessionId);
        siteGuard.requireSiteAccess(actor, tbmSession.siteId(), "quiz.session.read", "tbm_session", tbmSessionId);
        var rows = jdbc.sql("""
                select id, tbm_session_id, site_id, questions::text as questions, status, source, sent_at, created_at
                from tbm_quiz_sessions
                where tbm_session_id = :tbmSessionId
                order by created_at desc
                limit 5
            """)
            .param("tbmSessionId", parsedTbmSessionId)
            .query((rs, rowNum) -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", String.valueOf(rs.getLong("id")));
                row.put("tbm_session_id", String.valueOf(rs.getLong("tbm_session_id")));
                row.put("site_id", String.valueOf(rs.getLong("site_id")));
                row.put("questions", parseQuestions(rs.getString("questions")));
                row.put("status", rs.getString("status"));
                row.put("source", rs.getString("source"));
                Timestamp sentAt = rs.getTimestamp("sent_at");
                row.put("sent_at", sentAt == null ? null : sentAt.toInstant().toString());
                row.put("created_at", rs.getTimestamp("created_at").toInstant().toString());
                return row;
            })
            .list();
        return Map.of("quizSessions", rows);
    }

    @PostMapping("/send")
    @Transactional
    public SendResponse send(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody SendRequest request) {
        requireQuizAdmin(actor);
        QuizSessionRow session = getQuizSession(parseLong(request.quizSessionId(), "quizSessionId_required"));
        siteGuard.requireSiteAccess(actor, session.siteId(), "quiz.send", "tbm_quiz_session", String.valueOf(session.id()));
        SendResult result = sendQuiz(actor, session, cleanOptionalLong(request.tbmSessionId(), "tbmSessionId_invalid"));
        return new SendResponse(result.sentCount(), result.langs());
    }

    @PostMapping("/daily")
    @Transactional
    public Map<String, Object> daily(@AuthenticationPrincipal SessionPrincipal actor) {
        requireQuizAdmin(actor);
        TbmSessionRow tbmSession = latestTbmSession(actor).orElse(null);
        GeneratedQuiz generated = createQuizSession(actor, tbmSession == null ? null : String.valueOf(tbmSession.id()), null, 3);
        QuizSessionRow quizSession = getQuizSession(generated.quizSessionId());
        SendResult sent = sendQuiz(actor, quizSession, generated.tbmSessionId());
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("ok", true);
        response.put("generated", true);
        response.put("sent", true);
        response.put("tbmSessionId", generated.tbmSessionId() == null ? null : String.valueOf(generated.tbmSessionId()));
        response.put("quizSessionId", String.valueOf(generated.quizSessionId()));
        response.put("source", generated.source());
        response.put("sentCount", sent.sentCount());
        return response;
    }

    @GetMapping("/worker-quiz")
    public Map<String, Object> workerQuiz(@AuthenticationPrincipal SessionPrincipal actor) {
        requireWorker(actor);
        var row = latestWorkerResponse(actor.userId());
        return Map.of("response", row.map(this::safeWorkerResponse).orElse(null));
    }

    @PostMapping("/respond")
    @Transactional
    public RespondResult respond(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody RespondRequest request) {
        requireWorker(actor);
        Long responseId = parseLong(request.quizResponseId(), "quizResponseId_required");
        WorkerQuizRow response = getWorkerQuizResponse(responseId, actor.userId());
        if ("answered".equals(response.status())) {
            throw new AlreadyAnsweredException(response.scorePct());
        }
        List<Integer> answers = request.answers() == null ? List.of() : request.answers();
        List<Integer> correctAnswers = parseIntegerList(response.answerIndexCorrectJson());
        if (answers.size() != correctAnswers.size()) {
            throw new IllegalArgumentException("invalid_answers_length");
        }
        int correct = 0;
        for (int i = 0; i < correctAnswers.size(); i++) {
            if (answers.get(i).equals(correctAnswers.get(i))) {
                correct++;
            }
        }
        int total = correctAnswers.size();
        int scorePct = total > 0 ? Math.round((correct * 100.0f) / total) : 0;
        int updated = jdbc.sql("""
                update tbm_quiz_responses
                set answers_submitted = cast(:answers as jsonb),
                    score_pct = :scorePct,
                    status = 'answered',
                    answered_at = now()
                where id = :id
                  and worker_id = :workerId
                  and status = 'sent'
            """)
            .param("answers", writeJson(answers))
            .param("scorePct", scorePct)
            .param("id", responseId)
            .param("workerId", actor.userId())
            .update();
        if (updated == 0) {
            throw new AlreadyAnsweredException(response.scorePct());
        }
        audit.record(actor.userId(), response.siteId(), "quiz.response.answer", "tbm_quiz_response", String.valueOf(responseId), "ALLOWED", "worker_answer", Map.of("scorePct", scorePct));
        return new RespondResult(true, scorePct, correct, total);
    }

    @GetMapping("/respond")
    public Map<String, Object> responseBySession(@AuthenticationPrincipal SessionPrincipal actor, @RequestParam String quizSessionId) {
        requireWorker(actor);
        Long parsedSessionId = parseLong(quizSessionId, "quizSessionId_required");
        var row = jdbc.sql("""
                select r.id, r.quiz_session_id, s.site_id, r.worker_id, r.lang,
                       r.questions_translated::text as questions_translated,
                       r.answer_index_correct::text as answer_index_correct,
                       r.answers_submitted::text as answers_submitted,
                       r.score_pct, r.status, r.answered_at, r.created_at
                from tbm_quiz_responses r
                join tbm_quiz_sessions s on s.id = r.quiz_session_id
                where r.quiz_session_id = :quizSessionId
                  and r.worker_id = :workerId
                limit 1
            """)
            .param("quizSessionId", parsedSessionId)
            .param("workerId", actor.userId())
            .query(this::mapWorkerQuizRow)
            .optional();
        return Map.of("response", row.map(this::safeWorkerResponse).orElse(null));
    }

    private GeneratedQuiz createQuizSession(SessionPrincipal actor, String tbmSessionId, String tbmText, Integer requestedMaxQuestions) {
        int maxQuestions = Math.max(1, Math.min(requestedMaxQuestions == null ? 3 : requestedMaxQuestions, 10));
        TbmSessionRow tbmSession = cleanOptionalLong(tbmSessionId, "tbmSessionId_invalid") == null ? null : getTbmSession(parseLong(tbmSessionId, "tbmSessionId_invalid"));
        Long siteId = tbmSession == null ? firstSiteId(actor) : tbmSession.siteId();
        if (siteId == null) {
            throw new IllegalArgumentException("site_id_required");
        }
        siteGuard.requireSiteAccess(actor, siteId, "quiz.generate", "site", String.valueOf(siteId));
        reserveQuizQuota(actor, siteId, "quiz.generate");

        String sourceText = clean(tbmText);
        if (sourceText.isBlank() && tbmSession != null && tbmSession.contentKo() != null) {
            sourceText = tbmSession.contentKo();
        }
        String source = sourceText.isBlank() ? "fallback" : "tbm";
        List<QuizQuestion> questions = source.equals("tbm")
            ? generateFromTbmText(sourceText, maxQuestions)
            : fallbackQuestions(maxQuestions);
        if (questions.isEmpty()) {
            source = "fallback";
            questions = fallbackQuestions(maxQuestions);
        }

        Long quizSessionId = jdbc.sql("""
                insert into tbm_quiz_sessions(tbm_session_id, site_id, questions, created_by, status, source)
                values (:tbmSessionId, :siteId, cast(:questions as jsonb), :createdBy, 'draft', :source)
                returning id
            """)
            .param("tbmSessionId", tbmSession == null ? null : tbmSession.id())
            .param("siteId", siteId)
            .param("questions", writeJson(questions))
            .param("createdBy", actor.userId())
            .param("source", source)
            .query(Long.class)
            .single();
        audit.record(actor.userId(), siteId, "quiz.session.create", "tbm_quiz_session", String.valueOf(quizSessionId), "ALLOWED", "server_api", Map.of("source", source, "questions", questions.size()));
        return new GeneratedQuiz(questions, tbmSession == null ? null : tbmSession.id(), quizSessionId, source);
    }

    private SendResult sendQuiz(SessionPrincipal actor, QuizSessionRow session, Long requestedTbmSessionId) {
        Long tbmSessionId = requestedTbmSessionId == null ? session.tbmSessionId() : requestedTbmSessionId;
        List<WorkerLangRow> workers = workerTargets(session.siteId(), tbmSessionId);
        if (workers.isEmpty()) {
            throw new IllegalArgumentException("no_workers_found");
        }
        reserveQuizQuota(actor, session.siteId(), "quiz.send");
        List<QuizQuestion> questions = parseQuestions(session.questionsJson());
        Map<String, List<TranslatedQuestion>> translatedByLang = new LinkedHashMap<>();
        for (WorkerLangRow worker : workers) {
            translatedByLang.computeIfAbsent(worker.lang(), lang -> translateQuestions(questions, lang));
        }

        for (WorkerLangRow worker : workers) {
            List<TranslatedQuestion> translated = translatedByLang.get(worker.lang());
            jdbc.sql("""
                    insert into tbm_quiz_responses(quiz_session_id, worker_id, lang, questions_translated, answer_index_correct, status)
                    values (:quizSessionId, :workerId, :lang, cast(:questions as jsonb), cast(:answers as jsonb), 'sent')
                    on conflict (quiz_session_id, worker_id)
                    do update set
                      lang = excluded.lang,
                      questions_translated = excluded.questions_translated,
                      answer_index_correct = excluded.answer_index_correct,
                      status = 'sent',
                      answers_submitted = null,
                      score_pct = null,
                      answered_at = null
                """)
                .param("quizSessionId", session.id())
                .param("workerId", worker.id())
                .param("lang", worker.lang())
                .param("questions", writeJson(translated))
                .param("answers", writeJson(questions.stream().map(QuizQuestion::answerIndex).toList()))
                .update();
        }

        jdbc.sql("update tbm_quiz_sessions set status = 'sent', sent_at = now() where id = :id")
            .param("id", session.id())
            .update();
        audit.record(actor.userId(), session.siteId(), "quiz.send", "tbm_quiz_session", String.valueOf(session.id()), "ALLOWED", "server_api", Map.of("sent", workers.size(), "langs", translatedByLang.keySet()));
        return new SendResult(workers.size(), new ArrayList<>(translatedByLang.keySet()));
    }

    private List<TranslatedQuestion> translateQuestions(List<QuizQuestion> questions, String lang) {
        List<TranslatedQuestion> translated = new ArrayList<>();
        for (int i = 0; i < questions.size(); i++) {
            QuizQuestion question = questions.get(i);
            if ("ko".equals(lang)) {
                translated.add(new TranslatedQuestion(question.questionKo(), question.optionsKo(), null, null));
                continue;
            }
            String translatedQuestion = translateText(question.questionKo(), lang).orElse(question.questionKo());
            List<String> translatedOptions = question.optionsKo().stream()
                .map(option -> translateText(option, lang).orElse(option))
                .toList();
            translated.add(new TranslatedQuestion(
                translatedQuestion,
                translatedOptions,
                i == 0 ? question.questionKo() : null,
                i == 0 ? question.optionsKo() : null
            ));
        }
        return translated;
    }

    private Optional<String> translateText(String text, String targetLang) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        try {
            String translated = vendor.call("google", text, "ko", targetLang, null, null, null).text();
            return translated.isBlank() ? Optional.empty() : Optional.of(translated);
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private List<QuizQuestion> generateFromTbmText(String tbmText, int maxQuestions) {
        try {
            String prompt = """
                당신은 건설현장 안전교육 퀴즈 출제 전문가입니다.
                아래 TBM 내용에서 안전 핵심 키워드로 객관식 문항을 생성하세요.
                응답은 설명 없이 JSON 배열만 반환하세요.
                필드: keyword, question_ko, options_ko, answer_index

                TBM 내용:
                %s
                """.formatted(tbmText.length() > 4000 ? tbmText.substring(0, 4000) : tbmText);
            String text = vendor.call("openai-prompt", tbmText, "ko", "ko", prompt, 2048, 0.3).text();
            var matcher = JSON_ARRAY_PATTERN.matcher(text.replace("```json", "").replace("```", ""));
            if (!matcher.find()) {
                return fallbackQuestions(maxQuestions);
            }
            List<SeedQuestion> seeds = objectMapper.readValue(matcher.group(1), new TypeReference<>() {});
            return seeds.stream()
                .limit(maxQuestions)
                .map(seed -> toQuestion(seed, "q_%d_".formatted(System.currentTimeMillis())))
                .toList();
        } catch (Exception ignored) {
            return fallbackQuestions(maxQuestions);
        }
    }

    private List<QuizQuestion> fallbackQuestions(int maxQuestions) {
        List<SeedQuestion> pool = new ArrayList<>(FALLBACK_POOL);
        Collections.shuffle(pool);
        long now = System.currentTimeMillis();
        return pool.stream()
            .limit(maxQuestions)
            .map(seed -> {
                List<String> options = new ArrayList<>(seed.optionsKo());
                String correct = options.get(seed.answerIndex());
                Collections.shuffle(options);
                return new QuizQuestion("fallback_" + now + "_" + Math.abs(seed.keyword().hashCode()), seed.keyword(), seed.questionKo(), options, options.indexOf(correct));
            })
            .toList();
    }

    private QuizQuestion toQuestion(SeedQuestion seed, String prefix) {
        List<String> options = seed.optionsKo() == null || seed.optionsKo().isEmpty() ? List.of("예", "아니오") : seed.optionsKo();
        int answerIndex = seed.answerIndex() < 0 || seed.answerIndex() >= options.size() ? 0 : seed.answerIndex();
        return new QuizQuestion(prefix + Math.abs(seed.keyword().hashCode()), clean(seed.keyword()), clean(seed.questionKo()), options, answerIndex);
    }

    private List<WorkerLangRow> workerTargets(Long siteId, Long tbmSessionId) {
        if (tbmSessionId != null) {
            List<WorkerLangRow> attendees = jdbc.sql("""
                    select distinct u.id, coalesce(nullif(u.preferred_language, ''), 'ko') as lang
                    from tbm_attendance a
                    join users u on u.id = a.worker_id
                    where a.session_id = :sessionId
                      and u.account_status = 'ACTIVE'
                """)
                .param("sessionId", tbmSessionId)
                .query((rs, rowNum) -> new WorkerLangRow(rs.getLong("id"), cleanLang(rs.getString("lang"))))
                .list();
            if (!attendees.isEmpty()) {
                return attendees;
            }
        }
        return jdbc.sql("""
                select distinct u.id, coalesce(nullif(u.preferred_language, ''), 'ko') as lang
                from users u
                join site_memberships sm on sm.user_id = u.id and sm.role = 'WORKER' and sm.status = 'ACTIVE'
                left join worker_profiles wp on wp.user_id = u.id
                where sm.site_id = :siteId
                  and u.account_status = 'ACTIVE'
                  and coalesce(wp.is_active, true) = true
                order by u.id
            """)
            .param("siteId", siteId)
            .query((rs, rowNum) -> new WorkerLangRow(rs.getLong("id"), cleanLang(rs.getString("lang"))))
            .list();
    }

    private List<TbmSessionRow> listTbmSessions(SessionPrincipal actor) {
        String siteClause = actor.hasAnyGlobalRole() ? "" : "and ts.site_id in (:siteIds)";
        var statement = jdbc.sql("""
                select ts.id, ts.site_id, ts.title, ts.status, ts.started_at,
                       coalesce(tn.normalized_text, tn.source_text) as content_ko,
                       tn.title as notice_title
                from tbm_sessions ts
                left join tbm_notices tn on tn.id::text = ts.tbm_notice_id
                where 1 = 1
                %s
                order by ts.started_at desc
                limit 10
            """.formatted(siteClause));
        if (!actor.hasAnyGlobalRole()) {
            statement = statement.param("siteIds", actor.siteIds());
        }
        return statement
            .query((rs, rowNum) -> new TbmSessionRow(
                rs.getLong("id"),
                rs.getLong("site_id"),
                rs.getString("title"),
                rs.getString("status"),
                rs.getTimestamp("started_at").toInstant(),
                rs.getString("content_ko"),
                rs.getString("notice_title")
            ))
            .list();
    }

    private Optional<TbmSessionRow> latestTbmSession(SessionPrincipal actor) {
        List<TbmSessionRow> rows = listTbmSessions(actor);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.getFirst());
    }

    private List<QuizSessionSummary> listQuizSessions(SessionPrincipal actor) {
        String siteClause = actor.hasAnyGlobalRole() ? "" : "and site_id in (:siteIds)";
        var statement = jdbc.sql("""
                select id, tbm_session_id, status, sent_at, created_at
                from tbm_quiz_sessions
                where 1 = 1
                %s
                order by created_at desc
                limit 20
            """.formatted(siteClause));
        if (!actor.hasAnyGlobalRole()) {
            statement = statement.param("siteIds", actor.siteIds());
        }
        return statement
            .query((rs, rowNum) -> new QuizSessionSummary(
                String.valueOf(rs.getLong("id")),
                rs.getObject("tbm_session_id", Long.class) == null ? null : String.valueOf(rs.getLong("tbm_session_id")),
                rs.getString("status"),
                rs.getTimestamp("sent_at") == null ? null : rs.getTimestamp("sent_at").toInstant().toString(),
                rs.getTimestamp("created_at").toInstant().toString()
            ))
            .list();
    }

    private List<QuizResponseSummary> listResponses(Long quizSessionId) {
        return jdbc.sql("""
                select r.id, r.worker_id, r.lang, r.score_pct, r.status, r.answered_at,
                       u.display_name, coalesce(wp.worker_code, u.id::text) as worker_code
                from tbm_quiz_responses r
                join users u on u.id = r.worker_id
                left join worker_profiles wp on wp.user_id = u.id
                where r.quiz_session_id = :quizSessionId
                order by r.score_pct desc nulls last, r.created_at asc
            """)
            .param("quizSessionId", quizSessionId)
            .query((rs, rowNum) -> new QuizResponseSummary(
                String.valueOf(rs.getLong("id")),
                String.valueOf(rs.getLong("worker_id")),
                rs.getString("lang"),
                rs.getObject("score_pct", Integer.class),
                rs.getString("status"),
                rs.getTimestamp("answered_at") == null ? null : rs.getTimestamp("answered_at").toInstant().toString(),
                rs.getTimestamp("answered_at") == null ? null : rs.getTimestamp("answered_at").toInstant().toString(),
                Map.of("full_name", rs.getString("display_name"), "worker_code", rs.getString("worker_code"))
            ))
            .list();
    }

    private TbmSessionRow getTbmSession(Long tbmSessionId) {
        return jdbc.sql("""
                select ts.id, ts.site_id, ts.title, ts.status, ts.started_at,
                       coalesce(tn.normalized_text, tn.source_text) as content_ko,
                       tn.title as notice_title
                from tbm_sessions ts
                left join tbm_notices tn on tn.id::text = ts.tbm_notice_id
                where ts.id = :id
            """)
            .param("id", tbmSessionId)
            .query((rs, rowNum) -> new TbmSessionRow(
                rs.getLong("id"),
                rs.getLong("site_id"),
                rs.getString("title"),
                rs.getString("status"),
                rs.getTimestamp("started_at").toInstant(),
                rs.getString("content_ko"),
                rs.getString("notice_title")
            ))
            .optional()
            .orElseThrow(() -> new NotFoundException("tbm_session_not_found"));
    }

    private QuizSessionRow getQuizSession(Long quizSessionId) {
        return jdbc.sql("""
                select id, tbm_session_id, site_id, questions::text as questions, status, source, sent_at, created_at
                from tbm_quiz_sessions
                where id = :id
            """)
            .param("id", quizSessionId)
            .query((rs, rowNum) -> new QuizSessionRow(
                rs.getLong("id"),
                rs.getObject("tbm_session_id", Long.class),
                rs.getLong("site_id"),
                rs.getString("questions"),
                rs.getString("status"),
                rs.getString("source"),
                rs.getTimestamp("sent_at") == null ? null : rs.getTimestamp("sent_at").toInstant(),
                rs.getTimestamp("created_at").toInstant()
            ))
            .optional()
            .orElseThrow(() -> new NotFoundException("quiz_session_not_found"));
    }

    private Optional<WorkerQuizRow> latestWorkerResponse(Long workerId) {
        return jdbc.sql("""
                select r.id, r.quiz_session_id, s.site_id, r.worker_id, r.lang,
                       r.questions_translated::text as questions_translated,
                       r.answer_index_correct::text as answer_index_correct,
                       r.answers_submitted::text as answers_submitted,
                       r.score_pct, r.status, r.answered_at, r.created_at
                from tbm_quiz_responses r
                join tbm_quiz_sessions s on s.id = r.quiz_session_id
                where r.worker_id = :workerId
                order by r.created_at desc
                limit 1
            """)
            .param("workerId", workerId)
            .query(this::mapWorkerQuizRow)
            .optional();
    }

    private WorkerQuizRow getWorkerQuizResponse(Long responseId, Long workerId) {
        return jdbc.sql("""
                select r.id, r.quiz_session_id, s.site_id, r.worker_id, r.lang,
                       r.questions_translated::text as questions_translated,
                       r.answer_index_correct::text as answer_index_correct,
                       r.answers_submitted::text as answers_submitted,
                       r.score_pct, r.status, r.answered_at, r.created_at
                from tbm_quiz_responses r
                join tbm_quiz_sessions s on s.id = r.quiz_session_id
                where r.id = :id
                  and r.worker_id = :workerId
            """)
            .param("id", responseId)
            .param("workerId", workerId)
            .query(this::mapWorkerQuizRow)
            .optional()
            .orElseThrow(() -> new NotFoundException("quiz_response_not_found"));
    }

    private WorkerQuizRow mapWorkerQuizRow(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new WorkerQuizRow(
            rs.getLong("id"),
            rs.getLong("quiz_session_id"),
            rs.getLong("site_id"),
            rs.getLong("worker_id"),
            rs.getString("lang"),
            rs.getString("questions_translated"),
            rs.getString("answer_index_correct"),
            rs.getString("answers_submitted"),
            rs.getObject("score_pct", Integer.class),
            rs.getString("status"),
            rs.getTimestamp("answered_at") == null ? null : rs.getTimestamp("answered_at").toInstant(),
            rs.getTimestamp("created_at").toInstant()
        );
    }

    private Map<String, Object> safeWorkerResponse(WorkerQuizRow row) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", String.valueOf(row.id()));
        response.put("lang", row.lang());
        response.put("questions_translated", parseTranslatedQuestions(row.questionsTranslatedJson()));
        response.put("answer_index_correct", "answered".equals(row.status()) ? parseIntegerList(row.answerIndexCorrectJson()) : null);
        response.put("answers_submitted", row.answersSubmittedJson() == null ? null : parseIntegerList(row.answersSubmittedJson()));
        response.put("score_pct", row.scorePct());
        response.put("status", row.status());
        response.put("answered_at", row.answeredAt() == null ? null : row.answeredAt().toString());
        return response;
    }

    private void reserveQuizQuota(SessionPrincipal actor, Long siteId, String action) {
        var decision = quota.checkAndIncrement("quiz", siteId, actor.userId());
        if (!decision.allowed()) {
            audit.record(actor.userId(), siteId, action, "ai_quota", decision.key(), "DENIED", "quota_exceeded", Map.of("used", decision.used(), "limit", decision.limit()));
            throw new AccessDeniedException("ai_quota_exceeded");
        }
    }

    private static void requireQuizAdmin(SessionPrincipal actor) {
        if (actor == null) {
            throw new AccessDeniedException("authentication_required");
        }
        boolean allowed = actor.roles().stream().anyMatch(role ->
            role.hasGlobalSiteScope() || role == Role.SITE_ADMIN || role == Role.SAFETY_MANAGER
        );
        if (!allowed) {
            throw new AccessDeniedException("role_denied");
        }
    }

    private static void requireWorker(SessionPrincipal actor) {
        if (actor == null) {
            throw new AccessDeniedException("authentication_required");
        }
        if (!actor.hasRole(Role.WORKER)) {
            throw new AccessDeniedException("worker_required");
        }
    }

    private Long firstSiteId(SessionPrincipal actor) {
        if (actor.siteIds() == null || actor.siteIds().isEmpty()) {
            if (actor.hasAnyGlobalRole()) {
                return jdbc.sql("select id from sites where status = 'ACTIVE' order by id limit 1")
                    .query(Long.class)
                    .optional()
                    .orElse(null);
            }
            return null;
        }
        return actor.siteIds().stream().sorted().findFirst().orElse(null);
    }

    private static Long cleanOptionalLong(String value, String error) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return parseLong(value, error);
    }

    private static Long parseLong(String value, String error) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(error);
        }
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(error, e);
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("json_write_failed", e);
        }
    }

    private List<QuizQuestion> parseQuestions(String json) {
        try {
            return objectMapper.readValue(json == null || json.isBlank() ? "[]" : json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("quiz_questions_invalid", e);
        }
    }

    private List<TranslatedQuestion> parseTranslatedQuestions(String json) {
        try {
            return objectMapper.readValue(json == null || json.isBlank() ? "[]" : json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    private List<Integer> parseIntegerList(String json) {
        try {
            return objectMapper.readValue(json == null || json.isBlank() ? "[]" : json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("integer_array_invalid", e);
        }
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static String cleanLang(String lang) {
        String value = lang == null || lang.isBlank() ? "ko" : lang.trim().toLowerCase(Locale.ROOT);
        return value.length() > 8 ? value.substring(0, 8) : value;
    }

    private record SeedQuestion(
        String keyword,
        @JsonProperty("question_ko") String questionKo,
        @JsonProperty("options_ko") List<String> optionsKo,
        @JsonProperty("answer_index") int answerIndex
    ) {}
    public record QuizQuestion(
        String id,
        String keyword,
        @JsonProperty("question_ko") String questionKo,
        @JsonProperty("options_ko") List<String> optionsKo,
        @JsonProperty("answer_index") int answerIndex
    ) {}
    public record TranslatedQuestion(String question, List<String> options, @JsonProperty("question_ko") String questionKo, @JsonProperty("options_ko") List<String> optionsKo) {}
    public record GenerateRequest(String tbmSessionId, String tbmText, Integer maxQuestions) {}
    public record GenerateResponse(List<QuizQuestion> questions, String tbmSessionId, String quizSessionId, String source) {}
    public record SendRequest(String quizSessionId, String tbmSessionId) {}
    public record SendResponse(int sent, List<String> langs) {}
    public record RespondRequest(String quizResponseId, List<Integer> answers) {}
    public record RespondResult(boolean ok, int scorePct, int correct, int total) {}
    public record QuizSessionSummary(String id, @JsonProperty("tbm_session_id") String tbmSessionId, String status, @JsonProperty("sent_at") String sentAt, @JsonProperty("created_at") String createdAt) {}
    public record QuizResponseSummary(
        String id,
        @JsonProperty("worker_id") String workerId,
        String lang,
        @JsonProperty("score_pct") Integer scorePct,
        String status,
        @JsonProperty("answered_at") String answeredAt,
        @JsonProperty("submitted_at") String submittedAt,
        @JsonProperty("nfc_workers") Map<String, String> nfcWorkers
    ) {}
    private record GeneratedQuiz(List<QuizQuestion> questions, Long tbmSessionId, Long quizSessionId, String source) {}
    private record SendResult(int sentCount, List<String> langs) {}
    private record WorkerLangRow(Long id, String lang) {}
    private record TbmSessionRow(Long id, Long siteId, String title, String status, Instant startedAt, String contentKo, String noticeTitle) {}
    private record QuizSessionRow(Long id, Long tbmSessionId, Long siteId, String questionsJson, String status, String source, Instant sentAt, Instant createdAt) {}
    private record WorkerQuizRow(Long id, Long quizSessionId, Long siteId, Long workerId, String lang, String questionsTranslatedJson, String answerIndexCorrectJson, String answersSubmittedJson, Integer scorePct, String status, Instant answeredAt, Instant createdAt) {}

    public static class AlreadyAnsweredException extends RuntimeException {
        private final Integer scorePct;

        public AlreadyAnsweredException(Integer scorePct) {
            super("already_answered");
            this.scorePct = scorePct;
        }

        public Integer scorePct() {
            return scorePct;
        }
    }
}
