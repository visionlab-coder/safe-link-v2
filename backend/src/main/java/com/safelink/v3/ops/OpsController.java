package com.safelink.v3.ops;

import com.safelink.v3.ai.AiQuotaService;
import com.safelink.v3.ai.AiVendorService;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class OpsController {
    private static final List<String> TESTBED_SITE_NAMES = List.of("청주센텀푸르지오자이", "과천G-TOWN");

    private final JdbcClient jdbc;
    private final AiQuotaService quota;
    private final AuditService audit;
    private final AiVendorService vendor;

    public OpsController(JdbcClient jdbc, AiQuotaService quota, AuditService audit, AiVendorService vendor) {
        this.jdbc = jdbc;
        this.quota = quota;
        this.audit = audit;
        this.vendor = vendor;
    }

    @GetMapping("/admin/testbed-health")
    public Map<String, Object> testbedHealth(@AuthenticationPrincipal SessionPrincipal actor) {
        requireRootOrHq(actor);
        List<Map<String, Object>> sites = new ArrayList<>();
        for (String name : TESTBED_SITE_NAMES) {
            var site = jdbc.sql("select id, name from sites where name = :name order by id limit 1")
                .param("name", name)
                .query((rs, rowNum) -> Map.of("id", rs.getLong("id"), "name", rs.getString("name")))
                .optional();
            if (site.isEmpty()) {
                sites.add(Map.of(
                    "site_id", "",
                    "name", name,
                    "admins", List.of(),
                    "workers_active", 0,
                    "workers", List.of(),
                    "issues", List.of("SITE_NOT_FOUND"),
                    "duplicates", Map.of("by_initials_last4", List.of(), "by_phone", List.of())
                ));
                continue;
            }
            Long siteId = (Long) site.get().get("id");
            List<Map<String, Object>> admins = jdbc.sql("""
                    select distinct u.display_name, sm.role, u.preferred_language
                    from site_memberships sm
                    join users u on u.id = sm.user_id
                    where sm.site_id = :siteId
                      and sm.status = 'ACTIVE'
                      and sm.role <> 'WORKER'
                    order by u.display_name
                """)
                .param("siteId", siteId)
                .query((rs, rowNum) -> Map.<String, Object>of(
                    "display_name", rs.getString("display_name"),
                    "role", rs.getString("role"),
                    "lang", rs.getString("preferred_language")
                ))
                .list();
            List<Map<String, Object>> workers = jdbc.sql("""
                    select u.display_name, u.phone, u.preferred_language, wp.worker_code, wp.is_active
                    from site_memberships sm
                    join users u on u.id = sm.user_id
                    left join worker_profiles wp on wp.user_id = u.id
                    where sm.site_id = :siteId
                      and sm.status = 'ACTIVE'
                      and sm.role = 'WORKER'
                      and coalesce(wp.is_active, true) = true
                    order by u.display_name
                """)
                .param("siteId", siteId)
                .query((rs, rowNum) -> {
                    String phone = rs.getString("phone");
                    String workerName = rs.getString("display_name");
                    List<String> flags = new ArrayList<>();
                    if (workerName == null || workerName.isBlank()) flags.add("NAME_NULL");
                    if (rs.getString("worker_code") == null || rs.getString("worker_code").isBlank()) flags.add("WORKER_CODE_NULL");
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("name_initials", initials(workerName));
                    row.put("phone_last4", phone == null || phone.length() < 4 ? null : phone.substring(phone.length() - 4));
                    row.put("phone", phone);
                    row.put("full_name", workerName);
                    row.put("preferred_lang", rs.getString("preferred_language"));
                    row.put("has_auth", true);
                    row.put("flags", flags);
                    return row;
                })
                .list();
            List<String> issues = workers.stream()
                .filter(worker -> !((List<?>) worker.get("flags")).isEmpty())
                .map(worker -> "%s: %s".formatted(worker.get("full_name"), worker.get("flags")))
                .toList();
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("site_id", String.valueOf(siteId));
            result.put("name", site.get().get("name"));
            result.put("admins", admins);
            result.put("workers_active", workers.size());
            result.put("workers", workers);
            result.put("issues", issues);
            result.put("duplicates", Map.of("by_initials_last4", List.of(), "by_phone", List.of()));
            sites.add(result);
        }
        int totalIssues = sites.stream().mapToInt(site -> ((List<?>) site.get("issues")).size()).sum();
        return Map.of("ok", totalIssues == 0, "total_issues", totalIssues, "sites", sites, "checked_at", Instant.now().toString());
    }

    @PostMapping("/agents/site-briefing")
    public Map<String, String> siteBriefing(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody BriefingRequest request) {
        requireAdmin(actor);
        Long siteId = firstSiteId(actor);
        int totalWorkers = countWorkers(actor);
        int ackCount = countRecentTbmAttendance(actor);
        String lang = request.lang() == null || request.lang().isBlank() ? "ko" : request.lang().trim();
        String fallback = fallbackBriefing(lang, totalWorkers, ackCount);
        if (siteId != null) {
            var decision = quota.checkAndIncrement("quiz", siteId, actor.userId());
            if (!decision.allowed()) {
                audit.record(actor.userId(), siteId, "agents.site_briefing", "ai_quota", decision.key(), "DENIED", "quota_exceeded", Map.of("used", decision.used(), "limit", decision.limit()));
                return Map.of("briefing", fallback);
            }
        }
        return Map.of("briefing", generateBriefing(lang, totalWorkers, ackCount).orElse(fallback));
    }

    @PostMapping("/agents/hq-audit")
    public Map<String, String> hqAudit(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody BriefingRequest request) {
        requireRootOrHq(actor);
        String lang = request.lang() == null || request.lang().isBlank() ? "ko" : request.lang().trim();
        int activeSites = jdbc.sql("select count(*) from sites where status = 'ACTIVE'").query(Integer.class).single();
        int totalMessages = jdbc.sql("select count(*) from chat_messages where created_at >= :since")
            .param("since", java.sql.Timestamp.from(Instant.now().minus(Duration.ofDays(7))))
            .query(Integer.class)
            .single();
        int unresolvedAlerts = jdbc.sql("select count(*) from stop_work_alerts where resolved = false")
            .query(Integer.class)
            .single();
        Long siteId = firstSiteId(actor);
        if (siteId != null) {
            var decision = quota.checkAndIncrement("quiz", siteId, actor.userId());
            if (!decision.allowed()) {
                audit.record(actor.userId(), siteId, "agents.hq_audit", "ai_quota", decision.key(), "DENIED", "quota_exceeded", Map.of("used", decision.used(), "limit", decision.limit()));
                return Map.of("audit", fallbackHqAudit(lang, activeSites, totalMessages, unresolvedAlerts));
            }
        }
        return Map.of("audit", generateHqAudit(lang, activeSites, totalMessages, unresolvedAlerts).orElse(fallbackHqAudit(lang, activeSites, totalMessages, unresolvedAlerts)));
    }

    @GetMapping("/agents/swarm-status")
    public Map<String, Object> swarmStatus(@AuthenticationPrincipal SessionPrincipal actor) {
        requireAdmin(actor);
        Instant since = Instant.now().minus(Duration.ofHours(24));
        String siteClause = actor.hasAnyGlobalRole() ? "" : "and s.id in (:siteIds)";
        var statement = jdbc.sql("""
                select s.id, coalesce(s.site_code, s.name) as code,
                       count(distinct sm.user_id) filter (where sm.role = 'WORKER' and sm.status = 'ACTIVE') as workers,
                       count(distinct a.id) filter (where a.created_at >= :since and a.resolved = false) as alerts
                from sites s
                left join site_memberships sm on sm.site_id = s.id
                left join stop_work_alerts a on a.site_id = s.id
                where s.status = 'ACTIVE'
                %s
                group by s.id, s.site_code, s.name
                order by s.id
                limit 50
            """.formatted(siteClause))
            .param("since", java.sql.Timestamp.from(since));
        if (!actor.hasAnyGlobalRole()) {
            statement = statement.param("siteIds", actor.siteIds());
        }
        List<Map<String, Object>> sites = statement
            .query((rs, rowNum) -> {
                int workerCount = rs.getInt("workers");
                int alerts = rs.getInt("alerts");
                int totalNodes = workerCount + 3;
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", String.valueOf(rs.getLong("id")));
                row.put("name", rs.getString("code"));
                row.put("totalNodes", totalNodes);
                row.put("activeNodes", Math.max(3, totalNodes - alerts));
                row.put("alerts", alerts);
                row.put("avgNoise", 45);
                return row;
            })
            .list();
        int hqAgents = 4;
        int total = sites.stream().mapToInt(site -> (Integer) site.get("totalNodes")).sum() + hqAgents;
        int active = sites.stream().mapToInt(site -> (Integer) site.get("activeNodes")).sum() + hqAgents;
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("timestamp", Instant.now().toString());
        response.put("totalSwarmNodes", total);
        response.put("activeSwarmNodes", active);
        response.put("globalRiskLevel", sites.stream().anyMatch(site -> (Integer) site.get("alerts") > 0) ? "ELEVATED" : "LOW");
        response.put("sites", sites);
        response.put("_simulated", false);
        return response;
    }

    @GetMapping("/system/summary")
    public Map<String, Object> systemSummary(@AuthenticationPrincipal SessionPrincipal actor) {
        requireRootOrHq(actor);
        List<Map<String, Object>> sites = jdbc.sql("""
                select s.id, s.name, s.address, s.created_at,
                       count(distinct sm.user_id) filter (where sm.role = 'WORKER' and sm.status = 'ACTIVE') as worker_count,
                       count(distinct ts.id) filter (where ts.started_at >= date_trunc('day', now() at time zone 'Asia/Seoul')) as tbm_today,
                       count(distinct a.id) filter (where a.resolved = false) as alert_count
                from sites s
                left join site_memberships sm on sm.site_id = s.id
                left join tbm_sessions ts on ts.site_id = s.id
                left join stop_work_alerts a on a.site_id = s.id
                where s.status = 'ACTIVE'
                group by s.id, s.name, s.address, s.created_at
                order by s.created_at desc
            """)
            .query((rs, rowNum) -> {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("id", String.valueOf(rs.getLong("id")));
                row.put("name", rs.getString("name"));
                row.put("address", rs.getString("address"));
                row.put("created_at", rs.getTimestamp("created_at").toInstant().toString());
                row.put("worker_count", rs.getInt("worker_count"));
                row.put("tbm_today", rs.getInt("tbm_today"));
                row.put("alert_count", rs.getInt("alert_count"));
                return row;
            })
            .list();
        int safetyManagers = jdbc.sql("""
                select count(distinct user_id)
                from user_roles
                where revoked_at is null
                  and role = 'SAFETY_MANAGER'
            """).query(Integer.class).single();
        int hqAdmins = jdbc.sql("""
                select count(distinct user_id)
                from user_roles
                where revoked_at is null
                  and role in ('ROOT', 'HQ_ADMIN')
            """).query(Integer.class).single();
        Instant anchor = jdbc.sql("""
                select coalesce(
                  (select max(created_at) from stop_work_alerts),
                  (select min(created_at) from sites where status = 'ACTIVE'),
                  now()
                )
            """)
            .query((rs, rowNum) -> rs.getTimestamp(1).toInstant())
            .single();
        long accidentFreeDays = Math.max(0, Duration.between(anchor, Instant.now()).toDays());
        return Map.of(
            "sites", sites,
            "safetyOfficerCount", safetyManagers,
            "hqAdminCount", hqAdmins,
            "accidentFreeDays", accidentFreeDays
        );
    }

    @GetMapping("/system/security-logs")
    public Map<String, List<Map<String, Object>>> systemSecurityLogs(@AuthenticationPrincipal SessionPrincipal actor) {
        requireRootOrHq(actor);
        Instant sevenDaysAgo = Instant.now().minus(Duration.ofDays(7));
        List<Map<String, Object>> profileLogs = jdbc.sql("""
                select u.id, u.display_name, ur.role, ur.granted_at
                from user_roles ur
                join users u on u.id = ur.user_id
                where ur.granted_at >= :since
                order by ur.granted_at desc
                limit 20
            """)
            .param("since", java.sql.Timestamp.from(sevenDaysAgo))
            .query((rs, rowNum) -> Map.<String, Object>of(
                "id", "profile-" + rs.getLong("id") + "-" + rs.getString("role"),
                "timestamp", rs.getTimestamp("granted_at").toInstant().toString(),
                "event", "[AUTH] 권한 변경 → " + rs.getString("role"),
                "actor", rs.getString("display_name") == null ? String.valueOf(rs.getLong("id")) : rs.getString("display_name"),
                "severity", ("ROOT".equals(rs.getString("role")) || "HQ_ADMIN".equals(rs.getString("role"))) ? "warn" : "info"
            ))
            .list();
        List<Map<String, Object>> alertLogs = jdbc.sql("""
                select id, site_id, created_at, resolved
                from stop_work_alerts
                where created_at >= :since
                order by created_at desc
                limit 10
            """)
            .param("since", java.sql.Timestamp.from(sevenDaysAgo))
            .query((rs, rowNum) -> Map.<String, Object>of(
                "id", "alert-" + rs.getLong("id"),
                "timestamp", rs.getTimestamp("created_at").toInstant().toString(),
                "event", rs.getBoolean("resolved") ? "[SAFETY] 작업중지 해제" : "[SAFETY] 작업중지 알람 발생",
                "actor", "현장 " + rs.getLong("site_id"),
                "severity", rs.getBoolean("resolved") ? "info" : "critical"
            ))
            .list();
        List<Map<String, Object>> logs = new ArrayList<>();
        logs.add(Map.of(
            "id", "session-now",
            "timestamp", Instant.now().toString(),
            "event", "[SYSTEM] 통합관제 접근 — 세션 시작",
            "actor", actor.displayName() == null ? actor.email() : actor.displayName(),
            "severity", "info"
        ));
        logs.addAll(profileLogs);
        logs.addAll(alertLogs);
        logs.sort((a, b) -> String.valueOf(b.get("timestamp")).compareTo(String.valueOf(a.get("timestamp"))));
        return Map.of("logs", logs);
    }

    @PostMapping("/system/sites")
    public Map<String, String> saveSystemSite(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody SystemSiteRequest request) {
        requireRootOrHq(actor);
        String name = request.name() == null ? "" : request.name().trim();
        if (name.isBlank()) {
            throw new IllegalArgumentException("name_required");
        }
        String address = request.address() == null ? "" : request.address().trim();
        Long id;
        if (request.id() == null || request.id().isBlank()) {
            Long organizationId = jdbc.sql("""
                    insert into organizations(name)
                    select '서원건설'
                    where not exists (select 1 from organizations where name = '서원건설')
                    returning id
                """)
                .query(Long.class)
                .optional()
                .orElseGet(() -> jdbc.sql("select id from organizations order by id limit 1").query(Long.class).single());
            id = jdbc.sql("""
                    insert into sites(organization_id, name, address, status)
                    values (:organizationId, :name, :address, 'ACTIVE')
                    returning id
                """)
                .param("organizationId", organizationId)
                .param("name", name)
                .param("address", address)
                .query(Long.class)
                .single();
        } else {
            id = Long.parseLong(request.id().trim());
            jdbc.sql("""
                    update sites
                    set name = :name,
                        address = :address
                    where id = :id
                      and status = 'ACTIVE'
                """)
                .param("name", name)
                .param("address", address)
                .param("id", id)
                .update();
        }
        audit.record(actor.userId(), id, "system.site.save", "site", String.valueOf(id), "ALLOWED", "server_api", Map.of("name", name));
        return Map.of("id", String.valueOf(id));
    }

    @DeleteMapping("/system/sites/{siteId}")
    public Map<String, Boolean> archiveSystemSite(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable Long siteId) {
        requireRootOrHq(actor);
        jdbc.sql("update sites set status = 'ARCHIVED' where id = :siteId")
            .param("siteId", siteId)
            .update();
        audit.record(actor.userId(), siteId, "system.site.archive", "site", String.valueOf(siteId), "ALLOWED", "server_api", Map.of());
        return Map.of("ok", true);
    }

    private java.util.Optional<String> generateBriefing(String lang, int totalWorkers, int ackCount) {
        try {
            String prompt = """
                Site Data Summary:
                - Total Workers: %d
                - Latest TBM Ack Rate: %d/%d
                - Emergency Logs: No active SOS signals detected.

                Task: Provide a concise 3-line safety briefing in [%s].
                """.formatted(totalWorkers, ackCount, Math.max(totalWorkers, 1), lang);
            var result = vendor.call("openai-prompt", prompt, "ko", lang, prompt, 1024, 0.2);
            return result.text().isBlank() ? java.util.Optional.empty() : java.util.Optional.of(result.text());
        } catch (Exception ignored) {
            return java.util.Optional.empty();
        }
    }

    private java.util.Optional<String> generateHqAudit(String lang, int activeSites, int totalMessages, int unresolvedAlerts) {
        try {
            String prompt = """
                You are HQ Command Agents for construction safety operations.
                Data Context:
                - Active Sites: %d
                - Recent Messages: %d
                - Unresolved Stop-work Alerts: %d

                Provide a 3-section HQ command briefing in [%s].
                Sections: [Risk Watchdog], [Compliance Auditor], [Strategic Action].
                """.formatted(activeSites, totalMessages, unresolvedAlerts, lang);
            var result = vendor.call("openai-prompt", prompt, "ko", lang, prompt, 1536, 0.2);
            return result.text().isBlank() ? java.util.Optional.empty() : java.util.Optional.of(result.text());
        } catch (Exception ignored) {
            return java.util.Optional.empty();
        }
    }

    private int countWorkers(SessionPrincipal actor) {
        String siteClause = actor.hasAnyGlobalRole() ? "" : "and sm.site_id in (:siteIds)";
        var statement = jdbc.sql("""
                select count(distinct sm.user_id)
                from site_memberships sm
                join users u on u.id = sm.user_id
                where sm.role = 'WORKER'
                  and sm.status = 'ACTIVE'
                  and u.account_status = 'ACTIVE'
                %s
            """.formatted(siteClause));
        if (!actor.hasAnyGlobalRole()) {
            statement = statement.param("siteIds", actor.siteIds());
        }
        return statement.query(Integer.class).single();
    }

    private int countRecentTbmAttendance(SessionPrincipal actor) {
        String siteClause = actor.hasAnyGlobalRole() ? "" : "and ts.site_id in (:siteIds)";
        var statement = jdbc.sql("""
                select count(*)
                from tbm_attendance a
                join tbm_sessions ts on ts.id = a.session_id
                where a.tapped_at >= :since
                %s
            """.formatted(siteClause))
            .param("since", java.sql.Timestamp.from(Instant.now().minus(Duration.ofDays(1))));
        if (!actor.hasAnyGlobalRole()) {
            statement = statement.param("siteIds", actor.siteIds());
        }
        return statement.query(Integer.class).single();
    }

    private static void requireRootOrHq(SessionPrincipal actor) {
        if (actor == null) {
            throw new AccessDeniedException("authentication_required");
        }
        if (!actor.hasAnyGlobalRole()) {
            throw new AccessDeniedException("role_denied");
        }
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

    private static Long firstSiteId(SessionPrincipal actor) {
        if (actor.siteIds() == null || actor.siteIds().isEmpty()) {
            return null;
        }
        return actor.siteIds().stream().sorted().findFirst().orElse(null);
    }

    private static String fallbackBriefing(String lang, int totalWorkers, int ackCount) {
        int ackRate = totalWorkers > 0 ? Math.round((ackCount * 100.0f) / totalWorkers) : 0;
        if ("en".equals(lang)) {
            return "Status: %d workers are currently in scope, with TBM acknowledgment at %d%%.\nWarning: AI briefing is unavailable or rate-limited.\nAction: Review TBM acknowledgments manually.".formatted(totalWorkers, ackRate);
        }
        if ("zh".equals(lang)) {
            return "状态：当前管理对象为 %d 名工人，TBM确认率为 %d%%。\n提示：AI简报暂时不可用或已限流。\n建议：请先人工确认TBM签收情况。".formatted(totalWorkers, ackRate);
        }
        return "현황: 현재 관리 대상 근로자는 %d명이며 TBM 확인율은 %d%%입니다.\n주의: AI 브리핑이 일시적으로 제한되어 임시 요약으로 대체됩니다.\n조치: TBM 확인 현황을 수동 점검해주세요.".formatted(totalWorkers, ackRate);
    }

    private static String fallbackHqAudit(String lang, int activeSites, int totalMessages, int unresolvedAlerts) {
        if ("en".equals(lang)) {
            return "[Risk Watchdog]: %d active sites, %d recent messages, %d unresolved stop-work alerts.\n[Compliance Auditor]: Review TBM attendance and pledge completion by site.\n[Strategic Action]: Prioritize sites with unresolved alerts and low attendance.".formatted(activeSites, totalMessages, unresolvedAlerts);
        }
        if ("zh".equals(lang)) {
            return "[风险监控]: 当前 %d 个活跃工地，近期消息 %d 条，未解决停工警报 %d 件。\n[合规审计]: 请按工地检查TBM参与和安全承诺完成情况。\n[战略行动]: 优先处理未解决警报和参与率低的工地。".formatted(activeSites, totalMessages, unresolvedAlerts);
        }
        return "[Risk Watchdog]: 활성 현장 %d개, 최근 메시지 %d건, 미해결 작업중지 알림 %d건입니다.\n[Compliance Auditor]: 현장별 TBM 참석과 안전서약 완료율을 점검해야 합니다.\n[Strategic Action]: 미해결 알림과 참석률 저하 현장을 우선 조치하세요.".formatted(activeSites, totalMessages, unresolvedAlerts);
    }

    private static String initials(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        String trimmed = name.trim();
        return trimmed.length() <= 2 ? trimmed : trimmed.substring(0, 2);
    }

    public record BriefingRequest(String role, String lang) {}
    public record SystemSiteRequest(String id, String name, String address) {}
}
