package com.safelink.v3.incentive;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import java.util.List;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
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
@RequestMapping("/api/v1/incentive")
public class IncentiveController {
    private final JdbcClient jdbc;
    private final SiteGuard siteGuard;
    private final AuditService audit;

    public IncentiveController(JdbcClient jdbc, SiteGuard siteGuard, AuditService audit) {
        this.jdbc = jdbc;
        this.siteGuard = siteGuard;
        this.audit = audit;
    }

    @PostMapping("/grant")
    @Transactional
    public GrantResponse grant(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody GrantRequest request) {
        requireAdmin(actor);
        Long workerId = parseLong(request.workerId(), "workerId_required");
        String equipmentType = clean(request.equipmentType());
        if (equipmentType.isBlank()) {
            throw new IllegalArgumentException("workerId_equipmentType_required");
        }
        Integer scorePct = request.scorePct();
        if (scorePct != null && (scorePct < 0 || scorePct > 100)) {
            throw new IllegalArgumentException("scorePct_invalid");
        }
        Long quizSessionId = cleanOptionalLong(request.quizSessionId(), "quizSessionId_invalid");
        Long siteId = cleanOptionalLong(request.siteId(), "siteId_invalid");
        if (siteId == null && quizSessionId != null) {
            siteId = jdbc.sql("select site_id from tbm_quiz_sessions where id = :id")
                .param("id", quizSessionId)
                .query(Long.class)
                .optional()
                .orElse(null);
        }
        if (siteId == null) {
            siteId = workerSite(workerId);
        }
        if (siteId == null) {
            throw new IllegalArgumentException("siteId_required");
        }
        siteGuard.requireGlobalOrSiteAdmin(actor, siteId, "incentive.grant", "safety_equipment_grant", null);

        Long existing = existingGrant(workerId, quizSessionId, equipmentType);
        if (existing != null) {
            throw new AlreadyGrantedException(existing);
        }

        try {
            Long grantId = jdbc.sql("""
                    insert into safety_equipment_grants(worker_id, site_id, quiz_session_id, score_pct, equipment_type, granted_by, note)
                    values (:workerId, :siteId, :quizSessionId, :scorePct, :equipmentType, :grantedBy, :note)
                    returning id
                """)
                .param("workerId", workerId)
                .param("siteId", siteId)
                .param("quizSessionId", quizSessionId)
                .param("scorePct", scorePct)
                .param("equipmentType", equipmentType)
                .param("grantedBy", actor.userId())
                .param("note", request.note())
                .query(Long.class)
                .single();
            audit.record(actor.userId(), siteId, "incentive.grant", "safety_equipment_grant", String.valueOf(grantId), "ALLOWED", "server_api", Map.of("workerId", workerId, "equipmentType", equipmentType));
            return new GrantResponse(String.valueOf(grantId), true);
        } catch (DuplicateKeyException e) {
            Long duplicate = existingGrant(workerId, quizSessionId, equipmentType);
            throw new AlreadyGrantedException(duplicate == null ? 0L : duplicate);
        }
    }

    @GetMapping("/grant")
    public Map<String, List<GrantSummary>> grants(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam(required = false) String quizSessionId,
        @RequestParam(required = false) String siteId
    ) {
        requireAdmin(actor);
        Long parsedQuizSessionId = cleanOptionalLong(quizSessionId, "quizSessionId_invalid");
        Long parsedSiteId = cleanOptionalLong(siteId, "siteId_invalid");
        if (parsedSiteId == null && parsedQuizSessionId != null) {
            parsedSiteId = jdbc.sql("select site_id from tbm_quiz_sessions where id = :id")
                .param("id", parsedQuizSessionId)
                .query(Long.class)
                .optional()
                .orElse(null);
        }
        if (parsedSiteId != null) {
            siteGuard.requireSiteAccess(actor, parsedSiteId, "incentive.grant.list", "safety_equipment_grant", null);
        } else if (!actor.hasAnyGlobalRole() && actor.siteIds().isEmpty()) {
            throw new AccessDeniedException("site_id_required");
        }

        String quizClause = parsedQuizSessionId == null ? "" : "and g.quiz_session_id = :quizSessionId";
        String siteClause = parsedSiteId == null
            ? (actor.hasAnyGlobalRole() ? "" : "and g.site_id in (:siteIds)")
            : "and g.site_id = :siteId";
        var statement = jdbc.sql("""
                select g.id, g.worker_id, g.quiz_session_id, g.score_pct, g.equipment_type, g.granted_at, g.note,
                       u.display_name, coalesce(wp.worker_code, u.id::text) as worker_code
                from safety_equipment_grants g
                join users u on u.id = g.worker_id
                left join worker_profiles wp on wp.user_id = u.id
                where 1 = 1
                %s
                %s
                order by g.granted_at desc
                limit 100
            """.formatted(quizClause, siteClause));
        if (parsedQuizSessionId != null) {
            statement = statement.param("quizSessionId", parsedQuizSessionId);
        }
        if (parsedSiteId != null) {
            statement = statement.param("siteId", parsedSiteId);
        } else if (!actor.hasAnyGlobalRole()) {
            statement = statement.param("siteIds", actor.siteIds());
        }
        var rows = statement
            .query((rs, rowNum) -> new GrantSummary(
                String.valueOf(rs.getLong("id")),
                String.valueOf(rs.getLong("worker_id")),
                rs.getObject("quiz_session_id", Long.class) == null ? null : String.valueOf(rs.getLong("quiz_session_id")),
                rs.getObject("score_pct", Integer.class),
                rs.getString("equipment_type"),
                rs.getTimestamp("granted_at").toInstant().toString(),
                rs.getString("note"),
                Map.of("full_name", rs.getString("display_name"), "worker_code", rs.getString("worker_code"))
            ))
            .list();
        return Map.of("grants", rows);
    }

    private Long workerSite(Long workerId) {
        return jdbc.sql("""
                select site_id
                from site_memberships
                where user_id = :workerId
                  and role = 'WORKER'
                  and status = 'ACTIVE'
                order by created_at desc
                limit 1
            """)
            .param("workerId", workerId)
            .query(Long.class)
            .optional()
            .orElse(null);
    }

    private Long existingGrant(Long workerId, Long quizSessionId, String equipmentType) {
        var statement = jdbc.sql("""
                select id
                from safety_equipment_grants
                where worker_id = :workerId
                  and equipment_type = :equipmentType
                  %s
                limit 1
            """.formatted(quizSessionId == null ? "and quiz_session_id is null" : "and quiz_session_id = :quizSessionId"))
            .param("workerId", workerId)
            .param("equipmentType", equipmentType);
        if (quizSessionId != null) {
            statement = statement.param("quizSessionId", quizSessionId);
        }
        return statement.query(Long.class).optional().orElse(null);
    }

    private static void requireAdmin(SessionPrincipal actor) {
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

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    public record GrantRequest(String workerId, String quizSessionId, Integer scorePct, String equipmentType, String siteId, String note) {}
    public record GrantResponse(String grantId, boolean ok) {}
    public record GrantSummary(
        String id,
        @JsonProperty("worker_id") String workerId,
        @JsonProperty("quiz_session_id") String quizSessionId,
        @JsonProperty("score_pct") Integer scorePct,
        @JsonProperty("equipment_type") String equipmentType,
        @JsonProperty("granted_at") String grantedAt,
        String note,
        @JsonProperty("nfc_workers") Map<String, String> nfcWorkers
    ) {}

    public static class AlreadyGrantedException extends RuntimeException {
        private final Long grantId;

        public AlreadyGrantedException(Long grantId) {
            super("ALREADY_GRANTED");
            this.grantId = grantId;
        }

        public Long grantId() {
            return grantId;
        }
    }
}
