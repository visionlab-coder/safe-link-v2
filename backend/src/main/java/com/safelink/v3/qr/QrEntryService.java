package com.safelink.v3.qr;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.auth.UserAccountRepository;
import com.safelink.v3.support.NotFoundException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QrEntryService {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Pattern INITIALS_PATTERN = Pattern.compile("^[A-Z0-9]{1,6}$");
    private static final Pattern PHONE_LAST4_PATTERN = Pattern.compile("^[0-9]{4}$");
    private static final Pattern LANG_PATTERN = Pattern.compile("^[a-z]{2,5}$");

    private final JdbcClient jdbc;
    private final UserAccountRepository users;
    private final AuditService audit;

    public QrEntryService(JdbcClient jdbc, UserAccountRepository users, AuditService audit) {
        this.jdbc = jdbc;
        this.users = users;
        this.audit = audit;
    }

    public QrEntryResponse info(String siteRef) {
        var site = resolveActiveSite(siteRef);
        return QrEntryResponse.info(site.toPayload());
    }

    @Transactional
    public EntryOutcome enter(QrEntryRequest request, String ipAddress) {
        var site = resolveActiveSite(request.siteId());
        String initials = cleanInitials(request.nameInitials());
        String phoneLast4 = cleanPhoneLast4(request.phoneLast4());
        String preferredLanguage = cleanLanguage(request.preferredLang());
        String nationality = cleanCountry(request.nationality());
        String trade = cleanTrade(request.trade());

        Long workerId = findOrCreateWorker(site.id(), initials, phoneLast4, preferredLanguage, ipAddress);
        users.updatePreferredLanguage(workerId, preferredLanguage);

        var account = users.findById(workerId)
            .orElseThrow(() -> new IllegalStateException("worker_user_not_found"));
        var access = applyDailyAccess(workerId, site.id(), ipAddress);

        audit.record(
            workerId,
            site.id(),
            "qr.site_entry",
            "worker_daily_access",
            access.id() == null ? null : String.valueOf(access.id()),
            "ALLOWED",
            access.action(),
            Map.of(
                "ip", ipAddress,
                "initials", initials,
                "phoneLast4", phoneLast4,
                "preferredLanguage", preferredLanguage,
                "nationality", nationality,
                "trade", trade
            )
        );

        var response = new QrEntryResponse(
            true,
            new WorkerPayload(String.valueOf(workerId), account.displayName(), preferredLanguage, initials),
            site.toPayload(),
            new AccessPayload(access.action(), access.active(), access.workDate().toString(), String.valueOf(site.id())),
            access.active() ? "no_active_session" : "checked_out",
            null,
            access.active(),
            access.active() ? "spring" : "none",
            null,
            null
        );
        return new EntryOutcome(response, access.active() ? account.toPrincipal() : null);
    }

    private Long findOrCreateWorker(
        Long siteId,
        String initials,
        String phoneLast4,
        String preferredLanguage,
        String ipAddress
    ) {
        List<Long> matches = findWorkerIds(siteId, initials, phoneLast4);
        if (matches.size() > 1) {
            audit.record(null, siteId, "qr.site_entry", "worker", null, "DENIED", "worker_match_ambiguous", Map.of("ip", ipAddress));
            throw new IllegalArgumentException("worker_match_ambiguous");
        }
        if (matches.size() == 1) {
            return matches.getFirst();
        }

        String email = internalWorkerEmail(siteId, initials, phoneLast4);
        Optional<Long> existing = findUserIdByEmail(email);
        Long workerId = existing.orElseGet(() -> createInternalWorker(email, initials, preferredLanguage));
        ensureWorkerContracts(workerId, siteId, initials, phoneLast4);
        audit.record(workerId, siteId, "qr.worker.auto_enroll", "worker", String.valueOf(workerId), "ALLOWED", "created_or_restored", Map.of("ip", ipAddress));
        return workerId;
    }

    private Long createInternalWorker(String email, String initials, String preferredLanguage) {
        try {
            return jdbc.sql("""
                    insert into users(email, display_name, preferred_language, account_status)
                    values (:email, :displayName, :preferredLanguage, 'ACTIVE')
                    returning id
                """)
                .param("email", email)
                .param("displayName", initials)
                .param("preferredLanguage", preferredLanguage)
                .query(Long.class)
                .single();
        } catch (DataIntegrityViolationException e) {
            return findUserIdByEmail(email)
                .orElseThrow(() -> e);
        }
    }

    private void ensureWorkerContracts(Long workerId, Long siteId, String initials, String phoneLast4) {
        jdbc.sql("""
                insert into user_roles(user_id, role, granted_by)
                select :workerId, 'WORKER', null
                where not exists (
                  select 1
                  from user_roles
                  where user_id = :workerId
                    and role = 'WORKER'
                    and revoked_at is null
                )
            """)
            .param("workerId", workerId)
            .update();

        jdbc.sql("""
                insert into site_memberships(user_id, site_id, role, status)
                values (:workerId, :siteId, 'WORKER', 'ACTIVE')
                on conflict (user_id, site_id, role)
                do update set status = 'ACTIVE'
            """)
            .param("workerId", workerId)
            .param("siteId", siteId)
            .update();

        jdbc.sql("""
                insert into worker_quick_login_credentials(user_id, name_initials, phone_last4, enabled)
                values (:workerId, :initials, :phoneLast4, true)
                on conflict (user_id)
                do update set
                  name_initials = excluded.name_initials,
                  phone_last4 = excluded.phone_last4,
                  enabled = true,
                  updated_at = now()
            """)
            .param("workerId", workerId)
            .param("initials", initials)
            .param("phoneLast4", phoneLast4)
            .update();
    }

    private List<Long> findWorkerIds(Long siteId, String initials, String phoneLast4) {
        return jdbc.sql("""
                select distinct u.id
                from worker_quick_login_credentials q
                join users u on u.id = q.user_id
                join user_roles ur on ur.user_id = u.id
                join site_memberships sm on sm.user_id = u.id
                where q.enabled = true
                  and q.name_initials = :initials
                  and q.phone_last4 = :phoneLast4
                  and u.account_status = 'ACTIVE'
                  and ur.role = 'WORKER'
                  and ur.revoked_at is null
                  and sm.site_id = :siteId
                  and sm.role = 'WORKER'
                  and sm.status = 'ACTIVE'
                order by u.id
                limit 2
            """)
            .param("siteId", siteId)
            .param("initials", initials)
            .param("phoneLast4", phoneLast4)
            .query(Long.class)
            .list();
    }

    private AccessRecord applyDailyAccess(Long workerId, Long siteId, String ipAddress) {
        LocalDate workDate = LocalDate.now(SEOUL);
        OffsetDateTime now = OffsetDateTime.now(SEOUL);
        Optional<AccessRow> existing = findDailyAccess(workerId, siteId, workDate);
        if (existing.isPresent()) {
            var row = existing.get();
            if ("CHECKED_OUT".equals(row.status())) {
                return new AccessRecord(row.id(), "checked_out", false, workDate);
            }
            jdbc.sql("""
                    update worker_daily_access
                    set status = 'CHECKED_OUT',
                        checked_out_at = :now,
                        last_seen_at = :now,
                        updated_at = :now
                    where id = :id
                """)
                .param("id", row.id())
                .param("now", now)
                .update();
            audit.record(workerId, siteId, "qr.worker_checkout", "worker_daily_access", String.valueOf(row.id()), "ALLOWED", "site_qr_rescan", Map.of("ip", ipAddress));
            return new AccessRecord(row.id(), "checked_out", false, workDate);
        }

        try {
            Long accessId = jdbc.sql("""
                    insert into worker_daily_access(worker_id, site_id, work_date, status, checked_in_at, last_seen_at, entry_method)
                    values (:workerId, :siteId, :workDate, 'ACTIVE', :now, :now, 'QR')
                    returning id
                """)
                .param("workerId", workerId)
                .param("siteId", siteId)
                .param("workDate", workDate)
                .param("now", now)
                .query(Long.class)
                .single();
            audit.record(workerId, siteId, "qr.worker_checkin", "worker_daily_access", String.valueOf(accessId), "ALLOWED", "site_qr", Map.of("ip", ipAddress));
            return new AccessRecord(accessId, "checked_in", true, workDate);
        } catch (DataIntegrityViolationException e) {
            return findDailyAccess(workerId, siteId, workDate)
                .map(row -> new AccessRecord(row.id(), "already_checked_in", "ACTIVE".equals(row.status()), workDate))
                .orElseThrow(() -> e);
        }
    }

    private Optional<AccessRow> findDailyAccess(Long workerId, Long siteId, LocalDate workDate) {
        return jdbc.sql("""
                select id, status
                from worker_daily_access
                where worker_id = :workerId
                  and site_id = :siteId
                  and work_date = :workDate
                limit 1
            """)
            .param("workerId", workerId)
            .param("siteId", siteId)
            .param("workDate", workDate)
            .query((rs, rowNum) -> new AccessRow(rs.getLong("id"), rs.getString("status")))
            .optional();
    }

    private SiteRecord resolveActiveSite(String siteRef) {
        String ref = siteRef == null ? "" : siteRef.trim();
        if (ref.isBlank()) {
            throw new IllegalArgumentException("site_id_required");
        }
        if (ref.matches("^[0-9]+$")) {
            return jdbc.sql("""
                    select id, name
                    from sites
                    where id = :siteId
                      and status = 'ACTIVE'
                    limit 1
                """)
                .param("siteId", Long.valueOf(ref))
                .query((rs, rowNum) -> new SiteRecord(rs.getLong("id"), rs.getString("name")))
                .optional()
                .orElseThrow(() -> new NotFoundException("site_not_found"));
        }
        return jdbc.sql("""
                select id, name
                from sites
                where lower(name) = lower(:siteName)
                  and status = 'ACTIVE'
                order by id
                limit 1
            """)
            .param("siteName", ref)
            .query((rs, rowNum) -> new SiteRecord(rs.getLong("id"), rs.getString("name")))
            .optional()
            .orElseThrow(() -> new NotFoundException("site_not_found"));
    }

    private Optional<Long> findUserIdByEmail(String email) {
        return jdbc.sql("""
                select id
                from users
                where lower(email) = lower(:email)
                limit 1
            """)
            .param("email", email)
            .query(Long.class)
            .optional();
    }

    private static String cleanInitials(String value) {
        String initials = value == null ? "" : value.trim().replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        if (!INITIALS_PATTERN.matcher(initials).matches()) {
            throw new IllegalArgumentException("initials_required");
        }
        return initials;
    }

    private static String cleanPhoneLast4(String value) {
        String digits = value == null ? "" : value.replaceAll("\\D", "");
        if (!PHONE_LAST4_PATTERN.matcher(digits).matches()) {
            throw new IllegalArgumentException("phone_last4_required");
        }
        return digits;
    }

    private static String cleanLanguage(String value) {
        String language = value == null ? "ko" : value.trim().toLowerCase(Locale.ROOT);
        return LANG_PATTERN.matcher(language).matches() ? language : "ko";
    }

    private static String cleanCountry(String value) {
        String country = value == null ? "KR" : value.trim().toUpperCase(Locale.ROOT);
        return country.matches("^[A-Z]{2}$") ? country : "KR";
    }

    private static String cleanTrade(String value) {
        if (value == null || value.isBlank()) {
            return "general";
        }
        String trade = value.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "");
        if (trade.isBlank()) {
            return "general";
        }
        return trade.substring(0, Math.min(32, trade.length()));
    }

    private static String internalWorkerEmail(Long siteId, String initials, String phoneLast4) {
        return "qr." + siteId + "." + initials.toLowerCase(Locale.ROOT) + "." + phoneLast4 + "@safe-link.internal";
    }

    public record QrEntryRequest(
        @JsonProperty("site_id") String siteId,
        String mode,
        @JsonProperty("name_initials") String nameInitials,
        @JsonProperty("phone_last4") String phoneLast4,
        String nationality,
        @JsonProperty("preferred_lang") String preferredLang,
        String trade
    ) {}

    public record EntryOutcome(QrEntryResponse response, SessionPrincipal principal) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record QrEntryResponse(
        boolean ok,
        WorkerPayload worker,
        SitePayload site,
        AccessPayload access,
        @JsonProperty("qr_action") String qrAction,
        SessionPayload session,
        @JsonProperty("session_established") Boolean sessionEstablished,
        @JsonProperty("session_source") String sessionSource,
        @JsonProperty("session_error") String sessionError,
        String error
    ) {
        static QrEntryResponse info(SitePayload site) {
            return new QrEntryResponse(true, null, site, null, null, null, null, null, null, null);
        }
    }

    public record WorkerPayload(String id, String name, @JsonProperty("preferred_lang") String preferredLang, @JsonProperty("name_initials") String nameInitials) {}
    public record SitePayload(String id, String name, String code) {}
    public record AccessPayload(String action, boolean active, @JsonProperty("work_date") String workDate, @JsonProperty("site_id") String siteId) {}
    public record SessionPayload(String id, String title) {}

    private record SiteRecord(Long id, String name) {
        SitePayload toPayload() {
            return new SitePayload(String.valueOf(id), name, null);
        }
    }

    private record AccessRow(Long id, String status) {}
    private record AccessRecord(Long id, String action, boolean active, LocalDate workDate) {}
}
