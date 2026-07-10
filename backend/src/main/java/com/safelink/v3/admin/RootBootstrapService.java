package com.safelink.v3.admin;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.UserAccount;
import com.safelink.v3.auth.UserAccountRepository;
import com.safelink.v3.domain.Role;
import java.util.Locale;
import java.util.Map;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RootBootstrapService {
    private static final int ROOT_PASSWORD_MIN_LENGTH = 12;

    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;

    public RootBootstrapService(UserAccountRepository users, PasswordEncoder passwordEncoder, AuditService audit) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
    }

    @Transactional
    public BootstrapResult bootstrap(
        String email,
        String rawPassword,
        String displayName,
        String preferredLanguage,
        String token,
        String confirmToken
    ) {
        requireMatchingToken(token, confirmToken);
        if (users.hasActiveRole(Role.ROOT)) {
            return BootstrapResult.skipped("root_already_exists", null);
        }

        String normalizedEmail = normalizeEmail(email);
        if (users.findByEmail(normalizedEmail).isPresent()) {
            throw new IllegalArgumentException("root_bootstrap_email_already_registered");
        }
        if (rawPassword == null || rawPassword.length() < ROOT_PASSWORD_MIN_LENGTH) {
            throw new IllegalArgumentException("root_bootstrap_password_min_length");
        }

        String passwordHash = passwordEncoder.encode(rawPassword);
        UserAccount account = users.createRootBootstrapAccount(
            normalizedEmail,
            resolveDisplayName(displayName),
            resolvePreferredLanguage(preferredLanguage),
            passwordHash
        );
        audit.record(
            account.id(),
            null,
            "root.bootstrap",
            "user",
            String.valueOf(account.id()),
            "ALLOWED",
            "created",
            Map.of("role", Role.ROOT.name())
        );
        return BootstrapResult.created(account.id());
    }

    private static void requireMatchingToken(String token, String confirmToken) {
        if (token == null || token.isBlank() || confirmToken == null || confirmToken.isBlank()) {
            throw new IllegalArgumentException("root_bootstrap_token_required");
        }
        if (!token.equals(confirmToken)) {
            throw new IllegalArgumentException("root_bootstrap_token_mismatch");
        }
    }

    private static String normalizeEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("root_bootstrap_email_required");
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        if (!normalized.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new IllegalArgumentException("root_bootstrap_email_invalid");
        }
        return normalized;
    }

    private static String resolveDisplayName(String displayName) {
        if (displayName == null || displayName.isBlank()) {
            return "System Root";
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

    public record BootstrapResult(String status, String reason, Long userId) {
        static BootstrapResult created(Long userId) {
            return new BootstrapResult("CREATED", null, userId);
        }

        static BootstrapResult skipped(String reason, Long userId) {
            return new BootstrapResult("SKIPPED", reason, userId);
        }
    }
}
