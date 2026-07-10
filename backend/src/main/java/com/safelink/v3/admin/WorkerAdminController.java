package com.safelink.v3.admin;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.security.SiteGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.jdbc.core.simple.JdbcClient;

@RestController
@RequestMapping("/api/v1/sites/{siteId}/workers")
public class WorkerAdminController {
    private static final Pattern INITIALS_PATTERN = Pattern.compile("^[A-Z0-9]{1,6}$");
    private static final Pattern PHONE_LAST4_PATTERN = Pattern.compile("^[0-9]{4}$");
    private static final Pattern LANG_PATTERN = Pattern.compile("^[a-z]{2,5}$");

    private final JdbcClient jdbc;
    private final SiteGuard siteGuard;
    private final AuditService audit;

    public WorkerAdminController(JdbcClient jdbc, SiteGuard siteGuard, AuditService audit) {
        this.jdbc = jdbc;
        this.siteGuard = siteGuard;
        this.audit = audit;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkerResponse createWorker(
        @AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable Long siteId,
        @Valid @RequestBody CreateWorkerRequest request
    ) {
        siteGuard.requireGlobalOrSiteAdmin(actor, siteId, "admin.worker.create", "worker", null);

        String phone = cleanPhone(request.phone());
        String initials = cleanInitials(request.nameInitials());
        String phoneLast4 = cleanPhoneLast4(request.phoneLast4(), phone);
        String preferredLanguage = cleanLanguage(request.preferredLanguage());
        String displayName = request.displayName().trim();

        try {
            Long userId = jdbc.sql("""
                    insert into users(email, phone, display_name, preferred_language, account_status)
                    values (null, :phone, :displayName, :preferredLanguage, 'ACTIVE')
                    returning id
                """)
                .param("phone", phone)
                .param("displayName", displayName)
                .param("preferredLanguage", preferredLanguage)
                .query(Long.class)
                .single();

            jdbc.sql("""
                    insert into user_roles(user_id, role, granted_by)
                    values (:userId, 'WORKER', :grantedBy)
                """)
                .param("userId", userId)
                .param("grantedBy", actor.userId())
                .update();

            jdbc.sql("""
                    insert into site_memberships(user_id, site_id, role, status)
                    values (:userId, :siteId, 'WORKER', 'ACTIVE')
                """)
                .param("userId", userId)
                .param("siteId", siteId)
                .update();

            jdbc.sql("""
                    insert into worker_quick_login_credentials(user_id, name_initials, phone_last4, enabled)
                    values (:userId, :initials, :phoneLast4, true)
                """)
                .param("userId", userId)
                .param("initials", initials)
                .param("phoneLast4", phoneLast4)
                .update();

            audit.record(actor.userId(), siteId, "admin.worker.create", "worker", String.valueOf(userId), "ALLOWED", "created", Map.of("role", "WORKER"));
            return new WorkerResponse(userId, displayName, phone, siteId, "WORKER", initials);
        } catch (DataIntegrityViolationException e) {
            audit.record(actor.userId(), siteId, "admin.worker.create", "worker", null, "DENIED", "duplicate_worker", Map.of());
            throw new IllegalArgumentException("duplicate_worker");
        }
    }

    private static String cleanPhone(String value) {
        String digits = value == null ? "" : value.replaceAll("\\D", "");
        if (digits.length() < 8 || digits.length() > 15) {
            throw new IllegalArgumentException("invalid_phone");
        }
        return digits;
    }

    private static String cleanInitials(String value) {
        String initials = value == null ? "" : value.trim().replaceAll("[^A-Za-z0-9]", "").toUpperCase();
        if (!INITIALS_PATTERN.matcher(initials).matches()) {
            throw new IllegalArgumentException("name_initials_required");
        }
        return initials;
    }

    private static String cleanPhoneLast4(String value, String phone) {
        String digits = value == null || value.isBlank()
            ? phone.substring(phone.length() - 4)
            : value.replaceAll("\\D", "");
        if (!PHONE_LAST4_PATTERN.matcher(digits).matches()) {
            throw new IllegalArgumentException("phone_last4_required");
        }
        return digits;
    }

    private static String cleanLanguage(String value) {
        String language = value == null ? "ko" : value.trim().toLowerCase();
        return LANG_PATTERN.matcher(language).matches() ? language : "ko";
    }

    public record CreateWorkerRequest(
        @NotBlank String displayName,
        @NotBlank String phone,
        @NotBlank String nameInitials,
        String phoneLast4,
        String preferredLanguage
    ) {}

    public record WorkerResponse(Long id, String displayName, String phone, Long siteId, String role, String nameInitials) {}
}
