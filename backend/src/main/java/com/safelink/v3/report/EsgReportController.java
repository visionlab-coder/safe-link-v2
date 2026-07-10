package com.safelink.v3.report;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.security.SiteGuard;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/esg")
public class EsgReportController {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private final JdbcClient jdbc;
    private final SiteGuard siteGuard;

    public EsgReportController(JdbcClient jdbc, SiteGuard siteGuard) {
        this.jdbc = jdbc;
        this.siteGuard = siteGuard;
    }

    @GetMapping("/report")
    public EsgReport report(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam String siteId,
        @RequestParam(required = false) String from,
        @RequestParam(required = false) String to
    ) {
        requireAdmin(actor);
        Long parsedSiteId = parseLong(siteId, "siteId_required");
        siteGuard.requireSiteAccess(actor, parsedSiteId, "esg.report", "site", siteId);
        LocalDate fromDate = parseDate(from, LocalDate.of(1970, 1, 1));
        LocalDate toDate = parseDate(to, LocalDate.now(SEOUL));
        OffsetDateTime fromTime = fromDate.atStartOfDay(SEOUL).toOffsetDateTime();
        OffsetDateTime toTime = toDate.plusDays(1).atStartOfDay(SEOUL).toOffsetDateTime();

        int totalSessions = jdbc.sql("""
                select count(*)
                from tbm_sessions
                where site_id = :siteId
                  and started_at >= :fromTime
                  and started_at < :toTime
            """)
            .param("siteId", parsedSiteId)
            .param("fromTime", fromTime)
            .param("toTime", toTime)
            .query(Integer.class)
            .single();
        var attendance = jdbc.sql("""
                select count(*) as total,
                       count(*) filter (where a.is_certified = true) as certified
                from tbm_attendance a
                join tbm_sessions s on s.id = a.session_id
                where s.site_id = :siteId
                  and s.started_at >= :fromTime
                  and s.started_at < :toTime
            """)
            .param("siteId", parsedSiteId)
            .param("fromTime", fromTime)
            .param("toTime", toTime)
            .query((rs, rowNum) -> new CountPair(rs.getInt("total"), rs.getInt("certified")))
            .single();
        var pledges = jdbc.sql("""
                select count(*) as total,
                       count(*) filter (where approved_at is not null) as signed
                from claim13_pledges
                where site_id = :siteId
                  and created_at >= :fromTime
                  and created_at < :toTime
            """)
            .param("siteId", parsedSiteId)
            .param("fromTime", fromTime)
            .param("toTime", toTime)
            .query((rs, rowNum) -> new CountPair(rs.getInt("total"), rs.getInt("signed")))
            .single();
        int auditEvents = jdbc.sql("""
                select count(*)
                from claim13_hash_chain_events
                where site_id = :siteId
                  and created_at >= :fromTime
                  and created_at < :toTime
            """)
            .param("siteId", parsedSiteId)
            .param("fromTime", fromTime)
            .param("toTime", toTime)
            .query(Integer.class)
            .single();

        Map<String, Object> quiz = new java.util.LinkedHashMap<>();
        quiz.put("avgScore", null);
        Map<String, Object> interpretation = new java.util.LinkedHashMap<>();
        interpretation.put("totalSessions", null);

        return new EsgReport(
            siteId,
            Map.of("from", fromDate.toString(), "to", toDate.toString()),
            new TbmStats(totalSessions, attendance.total(), rate(attendance.matched(), attendance.total())),
            quiz,
            Map.of("totalGrants", 0),
            new StopWorkStats(0, 0),
            new PledgeStats(pledges.total(), pledges.matched(), rate(pledges.matched(), pledges.total())),
            new AuditChainStats(auditEvents),
            interpretation,
            OffsetDateTime.now(SEOUL).toString(),
            Map.of(
                "reportType", "esg_safety_report",
                "generatedBy", String.valueOf(actor.userId()),
                "scope", Map.of("siteId", siteId, "from", fromDate.toString(), "to", toDate.toString())
            )
        );
    }

    private static void requireAdmin(SessionPrincipal actor) {
        if (actor == null) throw new AccessDeniedException("authentication_required");
        boolean allowed = actor.roles().stream().anyMatch(role -> role.hasGlobalSiteScope() || role.canManageSiteUsers());
        if (!allowed) throw new AccessDeniedException("admin_required");
    }

    private static Long parseLong(String value, String error) {
        try {
            return Long.valueOf(value == null ? "" : value.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(error);
        }
    }

    private static LocalDate parseDate(String value, LocalDate fallback) {
        if (value == null || value.isBlank()) return fallback;
        return LocalDate.parse(value);
    }

    private static double rate(int part, int total) {
        return total <= 0 ? 0 : Math.round((part / (double) total) * 10000) / 10000.0;
    }

    private record CountPair(int total, int matched) {}
    public record EsgReport(String siteId, Map<String, String> period, TbmStats tbm, Map<String, Object> quiz, Map<String, Integer> safetyEquipment, StopWorkStats stopWork, PledgeStats pledges, AuditChainStats auditChain, Map<String, Object> interpretation, String generatedAt, Map<String, ?> report) {}
    public record TbmStats(int totalSessions, int totalAttendance, double certificationRate) {}
    public record StopWorkStats(int totalIncidents, int resolvedCount) {}
    public record PledgeStats(int totalPledges, int signedCount, double signatureRate) {}
    public record AuditChainStats(@JsonProperty("totalEvents") int totalEvents) {}
}
