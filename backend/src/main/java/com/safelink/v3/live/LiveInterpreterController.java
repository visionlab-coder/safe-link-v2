package com.safelink.v3.live;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import java.time.Instant;
import java.util.List;
import java.util.Map;
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
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/live")
public class LiveInterpreterController {
    private final JdbcClient jdbc;
    private final ObjectMapper objectMapper;
    private final SiteGuard siteGuard;
    private final AuditService audit;
    private final LiveInterpreterEventBus eventBus;

    public LiveInterpreterController(JdbcClient jdbc, ObjectMapper objectMapper, SiteGuard siteGuard, AuditService audit, LiveInterpreterEventBus eventBus) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.siteGuard = siteGuard;
        this.audit = audit;
        this.eventBus = eventBus;
    }

    @PostMapping("/translations")
    @Transactional
    public Map<String, String> createTranslation(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody TranslationRequest request) {
        requireAdmin(actor);
        Long siteId = request.siteId() == null || request.siteId().isBlank() ? firstSiteId(actor) : parseLong(request.siteId(), "siteId_invalid");
        if (siteId == null) {
            throw new IllegalArgumentException("site_id_required");
        }
        siteGuard.requireSiteAccess(actor, siteId, "live.translation.create", "live_translation_event", null);
        String textKo = clean(request.textKo());
        if (textKo.isBlank()) {
            throw new IllegalArgumentException("text_ko_required");
        }
        String sessionId = clean(request.sessionId()).isBlank() ? "live" : clean(request.sessionId());
        Map<String, String> translations = request.translations() == null ? Map.of() : request.translations();
        Long id = jdbc.sql("""
                insert into live_translation_events(session_id, site_id, text_ko, translations, created_by)
                values (:sessionId, :siteId, :textKo, cast(:translations as jsonb), :createdBy)
                returning id
            """)
            .param("sessionId", sessionId)
            .param("siteId", siteId)
            .param("textKo", textKo)
            .param("translations", writeJson(translations))
            .param("createdBy", actor.userId())
            .query(Long.class)
            .single();
        audit.record(actor.userId(), siteId, "live.translation.create", "live_translation_event", String.valueOf(id), "ALLOWED", "server_api", Map.of("sessionId", sessionId));
        eventBus.publish(
            LiveInterpreterEventBus.translationsChannel(siteId),
            "translation",
            new TranslationEvent(String.valueOf(id), sessionId, String.valueOf(siteId), textKo, translations, String.valueOf(actor.userId()), Instant.now().toString())
        );
        return Map.of("id", String.valueOf(id));
    }

    @GetMapping("/translations")
    public Map<String, List<TranslationEvent>> translations(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam(defaultValue = "0") String afterId,
        @RequestParam(required = false) String siteId
    ) {
        if (actor == null) {
            throw new AccessDeniedException("authentication_required");
        }
        Long requestedSiteId = siteId == null || siteId.isBlank() ? firstSiteId(actor) : parseLong(siteId, "siteId_invalid");
        if (requestedSiteId != null) {
            siteGuard.requireSiteAccess(actor, requestedSiteId, "live.translation.list", "live_translation_event", null);
        } else if (!actor.hasAnyGlobalRole()) {
            throw new IllegalArgumentException("site_id_required");
        }
        Long parsedAfterId = parseLongOrZero(afterId);
        String siteClause = requestedSiteId == null ? "" : "and site_id = :siteId";
        var statement = jdbc.sql("""
                select id, session_id, site_id, text_ko, translations::text as translations, created_by, created_at
                from live_translation_events
                where id > :afterId
                %s
                order by id asc
                limit 100
            """.formatted(siteClause))
            .param("afterId", parsedAfterId);
        if (requestedSiteId != null) {
            statement = statement.param("siteId", requestedSiteId);
        }
        var rows = statement
            .query((rs, rowNum) -> new TranslationEvent(
                String.valueOf(rs.getLong("id")),
                rs.getString("session_id"),
                rs.getObject("site_id", Long.class) == null ? null : String.valueOf(rs.getLong("site_id")),
                rs.getString("text_ko"),
                parseStringMap(rs.getString("translations")),
                String.valueOf(rs.getLong("created_by")),
                rs.getTimestamp("created_at").toInstant().toString()
            ))
            .list();
        return Map.of("translations", rows);
    }

    @PostMapping("/worker-responses")
    @Transactional
    public Map<String, String> createWorkerResponse(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody WorkerResponseRequest request) {
        requireWorker(actor);
        Long adminId = parseLong(request.adminId(), "adminId_required");
        Long siteId = request.siteId() == null || request.siteId().isBlank() ? firstSiteId(actor) : parseLong(request.siteId(), "siteId_invalid");
        if (siteId == null) {
            throw new IllegalArgumentException("site_id_required");
        }
        siteGuard.requireSiteAccess(actor, siteId, "live.worker_response.create", "live_worker_response", null);
        String sourceText = clean(request.sourceText());
        String translatedText = clean(request.translatedText());
        if (sourceText.isBlank() || translatedText.isBlank()) {
            throw new IllegalArgumentException("source_translated_required");
        }
        String sourceLang = cleanOptional(request.sourceLang(), actor.preferredLanguage());
        String speakerName = cleanOptional(request.speakerName(), actor.displayName());
        Long id = jdbc.sql("""
                insert into live_worker_responses(site_id, worker_id, admin_id, source_lang, source_text, translated_text, speaker_name)
                values (:siteId, :workerId, :adminId, :sourceLang, :sourceText, :translatedText, :speakerName)
                returning id
            """)
            .param("siteId", siteId)
            .param("workerId", actor.userId())
            .param("adminId", adminId)
            .param("sourceLang", sourceLang)
            .param("sourceText", sourceText)
            .param("translatedText", translatedText)
            .param("speakerName", speakerName)
            .query(Long.class)
            .single();
        audit.record(actor.userId(), siteId, "live.worker_response.create", "live_worker_response", String.valueOf(id), "ALLOWED", "server_api", Map.of("adminId", adminId));
        var event = new WorkerResponseEvent(
            String.valueOf(id),
            String.valueOf(siteId),
            String.valueOf(actor.userId()),
            String.valueOf(adminId),
            sourceLang,
            sourceText,
            translatedText,
            speakerName,
            Instant.now().toString()
        );
        eventBus.publish(LiveInterpreterEventBus.workerResponsesChannel(adminId, siteId), "worker-response", event);
        eventBus.publish(LiveInterpreterEventBus.workerResponsesChannel(adminId, null), "worker-response", event);
        return Map.of("id", String.valueOf(id));
    }

    @GetMapping("/events")
    public SseEmitter events(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam String type,
        @RequestParam(required = false) String siteId
    ) {
        if (actor == null) throw new AccessDeniedException("authentication_required");
        Long requestedSiteId = siteId == null || siteId.isBlank() ? firstSiteId(actor) : parseLong(siteId, "siteId_invalid");
        if ("translations".equals(type)) {
            if (requestedSiteId == null) throw new IllegalArgumentException("site_id_required");
            siteGuard.requireSiteAccess(actor, requestedSiteId, "live.translation.events", "live_translation_event", null);
            return eventBus.subscribe(LiveInterpreterEventBus.translationsChannel(requestedSiteId));
        }
        if ("worker-responses".equals(type)) {
            requireAdmin(actor);
            if (requestedSiteId != null) {
                siteGuard.requireSiteAccess(actor, requestedSiteId, "live.worker_response.events", "live_worker_response", null);
            }
            return eventBus.subscribe(LiveInterpreterEventBus.workerResponsesChannel(actor.userId(), requestedSiteId));
        }
        throw new IllegalArgumentException("live_event_type_invalid");
    }

    @GetMapping("/worker-responses")
    public Map<String, List<WorkerResponseEvent>> workerResponses(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam(defaultValue = "0") String afterId,
        @RequestParam(required = false) String siteId
    ) {
        requireAdmin(actor);
        Long requestedSiteId = siteId == null || siteId.isBlank() ? firstSiteId(actor) : parseLong(siteId, "siteId_invalid");
        if (requestedSiteId != null) {
            siteGuard.requireSiteAccess(actor, requestedSiteId, "live.worker_response.list", "live_worker_response", null);
        }
        Long parsedAfterId = parseLongOrZero(afterId);
        String siteClause = requestedSiteId == null ? "" : "and site_id = :siteId";
        var statement = jdbc.sql("""
                select id, site_id, worker_id, admin_id, source_lang, source_text, translated_text, speaker_name, created_at
                from live_worker_responses
                where id > :afterId
                  and admin_id = :adminId
                %s
                order by id asc
                limit 100
            """.formatted(siteClause))
            .param("afterId", parsedAfterId)
            .param("adminId", actor.userId());
        if (requestedSiteId != null) {
            statement = statement.param("siteId", requestedSiteId);
        }
        var rows = statement
            .query((rs, rowNum) -> new WorkerResponseEvent(
                String.valueOf(rs.getLong("id")),
                String.valueOf(rs.getLong("site_id")),
                String.valueOf(rs.getLong("worker_id")),
                String.valueOf(rs.getLong("admin_id")),
                rs.getString("source_lang"),
                rs.getString("source_text"),
                rs.getString("translated_text"),
                rs.getString("speaker_name"),
                rs.getTimestamp("created_at").toInstant().toString()
            ))
            .list();
        return Map.of("responses", rows);
    }

    private static void requireAdmin(SessionPrincipal actor) {
        if (actor == null) throw new AccessDeniedException("authentication_required");
        boolean allowed = actor.roles().stream().anyMatch(role -> role.hasGlobalSiteScope() || role == Role.SITE_ADMIN || role == Role.SAFETY_MANAGER);
        if (!allowed) throw new AccessDeniedException("role_denied");
    }

    private static void requireWorker(SessionPrincipal actor) {
        if (actor == null) throw new AccessDeniedException("authentication_required");
        if (!actor.hasRole(Role.WORKER)) throw new AccessDeniedException("worker_required");
    }

    private static Long firstSiteId(SessionPrincipal actor) {
        if (actor.siteIds() == null || actor.siteIds().isEmpty()) return null;
        return actor.siteIds().stream().sorted().findFirst().orElse(null);
    }

    private static Long parseLong(String value, String error) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(error);
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(error, e);
        }
    }

    private static Long parseLongOrZero(String value) {
        if (value == null || value.isBlank()) return 0L;
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static String cleanOptional(String value, String fallback) {
        String cleaned = clean(value);
        return cleaned.isBlank() ? fallback : cleaned;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("json_write_failed", e);
        }
    }

    private Map<String, String> parseStringMap(String json) {
        try {
            return objectMapper.readValue(json == null || json.isBlank() ? "{}" : json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }

    public record TranslationRequest(String sessionId, String siteId, @JsonProperty("text_ko") String textKo, Map<String, String> translations) {}
    public record TranslationEvent(String id, @JsonProperty("session_id") String sessionId, @JsonProperty("site_id") String siteId, @JsonProperty("text_ko") String textKo, Map<String, String> translations, @JsonProperty("created_by") String createdBy, @JsonProperty("created_at") String createdAt) {}
    public record WorkerResponseRequest(String siteId, String adminId, String sourceLang, String sourceText, String translatedText, String speakerName) {}
    public record WorkerResponseEvent(String id, String siteId, String workerId, String adminId, String sourceLang, String sourceText, String translatedText, String speakerName, String createdAt) {}
}
