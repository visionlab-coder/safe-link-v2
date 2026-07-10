package com.safelink.v3.stopwork;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/stop-work")
public class StopWorkController {
    private static final long RATE_WINDOW_MS = 10 * 60 * 1000L;
    private static final int RATE_MAX = 3;
    private static final Set<String> PRIORITY_HAZARD_CATEGORIES = Set.of("위험작업거부", "산업재해", "danger_refusal", "accident");
    private static final Set<Role> ROUTE_PRIORITY_ROLES = Set.of(Role.ROOT, Role.HQ_ADMIN, Role.SAFETY_MANAGER);
    private static final Set<Role> ROUTE_DEFAULT_ROLES = Set.of(Role.ROOT, Role.HQ_ADMIN, Role.SITE_ADMIN, Role.SAFETY_MANAGER);

    private final JdbcClient jdbc;
    private final ObjectMapper objectMapper;
    private final SiteGuard siteGuard;
    private final AuditService audit;
    private final Map<Long, RateEntry> rateMap = new ConcurrentHashMap<>();

    public StopWorkController(JdbcClient jdbc, ObjectMapper objectMapper, SiteGuard siteGuard, AuditService audit) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.siteGuard = siteGuard;
        this.audit = audit;
    }

    @PostMapping("/improved")
    @Transactional
    public Map<String, Object> create(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody StopWorkRequest request) {
        if (actor == null) {
            throw new AccessDeniedException("authentication_required");
        }
        enforceRateLimit(actor.userId());
        Long siteId = parseLong(request.siteId(), "siteId_reason_required");
        String reason = clean(request.reason());
        if (reason.isBlank()) {
            throw new IllegalArgumentException("siteId_reason_required");
        }
        siteGuard.requireSiteAccess(actor, siteId, "stop_work.create", "stop_work_alert", null);

        String lang = cleanOptional(request.preferredLang(), actor.preferredLanguage());
        String hazardCategory = cleanOptional(request.hazardCategory(), "unspecified");
        String severity = cleanSeverity(request.severity());
        Instant escalationDueAt = Instant.now().plusSeconds(5 * 60);

        Long alertId = jdbc.sql("""
                insert into stop_work_alerts(worker_id, worker_name, site_id, reason, lang, resolved)
                values (:workerId, :workerName, :siteId, :reason, :lang, false)
                returning id
            """)
            .param("workerId", actor.userId())
            .param("workerName", actor.displayName() == null || actor.displayName().isBlank() ? actor.email() : actor.displayName())
            .param("siteId", siteId)
            .param("reason", reason)
            .param("lang", lang)
            .query(Long.class)
            .single();

        Map<String, Object> interventionPayload = new LinkedHashMap<>();
        interventionPayload.put("alert_id", alertId);
        interventionPayload.put("worker_id", actor.userId());
        interventionPayload.put("site_id", siteId);
        interventionPayload.put("reason", reason);
        interventionPayload.put("hazard_category", hazardCategory);
        interventionPayload.put("severity", severity);
        interventionPayload.put("preferred_lang", lang);
        interventionPayload.put("gps", request.gps());
        interventionPayload.put("photo_urls", request.photoUrls() == null ? List.of() : request.photoUrls());
        interventionPayload.put("status", "requested");
        interventionPayload.put("escalation_due_at", escalationDueAt.toString());

        Long interventionId = jdbc.sql("""
                insert into claim17_stop_work_interventions(alert_id, worker_id, site_id, reason, hazard_category, severity, preferred_lang, gps, photo_urls, status, escalation_due_at)
                values (:alertId, :workerId, :siteId, :reason, :hazardCategory, :severity, :lang, cast(:gps as jsonb), cast(:photoUrls as jsonb), 'requested', :escalationDueAt)
                returning id
            """)
            .param("alertId", alertId)
            .param("workerId", actor.userId())
            .param("siteId", siteId)
            .param("reason", reason)
            .param("hazardCategory", hazardCategory)
            .param("severity", severity)
            .param("lang", lang)
            .param("gps", writeJson(request.gps()))
            .param("photoUrls", writeJson(request.photoUrls() == null ? List.of() : request.photoUrls()))
            .param("escalationDueAt", Timestamp.from(escalationDueAt))
            .query(Long.class)
            .single();

        Map<String, Object> auditChain = appendHashChainEvent(siteId, "stop_work_intervention", String.valueOf(interventionId), "claim17_stop_work_requested", interventionPayload, actor.userId());
        boolean isPriority = PRIORITY_HAZARD_CATEGORIES.contains(hazardCategory);
        RoutingResult routing = routeToAdmins(siteId, alertId, isPriority, escalationDueAt);
        audit.record(actor.userId(), siteId, "stop_work.create", "claim17_stop_work_intervention", String.valueOf(interventionId), "ALLOWED", "server_api", Map.of("alertId", alertId, "priority", isPriority, "routed", routing.routed()));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("alertId", String.valueOf(alertId));
        response.put("intervention", Map.of("id", String.valueOf(interventionId), "status", "requested", "escalation_due_at", escalationDueAt.toString()));
        response.put("audit", auditChain);
        response.put("escalationDueAt", escalationDueAt.toString());
        response.put("routing", Map.of("routed", routing.routed(), "roles", routing.roles()));
        response.put("isPriorityRouted", isPriority);
        return response;
    }

    private RoutingResult routeToAdmins(Long siteId, Long alertId, boolean priority, Instant escalationDueAt) {
        Set<Role> targetRoles = priority ? ROUTE_PRIORITY_ROLES : ROUTE_DEFAULT_ROLES;
        List<RouteTarget> targets = jdbc.sql("""
                select distinct u.id, ur.role
                from users u
                join user_roles ur on ur.user_id = u.id and ur.revoked_at is null
                left join site_memberships sm on sm.user_id = u.id and sm.site_id = :siteId and sm.status = 'ACTIVE'
                where ur.role in (:roles)
                  and u.account_status = 'ACTIVE'
                  and (ur.role in ('ROOT', 'HQ_ADMIN') or sm.user_id is not null)
            """)
            .param("siteId", siteId)
            .param("roles", targetRoles.stream().map(Role::name).toList())
            .query((rs, rowNum) -> new RouteTarget(rs.getLong("id"), rs.getString("role")))
            .list();
        for (RouteTarget target : targets) {
            jdbc.sql("""
                    insert into stop_work_alert_routing(alert_id, admin_id, admin_role, is_priority, escalation_due_at)
                    values (:alertId, :adminId, :adminRole, :priority, :escalationDueAt)
                    on conflict (alert_id, admin_id) do nothing
                """)
                .param("alertId", alertId)
                .param("adminId", target.id())
                .param("adminRole", target.role())
                .param("priority", priority)
                .param("escalationDueAt", priority ? Timestamp.from(escalationDueAt) : null)
                .update();
        }
        return new RoutingResult(targets.size(), targets.stream().map(RouteTarget::role).distinct().toList());
    }

    private Map<String, Object> appendHashChainEvent(Long siteId, String entityType, String entityId, String eventType, Map<String, Object> payload, Long createdBy) {
        String previousHash = jdbc.sql("""
                select event_hash
                from claim13_hash_chain_events
                where site_id = :siteId
                order by id desc
                limit 1
            """)
            .param("siteId", siteId)
            .query(String.class)
            .optional()
            .orElse(null);
        String payloadJson = writeJson(payload);
        String eventHash = sha256(siteId + "|" + entityType + "|" + entityId + "|" + eventType + "|" + payloadJson + "|" + (previousHash == null ? "" : previousHash));
        Long eventId = jdbc.sql("""
                insert into claim13_hash_chain_events(site_id, entity_type, entity_id, event_type, payload, previous_hash, event_hash, created_by)
                values (:siteId, :entityType, :entityId, :eventType, cast(:payload as jsonb), :previousHash, :eventHash, :createdBy)
                returning id
            """)
            .param("siteId", siteId)
            .param("entityType", entityType)
            .param("entityId", entityId)
            .param("eventType", eventType)
            .param("payload", payloadJson)
            .param("previousHash", previousHash)
            .param("eventHash", eventHash)
            .param("createdBy", createdBy)
            .query(Long.class)
            .single();
        return Map.of("eventId", String.valueOf(eventId), "eventHash", eventHash, "previousHash", previousHash == null ? "" : previousHash);
    }

    private void enforceRateLimit(Long userId) {
        long now = System.currentTimeMillis();
        RateEntry next = rateMap.compute(userId, (key, current) -> {
            if (current == null || now >= current.resetAt()) {
                return new RateEntry(1, now + RATE_WINDOW_MS);
            }
            return new RateEntry(current.count() + 1, current.resetAt());
        });
        if (next.count() > RATE_MAX) {
            throw new AccessDeniedException("RATE_LIMITED");
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("json_write_failed", e);
        }
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("sha256_failed", e);
        }
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

    private static String cleanSeverity(String value) {
        String cleaned = cleanOptional(value, "high").toLowerCase(Locale.ROOT);
        if (cleaned.equals("low") || cleaned.equals("medium") || cleaned.equals("high") || cleaned.equals("critical")) {
            return cleaned;
        }
        return "high";
    }

    private static String cleanOptional(String value, String fallback) {
        String cleaned = value == null ? "" : value.trim();
        return cleaned.isBlank() ? fallback : cleaned;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    public record StopWorkRequest(String siteId, String reason, String hazardCategory, String severity, String preferredLang, Map<String, Object> gps, List<String> photoUrls) {}
    private record RouteTarget(Long id, String role) {}
    private record RoutingResult(int routed, List<String> roles) {}
    private record RateEntry(int count, long resetAt) {}
}
