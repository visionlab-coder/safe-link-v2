package com.safelink.v3.auth;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.domain.Role;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private static final String ADMIN_SIGNUP_DOMAIN = "seowonenc.co.kr";

    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;

    public AuthService(UserAccountRepository users, PasswordEncoder passwordEncoder, AuditService audit) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
    }

    public SessionPrincipal authenticate(String email, String rawPassword, String ipAddress) {
        var account = users.findByEmail(email)
            .orElseThrow(() -> {
                audit.record(null, null, "auth.login", "user", email, "DENIED", "unknown_email", Map.of("ip", ipAddress));
                return new BadCredentialsException("invalid_credentials");
            });

        if (!account.isActive()) {
            audit.record(account.id(), null, "auth.login", "user", String.valueOf(account.id()), "DENIED", "account_not_active", Map.of("ip", ipAddress));
            throw new BadCredentialsException("account_not_active");
        }

        if (account.passwordHash() == null || !passwordEncoder.matches(rawPassword, account.passwordHash())) {
            audit.record(account.id(), null, "auth.login", "user", String.valueOf(account.id()), "DENIED", "password_mismatch", Map.of("ip", ipAddress));
            throw new BadCredentialsException("invalid_credentials");
        }

        audit.record(account.id(), null, "auth.login", "user", String.valueOf(account.id()), "ALLOWED", "password", Map.of("ip", ipAddress));
        return account.toPrincipal();
    }

    @Transactional
    public PendingAdminSignup registerDirectAdminSignup(
        String email,
        String rawPassword,
        String displayName,
        String preferredLanguage,
        String ipAddress
    ) {
        String normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail.endsWith("@" + ADMIN_SIGNUP_DOMAIN)) {
            audit.record(null, null, "auth.admin_signup", "user", normalizedEmail, "DENIED", "domain_not_allowed", Map.of("ip", ipAddress));
            throw new IllegalArgumentException("domain_not_allowed");
        }
        if (rawPassword == null || rawPassword.length() < 8) {
            throw new IllegalArgumentException("password_min_length");
        }
        if (users.findByEmail(normalizedEmail).isPresent()) {
            audit.record(null, null, "auth.admin_signup", "user", normalizedEmail, "DENIED", "email_already_registered", Map.of("ip", ipAddress));
            throw new UserAlreadyExistsException("email_already_registered");
        }

        String resolvedDisplayName = resolveDisplayName(displayName, normalizedEmail);
        String resolvedLanguage = resolvePreferredLanguage(preferredLanguage);
        String passwordHash = passwordEncoder.encode(rawPassword);

        try {
            var account = users.createPendingAdminSignupAccount(
                normalizedEmail,
                resolvedDisplayName,
                resolvedLanguage,
                passwordHash
            );
            audit.record(
                account.id(),
                null,
                "auth.admin_signup",
                "user",
                String.valueOf(account.id()),
                "ALLOWED",
                "pending_approval",
                Map.of("ip", ipAddress, "requestedRole", Role.SITE_ADMIN.name())
            );
            return new PendingAdminSignup(
                account.id(),
                account.email(),
                account.displayName(),
                account.preferredLanguage(),
                account.accountStatus(),
                true
            );
        } catch (DataIntegrityViolationException e) {
            audit.record(null, null, "auth.admin_signup", "user", normalizedEmail, "DENIED", "email_already_registered", Map.of("ip", ipAddress));
            throw new UserAlreadyExistsException("email_already_registered");
        }
    }

    @Transactional
    public SessionPrincipal updateOwnProfile(
        SessionPrincipal principal,
        String displayName,
        String preferredLanguage,
        Map<String, String> requestedProfile,
        String ipAddress
    ) {
        if (principal == null) {
            throw new BadCredentialsException("session_required");
        }
        String resolvedDisplayName = requireDisplayName(displayName);
        String resolvedLanguage = resolvePreferredLanguage(preferredLanguage);
        users.updateProfile(principal.userId(), resolvedDisplayName, resolvedLanguage);
        audit.record(
            principal.userId(),
            null,
            "auth.profile_setup",
            "user",
            String.valueOf(principal.userId()),
            "ALLOWED",
            "self_profile_update",
            Map.of(
                "ip", ipAddress,
                "roleAssignment", "server_controlled",
                "siteAssignment", "server_controlled",
                "requestedProfile", requestedProfile.toString()
            )
        );
        return users.findById(principal.userId())
            .orElseThrow(() -> new IllegalStateException("updated_user_not_found"))
            .toPrincipal();
    }

    public WorkerQuickLoginResult authenticateWorkerQuickLogin(
        String initials,
        String phoneLast4,
        Long requestedSiteId,
        String preferredLanguage,
        String ipAddress
    ) {
        var candidates = users.findWorkerQuickLoginCandidates(initials, phoneLast4).stream()
            .filter(UserAccount::isActive)
            .filter(account -> account.roles().contains(Role.WORKER))
            .filter(account -> !account.siteIds().isEmpty())
            .toList();

        if (requestedSiteId != null) {
            candidates = candidates.stream()
                .filter(account -> account.siteIds().contains(requestedSiteId))
                .toList();
        }

        if (candidates.isEmpty()) {
            audit.record(null, requestedSiteId, "auth.worker_quick_login", "user", null, "DENIED", "worker_not_found", Map.of("ip", ipAddress));
            throw new WorkerQuickLoginNotFoundException("worker_not_found");
        }

        Set<Long> matchingSiteIds = new LinkedHashSet<>();
        for (UserAccount account : candidates) {
            if (requestedSiteId == null) {
                matchingSiteIds.addAll(account.siteIds());
            } else if (account.siteIds().contains(requestedSiteId)) {
                matchingSiteIds.add(requestedSiteId);
            }
        }

        if (requestedSiteId == null && matchingSiteIds.size() > 1) {
            var sites = users.siteOptionsFor(matchingSiteIds);
            audit.record(null, null, "auth.worker_quick_login", "user", null, "DENIED", "multiple_site_match", Map.of("ip", ipAddress, "siteCount", sites.size()));
            return new WorkerQuickLoginMultipleSites(sites);
        }

        if (candidates.size() != 1) {
            audit.record(null, requestedSiteId, "auth.worker_quick_login", "user", null, "DENIED", "ambiguous_worker_match", Map.of("ip", ipAddress));
            throw new WorkerQuickLoginConflictException("ambiguous_worker_match");
        }

        var account = candidates.getFirst();
        if (preferredLanguage != null && !preferredLanguage.isBlank()) {
            users.updatePreferredLanguage(account.id(), preferredLanguage);
        }
        audit.record(account.id(), requestedSiteId, "auth.worker_quick_login", "user", String.valueOf(account.id()), "ALLOWED", "quick_login", Map.of("ip", ipAddress));
        return new WorkerQuickLoginSuccess(account.toPrincipal());
    }

    public sealed interface WorkerQuickLoginResult permits WorkerQuickLoginSuccess, WorkerQuickLoginMultipleSites {}
    public record WorkerQuickLoginSuccess(SessionPrincipal principal) implements WorkerQuickLoginResult {}
    public record WorkerQuickLoginMultipleSites(List<UserAccountRepository.SiteOption> sites) implements WorkerQuickLoginResult {}
    public record PendingAdminSignup(
        Long id,
        String email,
        String displayName,
        String preferredLanguage,
        String accountStatus,
        boolean approvalRequired
    ) {}

    private static String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("email_required");
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private static String resolveDisplayName(String displayName, String email) {
        if (displayName != null && !displayName.isBlank()) {
            return displayName.trim();
        }
        int at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : "관리자";
    }

    private static String requireDisplayName(String displayName) {
        if (displayName == null || displayName.isBlank()) {
            throw new IllegalArgumentException("display_name_required");
        }
        return displayName.trim();
    }

    private static String resolvePreferredLanguage(String preferredLanguage) {
        if (preferredLanguage == null || preferredLanguage.isBlank()) {
            return "ko";
        }
        String language = preferredLanguage.trim().toLowerCase(Locale.ROOT);
        return language.matches("^[a-z]{2,5}$") ? language : "ko";
    }

    public static class WorkerQuickLoginNotFoundException extends RuntimeException {
        public WorkerQuickLoginNotFoundException(String message) {
            super(message);
        }
    }

    public static class WorkerQuickLoginConflictException extends RuntimeException {
        public WorkerQuickLoginConflictException(String message) {
            super(message);
        }
    }

    public static class UserAlreadyExistsException extends RuntimeException {
        public UserAlreadyExistsException(String message) {
            super(message);
        }
    }
}
