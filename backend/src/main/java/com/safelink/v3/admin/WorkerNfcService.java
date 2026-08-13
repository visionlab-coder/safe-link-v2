package com.safelink.v3.admin;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.auth.UserAccountRepository;
import com.safelink.v3.security.SiteGuard;
import com.safelink.v3.support.NotFoundException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkerNfcService {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Pattern INITIALS_PATTERN = Pattern.compile("^[A-Z0-9]{1,6}$");
    private static final Pattern PHONE_LAST4_PATTERN = Pattern.compile("^[0-9]{4}$");
    private static final Pattern LANG_PATTERN = Pattern.compile("^[a-z]{2,5}$");
    private static final Pattern COUNTRY_PATTERN = Pattern.compile("^[A-Z]{2}$");
    private static final Pattern TRADE_PATTERN = Pattern.compile("^[a-z0-9_-]{1,32}$");
    private static final int DEFAULT_QR_TTL_MINUTES = 30;
    private static final int NFC_SIG_CURRENT_VERSION = 1;

    private final JdbcClient jdbc;
    private final SiteGuard siteGuard;
    private final AuditService audit;
    private final UserAccountRepository users;
    private final ObjectMapper objectMapper;
    private final String qrHmacSecret;
    private final String stickerSecret;
    private final String configuredBaseUrl;

    public WorkerNfcService(
        JdbcClient jdbc,
        SiteGuard siteGuard,
        AuditService audit,
        UserAccountRepository users,
        ObjectMapper objectMapper,
        @Value("${safe-link.nfc.hmac-secret:${NFC_HMAC_SECRET:}}") String qrHmacSecret,
        @Value("${safe-link.nfc.sticker-secret:${NFC_STICKER_SECRET:}}") String stickerSecret,
        @Value("${safe-link.nfc.base-url:}") String configuredBaseUrl
    ) {
        this.jdbc = jdbc;
        this.siteGuard = siteGuard;
        this.audit = audit;
        this.users = users;
        this.objectMapper = objectMapper;
        this.qrHmacSecret = qrHmacSecret == null ? "" : qrHmacSecret.trim();
        this.stickerSecret = stickerSecret == null ? "" : stickerSecret.trim();
        this.configuredBaseUrl = configuredBaseUrl == null ? "" : configuredBaseUrl.trim();
    }

    public WorkerListResponse list(SessionPrincipal actor, String requestedSiteId, String q, boolean activeOnly, int limit) {
        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 50 : limit, 200));
        return new WorkerListResponse(queryWorkers(actor, requestedSiteId, q, activeOnly, null, safeLimit));
    }

    public WorkerPageResponse listPage(SessionPrincipal actor, String requestedSiteId, String q, boolean activeOnly, Long cursor, int limit) {
        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 100 : limit, 200));
        List<WorkerResponse> fetched = queryWorkers(actor, requestedSiteId, q, activeOnly, cursor, safeLimit + 1);
        boolean hasMore = fetched.size() > safeLimit;
        List<WorkerResponse> workers = hasMore ? List.copyOf(fetched.subList(0, safeLimit)) : fetched;
        String nextCursor = hasMore && !workers.isEmpty() ? workers.get(workers.size() - 1).id() : null;
        return new WorkerPageResponse(workers, nextCursor, hasMore);
    }

    private List<WorkerResponse> queryWorkers(SessionPrincipal actor, String requestedSiteId, String q, boolean activeOnly, Long cursor, int limit) {
        Long siteId = parseOptionalLong(requestedSiteId);
        if (siteId == null && !actor.hasAnyGlobalRole()) {
            if (actor.siteIds().isEmpty()) {
                throw new IllegalArgumentException("admin_site_required");
            }
            siteId = actor.siteIds().stream().sorted().findFirst().orElseThrow();
        }
        if (siteId != null) {
            siteGuard.requireGlobalOrSiteAdmin(actor, siteId, "admin.worker.list", "site", String.valueOf(siteId));
        }

        String search = cleanSearch(q);
        String sql = """
            select u.id,
                   coalesce(wp.worker_code, 'WRK-' || lpad(u.id::text, 6, '0')) as worker_code,
                   u.display_name as full_name,
                   coalesce(wp.nationality, 'KR') as nationality,
                   coalesce(u.phone, wp.phone) as phone,
                   sm.site_id as assigned_site_id,
                   coalesce(wp.trade, 'general') as trade,
                   u.preferred_language as preferred_lang,
                   coalesce(wp.is_active, true) as is_active,
                   wp.consent_signed_at,
                   u.created_at
            from users u
            join user_roles ur on ur.user_id = u.id and ur.role = 'WORKER' and ur.revoked_at is null
            join site_memberships sm on sm.user_id = u.id and sm.role = 'WORKER' and sm.status = 'ACTIVE'
            left join worker_profiles wp on wp.user_id = u.id
            where u.account_status = 'ACTIVE'
            """ + (siteId == null ? "" : " and sm.site_id = :siteId\n")
            + (cursor == null ? "" : " and u.id < :cursor\n")
            + (activeOnly ? " and coalesce(wp.is_active, true) = true\n" : "")
            + (search.isBlank() ? "" : """
              and (
                lower(u.display_name) like :search
                or lower(coalesce(wp.worker_code, 'WRK-' || lpad(u.id::text, 6, '0'))) like :search
                or lower(coalesce(u.phone, wp.phone, '')) like :search
              )
            """)
            + " order by u.id desc limit :limit";

        var spec = jdbc.sql(sql).param("limit", limit);
        if (siteId != null) spec = spec.param("siteId", siteId);
        if (cursor != null) spec = spec.param("cursor", cursor);
        if (!search.isBlank()) spec = spec.param("search", "%" + search + "%");

        return spec.query((rs, rowNum) -> new WorkerResponse(
            String.valueOf(rs.getLong("id")),
            rs.getString("worker_code"),
            rs.getString("full_name"),
            rs.getString("nationality"),
            rs.getString("phone"),
            String.valueOf(rs.getLong("assigned_site_id")),
            rs.getString("trade"),
            rs.getString("preferred_lang"),
            rs.getBoolean("is_active"),
            rs.getObject("consent_signed_at", OffsetDateTime.class),
            rs.getObject("created_at", OffsetDateTime.class),
            null,
            null,
            null
        )).list();
    }

    @Transactional
    public WorkerResponse create(SessionPrincipal actor, CreateWorkerRequest request) {
        Long siteId = parseRequiredLong(request.assignedSiteId(), "assigned_site_id_required");
        siteGuard.requireGlobalOrSiteAdmin(actor, siteId, "admin.worker.create", "worker", null);

        String initials = cleanInitials(request.nameInitials());
        String phoneLast4 = cleanPhoneLast4(request.phoneLast4());
        String displayName = cleanDisplayName(request.fullName(), initials);
        String phone = cleanOptionalPhone(request.phone());
        String email = phone == null ? internalWorkerEmail(siteId, initials, phoneLast4) : null;
        String nationality = cleanCountry(request.nationality());
        String preferredLanguage = cleanLanguage(request.preferredLang());
        String trade = cleanTrade(request.trade());
        OffsetDateTime consentSignedAt = parseOptionalInstant(request.consentSignedAt());

        try {
            Long workerId = jdbc.sql("""
                    insert into users(email, phone, display_name, preferred_language, account_status)
                    values (:email, :phone, :displayName, :preferredLanguage, 'ACTIVE')
                    returning id
                """)
                .param("email", email)
                .param("phone", phone)
                .param("displayName", displayName)
                .param("preferredLanguage", preferredLanguage)
                .query(Long.class)
                .single();

            ensureWorkerContracts(workerId, siteId, actor.userId(), initials, phoneLast4);
            upsertWorkerProfile(workerId, siteId, displayName, nationality, phone, trade, consentSignedAt, request.consentDocUrl(), actor.userId());
            audit.record(actor.userId(), siteId, "admin.worker.create", "worker", String.valueOf(workerId), "ALLOWED", "created", Map.of("role", "WORKER"));
            return read(actor, String.valueOf(workerId));
        } catch (DataIntegrityViolationException e) {
            audit.record(actor.userId(), siteId, "admin.worker.create", "worker", null, "DENIED", "duplicate_worker", Map.of());
            throw new IllegalArgumentException("duplicate_worker");
        }
    }

    public WorkerResponse read(SessionPrincipal actor, String workerId) {
        Long id = parseRequiredLong(workerId, "worker_not_found");
        var row = findWorker(id).orElseThrow(() -> new NotFoundException("worker_not_found"));
        siteGuard.requireSiteAccess(actor, row.assignedSiteIdLong(), "admin.worker.read", "worker", workerId);
        return row;
    }

    @Transactional
    public WorkerResponse update(SessionPrincipal actor, String workerId, UpdateWorkerRequest request) {
        Long id = parseRequiredLong(workerId, "worker_not_found");
        var current = findWorker(id).orElseThrow(() -> new NotFoundException("worker_not_found"));
        siteGuard.requireGlobalOrSiteAdmin(actor, current.assignedSiteIdLong(), "admin.worker.update", "worker", workerId);

        String displayName = request.fullName() == null ? current.fullName() : cleanDisplayName(request.fullName(), current.fullName());
        String preferredLanguage = request.preferredLang() == null ? current.preferredLang() : cleanLanguage(request.preferredLang());
        String nationality = request.nationality() == null ? current.nationality() : cleanCountry(request.nationality());
        String trade = request.trade() == null ? current.trade() : cleanTrade(request.trade());
        String phone = request.phone() == null ? current.phone() : cleanOptionalPhone(request.phone());
        Long siteId = request.assignedSiteId() == null ? current.assignedSiteIdLong() : parseRequiredLong(request.assignedSiteId(), "assigned_site_id_invalid");

        if (!siteId.equals(current.assignedSiteIdLong())) {
            siteGuard.requireGlobalOrSiteAdmin(actor, siteId, "admin.worker.move", "worker", workerId);
            moveWorkerSite(id, current.assignedSiteIdLong(), siteId);
        }

        jdbc.sql("""
                update users
                set display_name = :displayName,
                    preferred_language = :preferredLanguage,
                    phone = :phone
                where id = :workerId
            """)
            .param("displayName", displayName)
            .param("preferredLanguage", preferredLanguage)
            .param("phone", phone)
            .param("workerId", id)
            .update();

        jdbc.sql("""
                update worker_profiles
                set nationality = :nationality,
                    phone = :phone,
                    trade = :trade,
                    notes = coalesce(:notes, notes),
                    updated_at = now()
                where user_id = :workerId
            """)
            .param("nationality", nationality)
            .param("phone", phone)
            .param("trade", trade)
            .param("notes", request.notes())
            .param("workerId", id)
            .update();

        audit.record(actor.userId(), siteId, "admin.worker.update", "worker", workerId, "ALLOWED", "updated", Map.of());
        return read(actor, workerId);
    }

    @Transactional
    public void deactivate(SessionPrincipal actor, String workerId) {
        Long id = parseRequiredLong(workerId, "worker_not_found");
        var current = findWorker(id).orElseThrow(() -> new NotFoundException("worker_not_found"));
        siteGuard.requireGlobalOrSiteAdmin(actor, current.assignedSiteIdLong(), "admin.worker.deactivate", "worker", workerId);

        jdbc.sql("update worker_profiles set is_active = false, updated_at = now() where user_id = :workerId")
            .param("workerId", id)
            .update();
        jdbc.sql("update worker_quick_login_credentials set enabled = false, updated_at = now() where user_id = :workerId")
            .param("workerId", id)
            .update();
        jdbc.sql("update users set account_status = 'DEACTIVATED' where id = :workerId")
            .param("workerId", id)
            .update();
        jdbc.sql("""
                update worker_stickers
                set is_active = false,
                    revoked_at = now(),
                    revoked_by = :actorId,
                    revoke_reason = 'worker_deactivated'
                where worker_id = :workerId
                  and is_active = true
            """)
            .param("actorId", actor.userId())
            .param("workerId", id)
            .update();
        audit.record(actor.userId(), current.assignedSiteIdLong(), "admin.worker.deactivate", "worker", workerId, "ALLOWED", "deactivated", Map.of());
    }

    @Transactional
    public QrTokenResponse issueQrToken(SessionPrincipal actor, String workerId, String requestedSiteId, Integer ttlMinutes, String requestOrigin) {
        Long id = parseRequiredLong(workerId, "worker_not_found");
        var worker = findWorker(id).orElseThrow(() -> new NotFoundException("worker_not_found"));
        if (!worker.isActive()) {
            throw new IllegalArgumentException("worker_inactive");
        }
        Long siteId = requestedSiteId == null || requestedSiteId.isBlank()
            ? worker.assignedSiteIdLong()
            : parseRequiredLong(requestedSiteId, "siteId_invalid");
        if (!siteId.equals(worker.assignedSiteIdLong())) {
            throw new IllegalArgumentException("site_mismatch");
        }
        siteGuard.requireGlobalOrSiteAdmin(actor, siteId, "admin.worker.qr_token", "worker", workerId);
        requireQrSecret();

        int minutes = Math.max(1, Math.min(ttlMinutes == null ? DEFAULT_QR_TTL_MINUTES : ttlMinutes, 120));
        long expiresAt = Instant.now().plusSeconds(minutes * 60L).getEpochSecond();
        String nonce = randomHex(16);
        String payload = id + "|" + siteId + "|" + expiresAt + "|" + nonce;
        String sig = hmacHex(qrHmacSecret, payload);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString((payload + "|" + sig).getBytes(StandardCharsets.UTF_8));

        jdbc.sql("""
                insert into worker_qr_token_nonces(nonce, worker_id, site_id, expires_at)
                values (:nonce, :workerId, :siteId, to_timestamp(:expiresAt))
            """)
            .param("nonce", nonce)
            .param("workerId", id)
            .param("siteId", siteId)
            .param("expiresAt", expiresAt)
            .update();

        String base = frontendBaseUrl(requestOrigin);
        return new QrTokenResponse(token, base + "/qr/" + token, String.valueOf(id), String.valueOf(siteId), minutes, worker.compact());
    }

    @Transactional
    public StickerIssueResponse issueSticker(SessionPrincipal actor, StickerIssueRequest request, String requestOrigin) {
        Long workerId = parseRequiredLong(request.workerId(), "worker_id_required");
        var worker = findWorker(workerId).orElseThrow(() -> new NotFoundException("worker_not_found"));
        if (!worker.isActive()) {
            throw new IllegalArgumentException("worker_inactive");
        }
        siteGuard.requireGlobalOrSiteAdmin(actor, worker.assignedSiteIdLong(), "admin.worker.sticker.issue", "worker", String.valueOf(workerId));
        requireStickerSecret();

        var revoked = jdbc.sql("""
                update worker_stickers
                set is_active = false,
                    revoked_at = now(),
                    revoked_by = :actorId,
                    revoke_reason = 'reissued'
                where worker_id = :workerId
                  and is_active = true
                returning id, sig_version, issued_epoch
            """)
            .param("actorId", actor.userId())
            .param("workerId", workerId)
            .query((rs, rowNum) -> new RevokedSticker(rs.getLong("id"), rs.getInt("sig_version"), rs.getLong("issued_epoch")))
            .list();
        for (var item : revoked) {
            insertCardEvent(workerId, item.id(), worker.assignedSiteIdLong(), "reissued", actor.userId(), null, item.sigVersion(), item.issuedEpoch(), null, "reissued", Map.of());
        }

        Integer latest = jdbc.sql("select max(sig_version) from worker_stickers where worker_id = :workerId")
            .param("workerId", workerId)
            .query(Integer.class)
            .optional()
            .orElse(0);
        int nextVersion = Math.max(latest == null ? 0 : latest, NFC_SIG_CURRENT_VERSION - 1) + 1;
        long issuedEpoch = Instant.now().getEpochSecond();
        String identityHint = worker.identityHint();
        String sig = signSticker(worker.workerCode(), nextVersion, issuedEpoch, identityHint);
        Long stickerId = jdbc.sql("""
                insert into worker_stickers(worker_id, site_id, sig_version, issued_epoch, identity_hint, issued_by, is_active)
                values (:workerId, :siteId, :sigVersion, :issuedEpoch, :identityHint, :actorId, true)
                returning id
            """)
            .param("workerId", workerId)
            .param("siteId", worker.assignedSiteIdLong())
            .param("sigVersion", nextVersion)
            .param("issuedEpoch", issuedEpoch)
            .param("identityHint", identityHint)
            .param("actorId", actor.userId())
            .query(Long.class)
            .single();

        String url = buildStickerUrl(requestOrigin, worker.workerCode(), nextVersion, issuedEpoch, sig, identityHint);
        int ndefBytes = 4 + url.getBytes(StandardCharsets.UTF_8).length;
        if (ndefBytes > 138) {
            jdbc.sql("""
                    update worker_stickers
                    set is_active = false,
                        revoked_at = now(),
                        revoked_by = :actorId,
                        revoke_reason = 'ndef_too_long'
                    where id = :stickerId
                """)
                .param("actorId", actor.userId())
                .param("stickerId", stickerId)
                .update();
            throw new IllegalArgumentException("ndef_too_long");
        }

        insertCardEvent(
            workerId,
            stickerId,
            worker.assignedSiteIdLong(),
            "issued",
            actor.userId(),
            null,
            nextVersion,
            issuedEpoch,
            ndefBytes,
            null,
            Map.of("worker_code", worker.workerCode(), "has_identity_hint", !identityHint.isBlank(), "revoke_previous", Boolean.TRUE.equals(request.revokePrevious()))
        );
        return new StickerIssueResponse(String.valueOf(stickerId), url, nextVersion, issuedEpoch, ndefBytes, worker.compact());
    }

    @Transactional
    public void recordStickerEvent(SessionPrincipal actor, StickerEventRequest request) {
        String eventType = request.eventType() == null ? "" : request.eventType().trim();
        if (!List.of("written", "erased", "revoked").contains(eventType)) {
            throw new IllegalArgumentException("event_type_invalid");
        }
        Long workerId = parseOptionalLong(request.workerId());
        Long stickerId = parseOptionalLong(request.stickerId());
        Long siteId = null;
        if (stickerId != null) {
            var sticker = jdbc.sql("select worker_id, site_id from worker_stickers where id = :stickerId")
                .param("stickerId", stickerId)
                .query((rs, rowNum) -> new long[] {rs.getLong("worker_id"), rs.getLong("site_id")})
                .optional()
                .orElseThrow(() -> new NotFoundException("sticker_not_found"));
            Long stickerWorkerId = sticker[0];
            if (workerId != null && !workerId.equals(stickerWorkerId)) {
                throw new IllegalArgumentException("sticker_worker_mismatch");
            }
            workerId = stickerWorkerId;
            siteId = sticker[1];
        } else if (workerId != null) {
            siteId = findWorker(workerId)
                .map(WorkerResponse::assignedSiteIdLong)
                .orElseThrow(() -> new NotFoundException("worker_not_found"));
        }
        if (siteId == null) {
            throw new IllegalArgumentException("sticker_or_worker_required");
        }
        siteGuard.requireGlobalOrSiteAdmin(actor, siteId, "admin.worker.sticker.event", "worker_sticker", request.stickerId());

        if ("erased".equals(eventType) && stickerId != null) {
            jdbc.sql("""
                    update worker_stickers
                    set is_active = false,
                        revoked_at = now(),
                        revoked_by = :actorId,
                        revoke_reason = :reason
                    where id = :stickerId
                """)
                .param("actorId", actor.userId())
                .param("reason", blankToNull(request.reason()) == null ? "erased_for_reuse" : request.reason())
                .param("stickerId", stickerId)
                .update();
        }

        insertCardEvent(workerId, stickerId, siteId, eventType, actor.userId(), request.tagUid(), null, null, null, request.reason(), request.metadata() == null ? Map.of() : request.metadata());
    }

    public SiteAccessControlResponse getSiteAccess(SessionPrincipal actor, String requestedSiteId) {
        Long siteId = requestedSiteId == null || requestedSiteId.isBlank()
            ? actor.siteIds().stream().sorted().findFirst().orElseThrow(() -> new IllegalArgumentException("site_id_required"))
            : parseRequiredLong(requestedSiteId, "site_id_invalid");
        siteGuard.requireSiteAccess(actor, siteId, "admin.site_access.read", "site", String.valueOf(siteId));
        var control = jdbc.sql("""
                select s.id, coalesce(c.is_enabled, true) as is_enabled, c.reason, c.updated_at
                from sites s
                left join site_access_controls c on c.site_id = s.id
                where s.id = :siteId
                limit 1
            """)
            .param("siteId", siteId)
            .query((rs, rowNum) -> new SiteAccessControl(
                String.valueOf(rs.getLong("id")),
                rs.getBoolean("is_enabled"),
                rs.getString("reason"),
                rs.getObject("updated_at", OffsetDateTime.class)
            ))
            .optional()
            .orElseThrow(() -> new NotFoundException("site_not_found"));
        return new SiteAccessControlResponse(control);
    }

    public SiteChallengeResponse getSiteChallenge(SessionPrincipal actor, String requestedSiteId) {
        Long siteId = resolveAdminSiteId(actor, requestedSiteId);
        siteGuard.requireSiteAccess(actor, siteId, "admin.site_challenge.read", "site", String.valueOf(siteId));
        LocalDate workDate = LocalDate.now(SEOUL);
        return new SiteChallengeResponse(findSiteChallenge(siteId, workDate).orElse(null), workDate.toString(), String.valueOf(siteId));
    }

    @Transactional
    public SiteChallengeResponse updateSiteChallenge(SessionPrincipal actor, SiteChallengeRequest request) {
        Long siteId = resolveAdminSiteId(actor, request.siteId());
        siteGuard.requireGlobalOrSiteAdmin(actor, siteId, "admin.site_challenge.update", "site", String.valueOf(siteId));
        LocalDate workDate = LocalDate.now(SEOUL);
        String code = null;
        if (!Boolean.TRUE.equals(request.rotate())) {
            code = findSiteChallenge(siteId, workDate).map(SiteChallenge::challengeCode).orElse(null);
        }
        if (code == null || code.isBlank()) {
            code = String.valueOf(100000 + new java.security.SecureRandom().nextInt(900000));
        }
        OffsetDateTime expiresAt = workDate.plusDays(1).atStartOfDay(SEOUL).toOffsetDateTime();
        jdbc.sql("""
                insert into site_daily_challenges(site_id, work_date, challenge_code, is_active, created_by, expires_at, metadata)
                values (:siteId, :workDate, :code, true, :actorId, :expiresAt, cast(:metadata as jsonb))
                on conflict (site_id, work_date)
                do update set
                  challenge_code = excluded.challenge_code,
                  is_active = true,
                  created_by = excluded.created_by,
                  expires_at = excluded.expires_at,
                  created_at = now(),
                  metadata = excluded.metadata
            """)
            .param("siteId", siteId)
            .param("workDate", workDate)
            .param("code", code)
            .param("actorId", actor.userId())
            .param("expiresAt", expiresAt)
            .param("metadata", "{\"source\":\"admin_nfc_console\",\"rotated\":" + Boolean.TRUE.equals(request.rotate()) + "}")
            .update();
        audit.record(actor.userId(), siteId, "admin.site_challenge.update", "site", String.valueOf(siteId), "ALLOWED", Boolean.TRUE.equals(request.rotate()) ? "rotated" : "prepared", Map.of());
        return getSiteChallenge(actor, String.valueOf(siteId));
    }

    @Transactional
    public SiteAccessControlResponse updateSiteAccess(SessionPrincipal actor, SiteAccessControlUpdate request) {
        Long siteId = request.siteId() == null || request.siteId().isBlank()
            ? actor.siteIds().stream().sorted().findFirst().orElseThrow(() -> new IllegalArgumentException("site_id_required"))
            : parseRequiredLong(request.siteId(), "site_id_invalid");
        siteGuard.requireGlobalOrSiteAdmin(actor, siteId, "admin.site_access.update", "site", String.valueOf(siteId));
        jdbc.sql("""
                insert into site_access_controls(site_id, is_enabled, reason, updated_by, updated_at)
                values (:siteId, :enabled, :reason, :actorId, now())
                on conflict (site_id)
                do update set
                  is_enabled = excluded.is_enabled,
                  reason = excluded.reason,
                  updated_by = excluded.updated_by,
                  updated_at = now()
            """)
            .param("siteId", siteId)
            .param("enabled", request.isEnabled() == null || request.isEnabled())
            .param("reason", blankToNull(request.reason()))
            .param("actorId", actor.userId())
            .update();
        audit.record(actor.userId(), siteId, "admin.site_access.update", "site", String.valueOf(siteId), "ALLOWED", request.isEnabled() == Boolean.FALSE ? "disabled" : "enabled", Map.of());
        return getSiteAccess(actor, String.valueOf(siteId));
    }

    public TbmSessionListResponse listTbmSessions(SessionPrincipal actor, String requestedSiteId, String statusFilter) {
        Long siteId = parseOptionalLong(requestedSiteId);
        if (!actor.hasAnyGlobalRole()) {
            siteId = actor.siteIds().stream().sorted().findFirst().orElseThrow(() -> new IllegalArgumentException("site_id_required"));
        } else if (siteId != null) {
            siteGuard.requireSiteAccess(actor, siteId, "admin.tbm_session.list", "site", String.valueOf(siteId));
        }

        String statusSql = "";
        if ("open".equals(statusFilter)) {
            statusSql = " and status in ('open', 'running')\n";
        } else if (statusFilter != null && !statusFilter.isBlank()) {
            statusSql = " and status = :status\n";
        }

        var spec = jdbc.sql("""
                select id, site_id, tbm_notice_id, title, status, started_at, ended_at, started_by, ended_by
                from tbm_sessions
                where 1 = 1
            """ + (siteId == null ? "" : " and site_id = :siteId\n") + statusSql + " order by started_at desc limit 20")
            .param("limit", 20);
        if (siteId != null) spec = spec.param("siteId", siteId);
        if (statusFilter != null && !statusFilter.isBlank() && !"open".equals(statusFilter)) {
            spec = spec.param("status", statusFilter);
        }
        return new TbmSessionListResponse(spec.query((rs, rowNum) -> mapTbmSession(rs)).list());
    }

    @Transactional
    public TbmSessionPayload createTbmSession(SessionPrincipal actor, TbmSessionCreateRequest request) {
        Long siteId = parseRequiredLong(request.siteId(), "site_id_required");
        siteGuard.requireGlobalOrSiteAdmin(actor, siteId, "admin.tbm_session.create", "tbm_session", null);
        var session = jdbc.sql("""
                insert into tbm_sessions(site_id, tbm_notice_id, title, status, started_by)
                values (:siteId, :tbmNoticeId, :title, 'running', :actorId)
                returning id, site_id, tbm_notice_id, title, status, started_at, ended_at, started_by, ended_by
            """)
            .param("siteId", siteId)
            .param("tbmNoticeId", blankToNull(request.tbmNoticeId()))
            .param("title", blankToNull(request.title()))
            .param("actorId", actor.userId())
            .query((rs, rowNum) -> mapTbmSession(rs))
            .single();
        audit.record(actor.userId(), siteId, "admin.tbm_session.create", "tbm_session", session.id(), "ALLOWED", "created", Map.of());
        return session;
    }

    public TbmSessionDetailResponse readTbmSession(SessionPrincipal actor, String sessionId) {
        var session = findTbmSession(parseRequiredLong(sessionId, "session_not_found"))
            .orElseThrow(() -> new NotFoundException("session_not_found"));
        siteGuard.requireSiteAccess(actor, session.siteIdLong(), "admin.tbm_session.read", "tbm_session", session.id());
        var attendance = jdbc.sql("""
                select a.id,
                       a.worker_id,
                       a.tapped_at,
                       a.lang_used,
                       a.certified_at,
                       a.is_certified,
                       coalesce(wp.worker_code, 'WRK-' || lpad(u.id::text, 6, '0')) as worker_code,
                       u.display_name as full_name,
                       coalesce(wp.nationality, 'KR') as nationality,
                       coalesce(wp.trade, 'general') as trade
                from tbm_attendance a
                join users u on u.id = a.worker_id
                left join worker_profiles wp on wp.user_id = u.id
                where a.session_id = :sessionId
                order by a.tapped_at asc
            """)
            .param("sessionId", session.idLong())
            .query((rs, rowNum) -> new TbmAttendancePayload(
                String.valueOf(rs.getLong("id")),
                String.valueOf(rs.getLong("worker_id")),
                rs.getObject("tapped_at", OffsetDateTime.class),
                rs.getString("lang_used"),
                rs.getString("worker_code"),
                rs.getString("full_name"),
                rs.getString("nationality"),
                rs.getString("trade"),
                rs.getObject("certified_at", OffsetDateTime.class),
                rs.getBoolean("is_certified")
            ))
            .list();
        return new TbmSessionDetailResponse(session, attendance);
    }

    @Transactional
    public TbmSessionPayload updateTbmSession(SessionPrincipal actor, String sessionId, TbmSessionActionRequest request) {
        Long id = parseRequiredLong(sessionId, "session_not_found");
        var current = findTbmSession(id).orElseThrow(() -> new NotFoundException("session_not_found"));
        siteGuard.requireGlobalOrSiteAdmin(actor, current.siteIdLong(), "admin.tbm_session.update", "tbm_session", sessionId);
        String action = request.action() == null ? "" : request.action().trim();
        if (!List.of("start", "close").contains(action)) {
            throw new IllegalArgumentException("invalid_action. use: start | close");
        }
        String status = "start".equals(action) ? "running" : "closed";
        String allowed = "start".equals(action) ? "('open')" : "('open','running')";
        String endedSql = "close".equals(action) ? ", ended_at = now(), ended_by = :actorId\n" : "";
        var spec = jdbc.sql("""
                update tbm_sessions
                set status = :status
            """ + endedSql + """
                where id = :id
                  and status in """ + allowed + """
                returning id, site_id, tbm_notice_id, title, status, started_at, ended_at, started_by, ended_by
            """)
            .param("status", status)
            .param("id", id);
        if ("close".equals(action)) spec = spec.param("actorId", actor.userId());
        var updated = spec.query((rs, rowNum) -> mapTbmSession(rs)).optional();
        if (updated.isEmpty()) {
            throw new IllegalArgumentException("invalid_state_transition");
        }
        audit.record(actor.userId(), current.siteIdLong(), "admin.tbm_session.update", "tbm_session", sessionId, "ALLOWED", action, Map.of());
        return updated.get();
    }

    @Transactional
    public TbmTapResponse tapTbmSession(SessionPrincipal actor, String sessionId, TbmTapRequest request, String requestOrigin) {
        var session = findTbmSession(parseRequiredLong(sessionId, "session_not_found"))
            .orElseThrow(() -> new NotFoundException("session_not_found"));
        if ("closed".equals(session.status())) {
            throw new IllegalArgumentException("session_closed");
        }
        siteGuard.requireGlobalOrSiteAdmin(actor, session.siteIdLong(), "admin.tbm_session.tap", "tbm_session", sessionId);
        var sticker = validateSticker(request.url(), requestOrigin);
        var worker = findWorker(sticker.workerId()).orElseThrow(() -> new NotFoundException("worker_not_found"));
        if (!worker.isActive()) {
            throw new IllegalArgumentException("worker_inactive");
        }
        if (!worker.assignedSiteIdLong().equals(session.siteIdLong())) {
            throw new IllegalArgumentException("worker_site_mismatch");
        }
        if (!isSiteAccessEnabled(session.siteIdLong())) {
            throw new IllegalArgumentException("site_access_disabled");
        }
        var dailyAccess = findDailyAccess(worker.idLong(), session.siteIdLong(), LocalDate.now(SEOUL));
        if (dailyAccess.isPresent() && "CHECKED_OUT".equals(dailyAccess.get().status())) {
            throw new IllegalArgumentException("worker_checked_out_until_next_day");
        }
        applyDailyAccess(worker.idLong(), session.siteIdLong(), false);

        OffsetDateTime now = OffsetDateTime.now(SEOUL);
        var workerPayload = new TbmWorkerPayload(worker.id(), worker.workerCode(), worker.fullName(), worker.nationality(), worker.trade());
        var existing = jdbc.sql("""
                select id, tapped_at, certified_at, is_certified
                from tbm_attendance
                where session_id = :sessionId
                  and worker_id = :workerId
                limit 1
            """)
            .param("sessionId", session.idLong())
            .param("workerId", worker.idLong())
            .query((rs, rowNum) -> new TbmAttendanceState(
                rs.getLong("id"),
                rs.getObject("tapped_at", OffsetDateTime.class),
                rs.getObject("certified_at", OffsetDateTime.class),
                rs.getBoolean("is_certified")
            ))
            .optional();

        if (existing.isPresent() && existing.get().certified()) {
            var row = existing.get();
            return new TbmTapResponse("already_certified", workerPayload, row.tappedAt(), row.certifiedAt(), now);
        }
        if (existing.isPresent()) {
            var row = existing.get();
            jdbc.sql("update tbm_attendance set certified_at = :now, is_certified = true where id = :id")
                .param("now", now)
                .param("id", row.id())
                .update();
            return new TbmTapResponse("certified", workerPayload, row.tappedAt(), now, now);
        }

        jdbc.sql("""
                insert into tbm_attendance(session_id, worker_id, sticker_id, tapped_at, tapped_by, lang_used, is_certified)
                values (:sessionId, :workerId, :stickerId, :now, :actorId, :lang, false)
            """)
            .param("sessionId", session.idLong())
            .param("workerId", worker.idLong())
            .param("stickerId", sticker.stickerId())
            .param("now", now)
            .param("actorId", actor.userId())
            .param("lang", worker.preferredLang())
            .update();
        if ("open".equals(session.status())) {
            jdbc.sql("update tbm_sessions set status = 'running' where id = :sessionId and status = 'open'")
                .param("sessionId", session.idLong())
                .update();
        }
        audit.record(actor.userId(), session.siteIdLong(), "admin.tbm_session.tap", "tbm_session", sessionId, "ALLOWED", "checked_in", Map.of("workerId", worker.id()));
        return new TbmTapResponse("checked_in", workerPayload, now, null, now);
    }

    @Transactional
    public TbmNotifyResponse notifyTbmSession(SessionPrincipal actor, String sessionId) {
        var session = findTbmSession(parseRequiredLong(sessionId, "session_not_found"))
            .orElseThrow(() -> new NotFoundException("session_not_found"));
        siteGuard.requireGlobalOrSiteAdmin(actor, session.siteIdLong(), "admin.tbm_session.notify", "tbm_session", sessionId);
        var targets = jdbc.sql("""
                select u.id,
                       coalesce(max(l.attempt_number), 0) as max_attempt
                from users u
                join user_roles ur on ur.user_id = u.id and ur.role = 'WORKER' and ur.revoked_at is null
                join site_memberships sm on sm.user_id = u.id and sm.role = 'WORKER' and sm.status = 'ACTIVE'
                left join worker_profiles wp on wp.user_id = u.id
                left join tbm_notification_log l on l.worker_id = u.id and l.tbm_session_id = :sessionId
                where sm.site_id = :siteId
                  and u.account_status = 'ACTIVE'
                  and coalesce(wp.is_active, true) = true
                  and not exists (
                    select 1 from tbm_attendance a
                    where a.session_id = :sessionId
                      and a.worker_id = u.id
                      and a.is_certified = true
                  )
                group by u.id
                order by u.id
            """)
            .param("sessionId", session.idLong())
            .param("siteId", session.siteIdLong())
            .query((rs, rowNum) -> new TbmNotifyTarget(rs.getLong("id"), rs.getInt("max_attempt")))
            .list();
        var inserted = new java.util.ArrayList<TbmNotificationPayload>();
        for (var target : targets) {
            int attempt = target.maxAttempt() + 1;
            OffsetDateTime nextRetryAt = OffsetDateTime.now(SEOUL).plusMinutes(nextRetryMinutes(attempt));
            var row = jdbc.sql("""
                    insert into tbm_notification_log(tbm_session_id, worker_id, attempt_number, next_retry_at, channel, status)
                    values (:sessionId, :workerId, :attempt, :nextRetryAt, 'push', 'sent')
                    returning worker_id, attempt_number, next_retry_at, sent_at, channel, status
                """)
                .param("sessionId", session.idLong())
                .param("workerId", target.workerId())
                .param("attempt", attempt)
                .param("nextRetryAt", nextRetryAt)
                .query((rs, rowNum) -> mapTbmNotification(rs))
                .single();
            inserted.add(row);
        }
        return new TbmNotifyResponse(inserted.size(), inserted);
    }

    public TbmNotificationListResponse listTbmNotifications(SessionPrincipal actor, String sessionId) {
        var session = findTbmSession(parseRequiredLong(sessionId, "session_not_found"))
            .orElseThrow(() -> new NotFoundException("session_not_found"));
        siteGuard.requireSiteAccess(actor, session.siteIdLong(), "admin.tbm_session.notify.list", "tbm_session", sessionId);
        var logs = jdbc.sql("""
                select worker_id, attempt_number, next_retry_at, sent_at, channel, status
                from tbm_notification_log
                where tbm_session_id = :sessionId
                order by sent_at desc
            """)
            .param("sessionId", session.idLong())
            .query((rs, rowNum) -> mapTbmNotification(rs))
            .list();
        return new TbmNotificationListResponse(logs);
    }

    public DailySafetyLogReportResponse dailySafetyLogs(SessionPrincipal actor, String requestedSiteId, String requestedWorkDate, int limit) {
        Long siteId = parseOptionalLong(requestedSiteId);
        if (!actor.hasAnyGlobalRole()) {
            if (actor.siteIds().isEmpty()) {
                throw new IllegalArgumentException("profile_site_required");
            }
            Long actorSiteId = actor.siteIds().stream().sorted().findFirst().orElseThrow();
            if (siteId != null && !siteId.equals(actorSiteId)) {
                siteGuard.requireSiteAccess(actor, siteId, "admin.nfc.daily_safety_logs.list", "site", String.valueOf(siteId));
            }
            siteId = actorSiteId;
        } else if (siteId != null) {
            siteGuard.requireSiteAccess(actor, siteId, "admin.nfc.daily_safety_logs.list", "site", String.valueOf(siteId));
        }

        LocalDate workDate = parseOptionalDate(requestedWorkDate);
        int safeLimit = Math.max(1, Math.min(limit <= 0 ? 100 : limit, 300));
        String siteSql = siteId == null ? "" : " and a.site_id = :siteId\n";
        String dateSql = workDate == null ? "" : " and a.work_date = :workDate\n";

        var spec = jdbc.sql("""
                select a.id,
                       a.worker_id,
                       a.site_id,
                       a.work_date,
                       a.status,
                       a.checked_in_at,
                       a.checked_out_at,
                       greatest(a.updated_at, coalesce(max(ta.tapped_at), a.updated_at)) as uploaded_at,
                       max(ta.certified_at) filter (where ta.is_certified = true) as tbm_signed_at,
                       count(ta.id) as tbm_count,
                       count(ta.id) filter (where ta.is_certified = true) as tbm_signed_count,
                       coalesce(wp.worker_code, 'WRK-' || lpad(u.id::text, 6, '0')) as worker_code,
                       u.display_name as full_name,
                       coalesce(wp.nationality, 'KR') as nationality,
                       coalesce(wp.trade, 'general') as trade,
                       u.preferred_language as preferred_lang
                from worker_daily_access a
                join users u on u.id = a.worker_id
                left join worker_profiles wp on wp.user_id = u.id
                left join tbm_sessions ts on ts.site_id = a.site_id
                 and (ts.started_at at time zone 'Asia/Seoul')::date = a.work_date
                left join tbm_attendance ta on ta.session_id = ts.id and ta.worker_id = a.worker_id
                where 1 = 1
            """ + siteSql + dateSql + """
                group by a.id, a.worker_id, a.site_id, a.work_date, a.status, a.checked_in_at, a.checked_out_at,
                         a.updated_at, u.id, u.display_name, u.preferred_language, wp.worker_code, wp.nationality, wp.trade
                order by a.work_date desc, a.checked_out_at desc nulls last, a.checked_in_at desc nulls last, a.id desc
                limit :limit
            """)
            .param("limit", safeLimit);
        if (siteId != null) spec = spec.param("siteId", siteId);
        if (workDate != null) spec = spec.param("workDate", workDate);

        var logs = spec.query((rs, rowNum) -> {
            int tbmCount = rs.getInt("tbm_count");
            int tbmSignedCount = rs.getInt("tbm_signed_count");
            return new DailySafetyLog(
                String.valueOf(rs.getLong("id")),
                String.valueOf(rs.getLong("worker_id")),
                String.valueOf(rs.getLong("site_id")),
                rs.getObject("work_date", LocalDate.class).toString(),
                rs.getString("status"),
                rs.getObject("checked_in_at", OffsetDateTime.class),
                rs.getObject("checked_out_at", OffsetDateTime.class),
                rs.getObject("tbm_signed_at", OffsetDateTime.class),
                List.of(),
                new DailyAttendanceSummary(tbmCount, tbmSignedCount, tbmSignedCount > 0),
                rs.getObject("uploaded_at", OffsetDateTime.class),
                new DailySafetyWorker(
                    rs.getString("worker_code"),
                    rs.getString("full_name"),
                    rs.getString("nationality"),
                    rs.getString("trade"),
                    rs.getString("preferred_lang")
                )
            );
        }).list();

        var report = new java.util.LinkedHashMap<String, Object>();
        report.put("reportType", "daily_safety_log_report");
        report.put("generatedBy", String.valueOf(actor.userId()));
        report.put("generatedAt", OffsetDateTime.now(SEOUL).toString());
        report.put("scope", Map.of(
            "siteId", siteId == null ? "ALL" : String.valueOf(siteId),
            "workDate", workDate == null ? "" : workDate.toString()
        ));
        report.put("sourceTables", List.of("worker_daily_access", "worker_profiles", "tbm_sessions", "tbm_attendance"));
        report.put("rowCount", logs.size());
        audit.record(actor.userId(), siteId, "admin.nfc.daily_safety_logs.list", "daily_safety_log_report", null, "ALLOWED", "generated", Map.of("rowCount", logs.size()));
        return new DailySafetyLogReportResponse(logs, report);
    }

    private Long resolveAdminSiteId(SessionPrincipal actor, String requestedSiteId) {
        if (requestedSiteId != null && !requestedSiteId.isBlank()) {
            return parseRequiredLong(requestedSiteId, "site_id_invalid");
        }
        return actor.siteIds().stream().sorted().findFirst().orElseThrow(() -> new IllegalArgumentException("site_id_required"));
    }

    private Optional<SiteChallenge> findSiteChallenge(Long siteId, LocalDate workDate) {
        return jdbc.sql("""
                select site_id, work_date, challenge_code, expires_at, created_at
                from site_daily_challenges
                where site_id = :siteId
                  and work_date = :workDate
                  and is_active = true
                  and expires_at > now()
                limit 1
            """)
            .param("siteId", siteId)
            .param("workDate", workDate)
            .query((rs, rowNum) -> new SiteChallenge(
                String.valueOf(rs.getLong("site_id")),
                rs.getObject("work_date", LocalDate.class).toString(),
                rs.getString("challenge_code"),
                rs.getObject("expires_at", OffsetDateTime.class),
                rs.getObject("created_at", OffsetDateTime.class)
            ))
            .optional();
    }

    private Optional<TbmSessionPayload> findTbmSession(Long sessionId) {
        return jdbc.sql("""
                select id, site_id, tbm_notice_id, title, status, started_at, ended_at, started_by, ended_by
                from tbm_sessions
                where id = :sessionId
                limit 1
            """)
            .param("sessionId", sessionId)
            .query((rs, rowNum) -> mapTbmSession(rs))
            .optional();
    }

    private static TbmSessionPayload mapTbmSession(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new TbmSessionPayload(
            String.valueOf(rs.getLong("id")),
            String.valueOf(rs.getLong("site_id")),
            rs.getString("tbm_notice_id"),
            rs.getString("title"),
            rs.getString("status"),
            rs.getObject("started_at", OffsetDateTime.class),
            rs.getObject("ended_at", OffsetDateTime.class),
            rs.getObject("started_by") == null ? null : String.valueOf(rs.getLong("started_by")),
            rs.getObject("ended_by") == null ? null : String.valueOf(rs.getLong("ended_by"))
        );
    }

    private static TbmNotificationPayload mapTbmNotification(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new TbmNotificationPayload(
            String.valueOf(rs.getLong("worker_id")),
            rs.getInt("attempt_number"),
            rs.getObject("next_retry_at", OffsetDateTime.class),
            rs.getObject("sent_at", OffsetDateTime.class),
            rs.getString("channel"),
            rs.getString("status")
        );
    }

    private static int nextRetryMinutes(int attempt) {
        return switch (Math.max(1, attempt)) {
            case 1 -> 5;
            case 2 -> 10;
            case 3 -> 20;
            default -> 40;
        };
    }

    @Transactional
    public WorkerTokenOutcome verifyWorkerQr(WorkerQrVerifyRequest request, String ipAddress) {
        var token = parseWorkerQrToken(request.token());
        var worker = findWorker(token.workerId()).orElseThrow(() -> new NotFoundException("worker_not_found"));
        if (!worker.isActive()) {
            throw new NotFoundException("worker_not_found");
        }
        if (!worker.assignedSiteIdLong().equals(token.siteId())) {
            throw new IllegalArgumentException("worker_site_mismatch");
        }
        var site = findSite(token.siteId()).orElseThrow(() -> new NotFoundException("site_not_found"));

        if ("info".equalsIgnoreCase(request.mode())) {
            return new WorkerTokenOutcome(WorkerQrResponse.info(worker, site), null);
        }
        if (token.nonce() == null || token.nonce().isBlank()) {
            throw new IllegalArgumentException("TOKEN_REPLAY_NOT_VERIFIABLE");
        }
        int consumed = jdbc.sql("""
                update worker_qr_token_nonces
                set used_at = now()
                where nonce = :nonce
                  and used_at is null
                  and expires_at > now()
            """)
            .param("nonce", token.nonce())
            .update();
        if (consumed == 0) {
            throw new IllegalArgumentException("TOKEN_ALREADY_USED");
        }
        if (!isSiteAccessEnabled(token.siteId())) {
            throw new IllegalArgumentException("site_access_disabled");
        }

        String nationality = cleanCountry(request.nationality());
        String preferredLanguage = cleanLanguage(request.preferredLang());
        jdbc.sql("""
                update users
                set preferred_language = :preferredLanguage
                where id = :workerId
            """)
            .param("preferredLanguage", preferredLanguage)
            .param("workerId", token.workerId())
            .update();
        jdbc.sql("""
                update worker_profiles
                set nationality = :nationality,
                    nationality_confirmed_at = now(),
                    updated_at = now()
                where user_id = :workerId
            """)
            .param("nationality", nationality)
            .param("workerId", token.workerId())
            .update();

        var access = applyDailyAccess(token.workerId(), token.siteId(), false);
        audit.record(token.workerId(), token.siteId(), "qr.worker_token", "worker_daily_access", access.id() == null ? null : String.valueOf(access.id()), "ALLOWED", access.action(), Map.of("ip", ipAddress));
        var account = users.findById(token.workerId()).orElseThrow(() -> new NotFoundException("worker_not_found"));
        var refreshedWorker = findWorker(token.workerId()).orElse(worker);
        return new WorkerTokenOutcome(WorkerQrResponse.enter(refreshedWorker, site, access, true), access.active() ? account.toPrincipal() : null);
    }

    public WorkerInfoResponse workerInfo(String rawUrl, String requestOrigin) {
        var sticker = validateSticker(rawUrl, requestOrigin);
        var worker = findWorker(sticker.workerId()).orElseThrow(() -> new NotFoundException("worker_not_found"));
        if (!worker.isActive()) {
            throw new IllegalArgumentException("worker_inactive");
        }
        return new WorkerInfoResponse(worker.nationalityConfirmedAt() != null, worker.nationality(), worker.preferredLang(), null);
    }

    @Transactional
    public WorkerPreferenceOutcome workerPreference(WorkerPreferenceRequest request, String requestOrigin, String ipAddress) {
        var sticker = validateSticker(request.url(), requestOrigin);
        var worker = findWorker(sticker.workerId()).orElseThrow(() -> new NotFoundException("worker_not_found"));
        if (!worker.isActive()) {
            throw new IllegalArgumentException("worker_inactive");
        }
        if (!isSiteAccessEnabled(worker.assignedSiteIdLong())) {
            throw new IllegalArgumentException("site_access_disabled");
        }
        String intent = request.intent() == null ? "open" : request.intent().trim();
        String nationality = cleanCountry(request.nationality());
        String preferredLanguage = cleanLanguage(request.preferredLang());

        var existing = findDailyAccess(worker.idLong(), worker.assignedSiteIdLong(), LocalDate.now(SEOUL));
        boolean isNewCheckin = existing.isEmpty();
        if (isNewCheckin) {
            jdbc.sql("update users set preferred_language = :lang where id = :workerId")
                .param("lang", preferredLanguage)
                .param("workerId", worker.idLong())
                .update();
            jdbc.sql("""
                    update worker_profiles
                    set nationality = :nationality,
                        nationality_confirmed_at = now(),
                        updated_at = now()
                    where user_id = :workerId
                """)
                .param("nationality", nationality)
                .param("workerId", worker.idLong())
                .update();
        }

        var access = applyDailyAccess(worker.idLong(), worker.assignedSiteIdLong(), "checkout".equals(intent));
        var account = users.findById(worker.idLong()).orElseThrow(() -> new NotFoundException("worker_not_found"));
        var response = new WorkerPreferenceResponse(
            findWorker(worker.idLong()).orElse(worker).publicMap(),
            new WorkerAccessPayload(access.action(), access.active(), access.workDate().toString(), String.valueOf(worker.assignedSiteIdLong()), null),
            access.active()
        );
        audit.record(worker.idLong(), worker.assignedSiteIdLong(), "nfc.worker.preference", "worker_daily_access", access.id() == null ? null : String.valueOf(access.id()), "ALLOWED", access.action(), Map.of("ip", ipAddress));
        return new WorkerPreferenceOutcome(response, access.active() ? account.toPrincipal() : null);
    }

    private StickerValidation validateSticker(String rawUrl, String requestOrigin) {
        requireStickerSecret();
        ParsedSticker parsed = parseStickerUrl(rawUrl, requestOrigin);
        if (parsed == null) {
            parsed = parseStickerUrl(rawUrl, frontendBaseUrl(requestOrigin));
        }
        if (parsed == null) {
            throw new IllegalArgumentException("url_malformed_or_spoofed");
        }
        if (parsed.issuedEpoch() == null) {
            throw new IllegalArgumentException("issued_epoch_required");
        }
        Long workerId = parsed.workerId();
        if (workerId == null && parsed.workerCode() != null) {
            workerId = jdbc.sql("""
                    select user_id
                    from worker_profiles
                    where worker_code = :workerCode
                    limit 1
                """)
                .param("workerCode", parsed.workerCode())
                .query(Long.class)
                .optional()
                .orElse(null);
        }
        if (workerId == null) {
            throw new NotFoundException("worker_not_found");
        }
        String workerCode = parsed.workerCode() != null
            ? parsed.workerCode()
            : jdbc.sql("select worker_code from worker_profiles where user_id = :workerId")
                .param("workerId", workerId)
                .query(String.class)
                .optional()
                .orElse(null);
        String expected = signSticker(workerCode, parsed.sigVersion(), parsed.issuedEpoch(), parsed.identityHint() == null ? "" : parsed.identityHint());
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), parsed.sig().getBytes(StandardCharsets.UTF_8))) {
            throw new IllegalArgumentException("signature_invalid");
        }
        Long validatedWorkerId = workerId;
        var sticker = jdbc.sql("""
                select id, is_active
                from worker_stickers
                where worker_id = :workerId
                  and sig_version = :sigVersion
                  and issued_epoch = :issuedEpoch
                limit 1
            """)
            .param("workerId", workerId)
            .param("sigVersion", parsed.sigVersion())
            .param("issuedEpoch", parsed.issuedEpoch())
            .query((rs, rowNum) -> new StickerValidation(validatedWorkerId, rs.getLong("id"), rs.getBoolean("is_active")))
            .optional()
            .orElseThrow(() -> new IllegalArgumentException("sticker_revoked_or_missing"));
        if (!sticker.active()) {
            throw new IllegalArgumentException("sticker_revoked_or_missing");
        }
        return sticker;
    }

    private ParsedSticker parseStickerUrl(String rawUrl, String expectedOrigin) {
        if (rawUrl == null || rawUrl.isBlank()) return null;
        try {
            URI uri = URI.create(rawUrl);
            if (expectedOrigin != null && !expectedOrigin.isBlank()) {
                URI expected = URI.create(expectedOrigin);
                if (!safeEquals(origin(uri), origin(expected))) return null;
            }
            String path = uri.getPath() == null ? "" : uri.getPath();
            String prefix = path.startsWith("/n/") ? "/n/" : path.startsWith("/nfc/w/") ? "/nfc/w/" : null;
            if (prefix == null) return null;
            String ref = path.substring(prefix.length()).replaceAll("/+$", "");
            Map<String, String> query = parseQuery(uri.getRawQuery());
            String version = query.get("v");
            String issued = query.get("t");
            String sig = Optional.ofNullable(query.get("s")).orElse(query.get("sig"));
            String hint = query.get("h");
            if (version == null || sig == null) return null;
            int sigVersion = Integer.parseInt(version);
            Long issuedEpoch = issued == null ? null : Long.valueOf(issued);
            if (ref.startsWith("WRK-")) {
                return new ParsedSticker(null, ref, sigVersion, issuedEpoch, sig, hint);
            }
            return new ParsedSticker(Long.valueOf(ref), null, sigVersion, issuedEpoch, sig, hint);
        } catch (RuntimeException e) {
            return null;
        }
    }

    private WorkerQrToken parseWorkerQrToken(String token) {
        requireQrSecret();
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("token_required");
        }
        try {
            String decoded = new String(Base64.getUrlDecoder().decode(token), StandardCharsets.UTF_8);
            String[] parts = decoded.split("\\|");
            if (parts.length != 5 && parts.length != 4) {
                throw new IllegalArgumentException("INVALID_OR_EXPIRED_TOKEN");
            }
            boolean v2 = parts.length == 5;
            Long workerId = Long.valueOf(parts[0]);
            Long siteId = Long.valueOf(parts[1]);
            long expiresAt = Long.parseLong(parts[2]);
            String nonce = v2 ? parts[3] : null;
            String sig = v2 ? parts[4] : parts[3];
            if (Instant.now().getEpochSecond() > expiresAt) {
                throw new IllegalArgumentException("INVALID_OR_EXPIRED_TOKEN");
            }
            String payload = v2 ? parts[0] + "|" + parts[1] + "|" + parts[2] + "|" + parts[3] : parts[0] + "|" + parts[1] + "|" + parts[2];
            String expected = hmacHex(qrHmacSecret, payload);
            if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), sig.getBytes(StandardCharsets.UTF_8))) {
                throw new IllegalArgumentException("INVALID_OR_EXPIRED_TOKEN");
            }
            return new WorkerQrToken(workerId, siteId, expiresAt, nonce);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (RuntimeException e) {
            throw new IllegalArgumentException("INVALID_OR_EXPIRED_TOKEN");
        }
    }

    private AccessRecord applyDailyAccess(Long workerId, Long siteId, boolean checkout) {
        LocalDate workDate = LocalDate.now(SEOUL);
        OffsetDateTime now = OffsetDateTime.now(SEOUL);
        var existing = findDailyAccess(workerId, siteId, workDate);
        if (checkout) {
            if (existing.isEmpty()) {
                throw new IllegalArgumentException("not_checked_in");
            }
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
            return new AccessRecord(row.id(), "checked_out", false, workDate);
        }
        if (existing.isPresent()) {
            var row = existing.get();
            if ("CHECKED_OUT".equals(row.status())) {
                return new AccessRecord(row.id(), "checked_out", false, workDate);
            }
            jdbc.sql("update worker_daily_access set last_seen_at = :now, updated_at = :now where id = :id")
                .param("now", now)
                .param("id", row.id())
                .update();
            return new AccessRecord(row.id(), "already_checked_in", true, workDate);
        }
        Long accessId = jdbc.sql("""
                insert into worker_daily_access(worker_id, site_id, work_date, status, checked_in_at, last_seen_at, entry_method)
                values (:workerId, :siteId, :workDate, 'ACTIVE', :now, :now, 'NFC')
                returning id
            """)
            .param("workerId", workerId)
            .param("siteId", siteId)
            .param("workDate", workDate)
            .param("now", now)
            .query(Long.class)
            .single();
        return new AccessRecord(accessId, "checked_in", true, workDate);
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

    private Optional<WorkerResponse> findWorker(Long id) {
        return jdbc.sql("""
                select u.id,
                       coalesce(wp.worker_code, 'WRK-' || lpad(u.id::text, 6, '0')) as worker_code,
                       u.display_name as full_name,
                       coalesce(wp.nationality, 'KR') as nationality,
                       coalesce(u.phone, wp.phone) as phone,
                       sm.site_id as assigned_site_id,
                       coalesce(wp.trade, 'general') as trade,
                       u.preferred_language as preferred_lang,
                       coalesce(wp.is_active, u.account_status = 'ACTIVE') as is_active,
                       wp.consent_signed_at,
                       u.created_at,
                       q.name_initials,
                       q.phone_last4,
                       wp.nationality_confirmed_at
                from users u
                join user_roles ur on ur.user_id = u.id and ur.role = 'WORKER' and ur.revoked_at is null
                join site_memberships sm on sm.user_id = u.id and sm.role = 'WORKER' and sm.status = 'ACTIVE'
                left join worker_profiles wp on wp.user_id = u.id
                left join worker_quick_login_credentials q on q.user_id = u.id
                where u.id = :workerId
                order by sm.created_at desc
                limit 1
            """)
            .param("workerId", id)
            .query((rs, rowNum) -> new WorkerResponse(
                String.valueOf(rs.getLong("id")),
                rs.getString("worker_code"),
                rs.getString("full_name"),
                rs.getString("nationality"),
                rs.getString("phone"),
                String.valueOf(rs.getLong("assigned_site_id")),
                rs.getString("trade"),
                rs.getString("preferred_lang"),
                rs.getBoolean("is_active"),
                rs.getObject("consent_signed_at", OffsetDateTime.class),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getString("name_initials"),
                rs.getString("phone_last4"),
                rs.getObject("nationality_confirmed_at", OffsetDateTime.class)
            ))
            .optional();
    }

    private Optional<SitePayload> findSite(Long siteId) {
        return jdbc.sql("""
                select id, name, site_code
                from sites
                where id = :siteId
                  and status = 'ACTIVE'
                limit 1
            """)
            .param("siteId", siteId)
            .query((rs, rowNum) -> new SitePayload(String.valueOf(rs.getLong("id")), rs.getString("name"), rs.getString("site_code")))
            .optional();
    }

    private void ensureWorkerContracts(Long workerId, Long siteId, Long actorId, String initials, String phoneLast4) {
        jdbc.sql("""
                insert into user_roles(user_id, role, granted_by)
                select :workerId, 'WORKER', :actorId
                where not exists (
                  select 1 from user_roles where user_id = :workerId and role = 'WORKER' and revoked_at is null
                )
            """)
            .param("workerId", workerId)
            .param("actorId", actorId)
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
                do update set name_initials = excluded.name_initials,
                              phone_last4 = excluded.phone_last4,
                              enabled = true,
                              updated_at = now()
            """)
            .param("workerId", workerId)
            .param("initials", initials)
            .param("phoneLast4", phoneLast4)
            .update();
    }

    private void upsertWorkerProfile(Long workerId, Long siteId, String displayName, String nationality, String phone, String trade, OffsetDateTime consentSignedAt, String consentDocUrl, Long actorId) {
        jdbc.sql("""
                insert into worker_profiles(user_id, worker_code, nationality, phone, trade, consent_signed_at, consent_doc_url, is_active, created_by)
                values (:workerId, :workerCode, :nationality, :phone, :trade, :consentSignedAt, :consentDocUrl, true, :actorId)
                on conflict (user_id)
                do update set nationality = excluded.nationality,
                              phone = excluded.phone,
                              trade = excluded.trade,
                              consent_signed_at = coalesce(excluded.consent_signed_at, worker_profiles.consent_signed_at),
                              consent_doc_url = coalesce(excluded.consent_doc_url, worker_profiles.consent_doc_url),
                              is_active = true,
                              updated_at = now()
            """)
            .param("workerId", workerId)
            .param("workerCode", workerCode(workerId))
            .param("nationality", nationality)
            .param("phone", phone)
            .param("trade", trade)
            .param("consentSignedAt", consentSignedAt)
            .param("consentDocUrl", blankToNull(consentDocUrl))
            .param("actorId", actorId)
            .update();
    }

    private void moveWorkerSite(Long workerId, Long oldSiteId, Long newSiteId) {
        jdbc.sql("""
                update site_memberships
                set status = 'REVOKED'
                where user_id = :workerId
                  and role = 'WORKER'
                  and site_id <> :newSiteId
            """)
            .param("workerId", workerId)
            .param("newSiteId", newSiteId)
            .update();
        jdbc.sql("""
                insert into site_memberships(user_id, site_id, role, status)
                values (:workerId, :siteId, 'WORKER', 'ACTIVE')
                on conflict (user_id, site_id, role)
                do update set status = 'ACTIVE'
            """)
            .param("workerId", workerId)
            .param("siteId", newSiteId)
            .update();
        jdbc.sql("""
                update worker_stickers
                set is_active = false,
                    revoked_at = now(),
                    revoke_reason = 'worker_moved_site'
                where worker_id = :workerId
                  and site_id = :oldSiteId
                  and is_active = true
            """)
            .param("workerId", workerId)
            .param("oldSiteId", oldSiteId)
            .update();
    }

    private boolean isSiteAccessEnabled(Long siteId) {
        return jdbc.sql("""
                select coalesce(c.is_enabled, true)
                from sites s
                left join site_access_controls c on c.site_id = s.id
                where s.id = :siteId
                  and s.status = 'ACTIVE'
                limit 1
            """)
            .param("siteId", siteId)
            .query(Boolean.class)
            .optional()
            .orElseThrow(() -> new NotFoundException("site_not_found"));
    }

    private void insertCardEvent(Long workerId, Long stickerId, Long siteId, String eventType, Long actorId, String tagUid, Integer sigVersion, Long issuedEpoch, Integer ndefBytes, String reason, Map<String, ?> metadata) {
        String metadataJson;
        try {
            metadataJson = objectMapper.writeValueAsString(metadata == null ? Map.of() : metadata);
        } catch (Exception e) {
            metadataJson = "{}";
        }
        jdbc.sql("""
                insert into worker_card_lifecycle_events(worker_id, sticker_id, site_id, event_type, actor_id, tag_uid, sig_version, issued_epoch, ndef_bytes, reason, metadata)
                values (:workerId, :stickerId, :siteId, :eventType, :actorId, :tagUid, :sigVersion, :issuedEpoch, :ndefBytes, :reason, cast(:metadata as jsonb))
            """)
            .param("workerId", workerId)
            .param("stickerId", stickerId)
            .param("siteId", siteId)
            .param("eventType", eventType)
            .param("actorId", actorId)
            .param("tagUid", blankToNull(tagUid))
            .param("sigVersion", sigVersion)
            .param("issuedEpoch", issuedEpoch)
            .param("ndefBytes", ndefBytes)
            .param("reason", blankToNull(reason))
            .param("metadata", metadataJson)
            .update();
    }

    private String buildStickerUrl(String requestOrigin, String workerCode, int sigVersion, long issuedEpoch, String sig, String identityHint) {
        String base = frontendBaseUrl(requestOrigin);
        return base + "/n/" + workerCode + "?v=" + sigVersion + "&t=" + issuedEpoch + "&s=" + sig + (identityHint.isBlank() ? "" : "&h=" + identityHint);
    }

    private String frontendBaseUrl(String requestOrigin) {
        String value = firstNonBlank(
            configuredBaseUrl,
            requestOrigin,
            System.getenv("NEXT_PUBLIC_NFC_BASE_URL"),
            System.getenv("NEXT_PUBLIC_SITE_URL"),
            "https://safe-link-v2.vercel.app"
        );
        return value.replaceAll("/+$", "");
    }

    private String signSticker(String workerCode, int sigVersion, long issuedEpoch, String identityHint) {
        String payload = workerCode + "|" + sigVersion + "|" + issuedEpoch + "|" + (identityHint == null ? "" : identityHint);
        String encoded = hmacBase64Url(stickerSecret, payload);
        return encoded.substring(0, Math.min(22, encoded.length()));
    }

    private static String hmacHex(String secret, String payload) {
        return HexFormat.of().formatHex(hmac(secret, payload));
    }

    private static String hmacBase64Url(String secret, String payload) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(hmac(secret, payload));
    }

    private static byte[] hmac(String secret, String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("hmac_failed", e);
        }
    }

    private void requireQrSecret() {
        if (qrHmacSecret.length() < 16) {
            throw new IllegalStateException("NFC_HMAC_SECRET not configured");
        }
    }

    private void requireStickerSecret() {
        if (stickerSecret.length() < 32) {
            throw new IllegalStateException("NFC_STICKER_SECRET not configured");
        }
    }

    private static String cleanSearch(String value) {
        if (value == null) return "";
        String sanitized = value.trim().replaceAll("[,()*\"\\\\%_]", "").toLowerCase(Locale.ROOT);
        return sanitized.substring(0, Math.min(64, sanitized.length()));
    }

    private static String cleanDisplayName(String value, String fallback) {
        String name = value == null || value.isBlank() ? fallback : value.trim();
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("full_name_required");
        }
        return name.substring(0, Math.min(80, name.length()));
    }

    private static String cleanInitials(String value) {
        String initials = value == null ? "" : value.trim().replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        initials = initials.substring(0, Math.min(6, initials.length()));
        if (!INITIALS_PATTERN.matcher(initials).matches()) {
            throw new IllegalArgumentException("name_initials_required");
        }
        return initials;
    }

    private static String cleanPhoneLast4(String value) {
        String digits = value == null ? "" : value.replaceAll("\\D", "");
        if (digits.length() > 4) digits = digits.substring(digits.length() - 4);
        if (!PHONE_LAST4_PATTERN.matcher(digits).matches()) {
            throw new IllegalArgumentException("phone_last4_required");
        }
        return digits;
    }

    private static String cleanOptionalPhone(String value) {
        if (value == null || value.isBlank()) return null;
        String digits = value.replaceAll("\\D", "");
        if (digits.length() < 8 || digits.length() > 15) {
            throw new IllegalArgumentException("invalid_phone");
        }
        return digits;
    }

    private static String cleanCountry(String value) {
        String country = value == null || value.isBlank() ? "KR" : value.trim().toUpperCase(Locale.ROOT);
        return COUNTRY_PATTERN.matcher(country).matches() ? country : "KR";
    }

    private static String cleanLanguage(String value) {
        String language = value == null || value.isBlank() ? "ko" : value.trim().toLowerCase(Locale.ROOT);
        return LANG_PATTERN.matcher(language).matches() ? language : "ko";
    }

    private static String cleanTrade(String value) {
        String trade = value == null || value.isBlank() ? "general" : value.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9_-]", "");
        return TRADE_PATTERN.matcher(trade).matches() ? trade : "general";
    }

    private static OffsetDateTime parseOptionalInstant(String value) {
        if (value == null || value.isBlank()) return null;
        return OffsetDateTime.parse(value);
    }

    private static Long parseRequiredLong(String value, String error) {
        Long id = parseOptionalLong(value);
        if (id == null) {
            throw new IllegalArgumentException(error);
        }
        return id;
    }

    private static Long parseOptionalLong(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static LocalDate parseOptionalDate(String value) {
        if (value == null || value.isBlank()) return null;
        return LocalDate.parse(value.trim());
    }

    private static String workerCode(Long userId) {
        return "WRK-" + String.format("%06d", userId);
    }

    private static String internalWorkerEmail(Long siteId, String initials, String phoneLast4) {
        return "worker." + siteId + "." + initials.toLowerCase(Locale.ROOT) + "." + phoneLast4 + "@safe-link.internal";
    }

    private static String randomHex(int bytes) {
        byte[] buffer = new byte[bytes];
        new java.security.SecureRandom().nextBytes(buffer);
        return HexFormat.of().formatHex(buffer);
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value.trim();
        }
        return "";
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String origin(URI uri) {
        int port = uri.getPort();
        String scheme = uri.getScheme();
        String host = uri.getHost();
        if (scheme == null || host == null) return "";
        return scheme + "://" + host + (port >= 0 ? ":" + port : "");
    }

    private static boolean safeEquals(String a, String b) {
        return a != null && b != null && a.equalsIgnoreCase(b);
    }

    private static Map<String, String> parseQuery(String raw) {
        if (raw == null || raw.isBlank()) return Map.of();
        var map = new java.util.LinkedHashMap<String, String>();
        for (String pair : raw.split("&")) {
            String[] parts = pair.split("=", 2);
            String key = java.net.URLDecoder.decode(parts[0], StandardCharsets.UTF_8);
            String value = parts.length > 1 ? java.net.URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "";
            map.put(key, value);
        }
        return map;
    }

    public record WorkerListResponse(List<WorkerResponse> workers) {}
    public record WorkerPageResponse(
        List<WorkerResponse> workers,
        @JsonProperty("next_cursor") String nextCursor,
        @JsonProperty("has_more") boolean hasMore
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record WorkerResponse(
        String id,
        @JsonProperty("worker_code") String workerCode,
        @JsonProperty("full_name") String fullName,
        String nationality,
        String phone,
        @JsonProperty("assigned_site_id") String assignedSiteId,
        String trade,
        @JsonProperty("preferred_lang") String preferredLang,
        @JsonProperty("is_active") boolean isActive,
        @JsonProperty("consent_signed_at") OffsetDateTime consentSignedAt,
        @JsonProperty("created_at") OffsetDateTime createdAt,
        @JsonProperty("name_initials") String nameInitials,
        @JsonProperty("phone_last4") String phoneLast4,
        @JsonProperty("nationality_confirmed_at") OffsetDateTime nationalityConfirmedAt
    ) {
        Long idLong() { return Long.valueOf(id); }
        Long assignedSiteIdLong() { return Long.valueOf(assignedSiteId); }
        String identityHint() {
            return ((nameInitials == null ? "" : nameInitials) + (phoneLast4 == null ? "" : phoneLast4))
                .replaceAll("[^A-Za-z0-9]", "")
                .toUpperCase(Locale.ROOT);
        }
        CompactWorker compact() {
            return new CompactWorker(id, workerCode, fullName);
        }
        Map<String, Object> publicMap() {
            var payload = new java.util.LinkedHashMap<String, Object>();
            payload.put("id", id);
            payload.put("worker_code", workerCode);
            payload.put("full_name", fullName);
            payload.put("nationality", nationality);
            payload.put("preferred_lang", preferredLang);
            payload.put("assigned_site_id", assignedSiteId);
            return payload;
        }
    }

    public record CompactWorker(String id, @JsonProperty("worker_code") String workerCode, @JsonProperty("full_name") String fullName) {}

    public record CreateWorkerRequest(
        @JsonProperty("full_name") String fullName,
        String nationality,
        String phone,
        @JsonProperty("assigned_site_id") String assignedSiteId,
        String trade,
        @JsonProperty("preferred_lang") String preferredLang,
        @JsonProperty("consent_signed_at") String consentSignedAt,
        @JsonProperty("consent_doc_url") String consentDocUrl,
        @JsonProperty("name_initials") String nameInitials,
        @JsonProperty("phone_last4") String phoneLast4
    ) {}

    public record UpdateWorkerRequest(
        @JsonProperty("full_name") String fullName,
        String nationality,
        String phone,
        String trade,
        @JsonProperty("preferred_lang") String preferredLang,
        @JsonProperty("assigned_site_id") String assignedSiteId,
        String notes
    ) {}

    public record QrTokenResponse(String token, String qrUrl, String workerId, String siteId, int expiresInMinutes, CompactWorker worker) {}
    public record StickerIssueRequest(@JsonProperty("worker_id") String workerId, @JsonProperty("revoke_previous") Boolean revokePrevious) {}
    public record StickerIssueResponse(@JsonProperty("sticker_id") String stickerId, String url, @JsonProperty("sig_version") int sigVersion, @JsonProperty("issued_epoch") long issuedEpoch, @JsonProperty("ndef_bytes") int ndefBytes, CompactWorker worker) {}
    public record StickerEventRequest(@JsonProperty("event_type") String eventType, @JsonProperty("worker_id") String workerId, @JsonProperty("sticker_id") String stickerId, @JsonProperty("tag_uid") String tagUid, String reason, Map<String, Object> metadata) {}
    public record SiteAccessControlUpdate(@JsonProperty("site_id") String siteId, @JsonProperty("is_enabled") Boolean isEnabled, String reason) {}
    public record SiteAccessControlResponse(SiteAccessControl control) {}
    public record SiteAccessControl(@JsonProperty("site_id") String siteId, @JsonProperty("is_enabled") boolean isEnabled, String reason, @JsonProperty("updated_at") OffsetDateTime updatedAt) {}
    public record SiteChallengeRequest(@JsonProperty("site_id") String siteId, Boolean rotate) {}
    public record SiteChallengeResponse(SiteChallenge challenge, @JsonProperty("work_date") String workDate, @JsonProperty("site_id") String siteId) {}
    public record SiteChallenge(@JsonProperty("site_id") String siteId, @JsonProperty("work_date") String workDate, @JsonProperty("challenge_code") String challengeCode, @JsonProperty("expires_at") OffsetDateTime expiresAt, @JsonProperty("created_at") OffsetDateTime createdAt) {}
    public record TbmSessionListResponse(List<TbmSessionPayload> sessions) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TbmSessionPayload(String id, @JsonProperty("site_id") String siteId, @JsonProperty("tbm_notice_id") String tbmNoticeId, String title, String status, @JsonProperty("started_at") OffsetDateTime startedAt, @JsonProperty("ended_at") OffsetDateTime endedAt, @JsonProperty("started_by") String startedBy, @JsonProperty("ended_by") String endedBy) {
        Long idLong() { return Long.valueOf(id); }
        Long siteIdLong() { return Long.valueOf(siteId); }
    }
    public record TbmSessionCreateRequest(@JsonProperty("site_id") String siteId, @JsonProperty("tbm_notice_id") String tbmNoticeId, String title) {}
    public record TbmSessionActionRequest(String action) {}
    public record TbmSessionDetailResponse(TbmSessionPayload session, List<TbmAttendancePayload> attendance) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TbmAttendancePayload(String id, @JsonProperty("worker_id") String workerId, @JsonProperty("tapped_at") OffsetDateTime tappedAt, @JsonProperty("lang_used") String langUsed, @JsonProperty("worker_code") String workerCode, @JsonProperty("full_name") String fullName, String nationality, String trade, @JsonProperty("certified_at") OffsetDateTime certifiedAt, @JsonProperty("is_certified") boolean certified) {}
    public record TbmTapRequest(String url) {}
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TbmTapResponse(String action, TbmWorkerPayload worker, @JsonProperty("tapped_at") OffsetDateTime tappedAt, @JsonProperty("certified_at") OffsetDateTime certifiedAt, OffsetDateTime timestamp) {}
    public record TbmWorkerPayload(String id, @JsonProperty("worker_code") String workerCode, @JsonProperty("full_name") String fullName, String nationality, String trade) {}
    public record TbmAttendanceState(Long id, OffsetDateTime tappedAt, OffsetDateTime certifiedAt, boolean certified) {}
    public record TbmNotifyTarget(Long workerId, int maxAttempt) {}
    public record TbmNotifyResponse(int notified, List<TbmNotificationPayload> workers) {}
    public record TbmNotificationListResponse(List<TbmNotificationPayload> logs) {}
    public record TbmNotificationPayload(@JsonProperty("worker_id") String workerId, @JsonProperty("attempt_number") int attemptNumber, @JsonProperty("next_retry_at") OffsetDateTime nextRetryAt, @JsonProperty("sent_at") OffsetDateTime sentAt, String channel, String status) {}
    public record DailySafetyLogReportResponse(List<DailySafetyLog> logs, Map<String, Object> report) {}
    public record DailySafetyLog(
        String id,
        @JsonProperty("worker_id") String workerId,
        @JsonProperty("site_id") String siteId,
        @JsonProperty("work_date") String workDate,
        String status,
        @JsonProperty("check_in_at") OffsetDateTime checkInAt,
        @JsonProperty("check_out_at") OffsetDateTime checkOutAt,
        @JsonProperty("tbm_signed_at") OffsetDateTime tbmSignedAt,
        @JsonProperty("tbm_records") List<Object> tbmRecords,
        @JsonProperty("attendance_summary") DailyAttendanceSummary attendanceSummary,
        @JsonProperty("uploaded_at") OffsetDateTime uploadedAt,
        DailySafetyWorker worker
    ) {}
    public record DailyAttendanceSummary(@JsonProperty("tbm_count") int tbmCount, @JsonProperty("tbm_signed_count") int tbmSignedCount, @JsonProperty("has_tbm_signature") boolean hasTbmSignature) {}
    public record DailySafetyWorker(@JsonProperty("worker_code") String workerCode, @JsonProperty("full_name") String fullName, String nationality, String trade, @JsonProperty("preferred_lang") String preferredLang) {}
    public record WorkerQrVerifyRequest(String token, String mode, String nationality, @JsonProperty("preferred_lang") String preferredLang) {}
    public record WorkerTokenOutcome(WorkerQrResponse response, SessionPrincipal principal) {}
    public record WorkerPreferenceOutcome(WorkerPreferenceResponse response, SessionPrincipal principal) {}
    public record WorkerInfoResponse(@JsonProperty("has_confirmed") boolean hasConfirmed, String nationality, @JsonProperty("preferred_lang") String preferredLang, @JsonProperty("site_challenge_code") String siteChallengeCode) {}
    public record WorkerPreferenceRequest(String url, String nationality, @JsonProperty("preferred_lang") String preferredLang, String intent, Map<String, Object> location, @JsonProperty("site_challenge_code") String siteChallengeCode) {}
    public record WorkerPreferenceResponse(Map<String, Object> worker, WorkerAccessPayload access, @JsonProperty("session_established") boolean sessionEstablished) {}
    public record WorkerAccessPayload(String action, boolean active, @JsonProperty("work_date") String workDate, @JsonProperty("site_id") String siteId, @JsonProperty("distance_m") Integer distanceM) {}
    public record WorkerQrToken(Long workerId, Long siteId, long expiresAt, String nonce) {}
    public record ParsedSticker(Long workerId, String workerCode, int sigVersion, Long issuedEpoch, String sig, String identityHint) {}
    public record StickerValidation(Long workerId, Long stickerId, boolean active) {}
    public record RevokedSticker(Long id, int sigVersion, long issuedEpoch) {}
    public record SitePayload(String id, String name, String code) {}
    public record AccessRow(Long id, String status) {}
    public record AccessRecord(Long id, String action, boolean active, LocalDate workDate) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record WorkerQrResponse(
        boolean ok,
        WorkerResponse worker,
        SitePayload site,
        WorkerAccessPayload access,
        @JsonProperty("qr_action") String qrAction,
        Object session,
        @JsonProperty("session_established") Boolean sessionEstablished,
        String error
    ) {
        static WorkerQrResponse info(WorkerResponse worker, SitePayload site) {
            return new WorkerQrResponse(true, worker, site, null, null, null, null, null);
        }
        static WorkerQrResponse enter(WorkerResponse worker, SitePayload site, AccessRecord access, boolean sessionEstablished) {
            return new WorkerQrResponse(
                true,
                worker,
                site,
                new WorkerAccessPayload(access.action(), access.active(), access.workDate().toString(), site.id(), null),
                "no_active_session",
                null,
                access.active() ? sessionEstablished : false,
                null
            );
        }
    }
}
