package com.safelink.v3.auth;

import com.safelink.v3.audit.AuditService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordResetService {
    private static final Duration TOKEN_TTL = Duration.ofMinutes(30);
    private static final int PASSWORD_MIN_LENGTH = 12;
    private final JdbcClient jdbc;
    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;
    private final SecureRandom secureRandom = new SecureRandom();

    public PasswordResetService(JdbcClient jdbc, UserAccountRepository users, PasswordEncoder passwordEncoder, AuditService audit) {
        this.jdbc = jdbc;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
    }

    @Transactional
    public ResetRequestResult request(String email, String ipAddress) {
        var account = users.findByEmail(email == null ? "" : email.trim());
        if (account.isEmpty() || !account.get().isActive()) {
            audit.record(null, null, "auth.password_reset.request", "user", null, "ALLOWED", "generic_response", Map.of("ip", ipAddress));
            return new ResetRequestResult(null, false);
        }

        byte[] tokenBytes = new byte[32];
        secureRandom.nextBytes(tokenBytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        Instant expiresAt = Instant.now().plus(TOKEN_TTL);
        jdbc.sql("update password_reset_tokens set used_at = now() where user_id = :userId and used_at is null")
            .param("userId", account.get().id())
            .update();
        jdbc.sql("""
                insert into password_reset_tokens(user_id, token_hash, requested_ip, expires_at)
                values (:userId, :tokenHash, :requestedIp, :expiresAt)
            """)
            .param("userId", account.get().id())
            .param("tokenHash", sha256(rawToken))
            .param("requestedIp", ipAddress)
            .param("expiresAt", Timestamp.from(expiresAt))
            .update();
        audit.record(account.get().id(), null, "auth.password_reset.request", "user", String.valueOf(account.get().id()), "ALLOWED", "token_created", Map.of("ip", ipAddress));
        return new ResetRequestResult(rawToken, true);
    }

    @Transactional
    public void confirm(String rawToken, String newPassword, String ipAddress) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("password_reset_token_required");
        }
        if (newPassword == null || newPassword.length() < PASSWORD_MIN_LENGTH) {
            throw new IllegalArgumentException("password_min_length");
        }
        var token = jdbc.sql("""
                select id, user_id, expires_at, used_at
                from password_reset_tokens
                where token_hash = :tokenHash
                for update
            """)
            .param("tokenHash", sha256(rawToken.trim()))
            .query((rs, rowNum) -> new ResetToken(
                rs.getLong("id"),
                rs.getLong("user_id"),
                rs.getTimestamp("expires_at").toInstant(),
                rs.getTimestamp("used_at") == null ? null : rs.getTimestamp("used_at").toInstant()
            ))
            .optional()
            .orElseThrow(() -> new IllegalArgumentException("password_reset_token_invalid"));
        if (token.usedAt() != null) {
            throw new IllegalArgumentException("password_reset_token_used");
        }
        if (!token.expiresAt().isAfter(Instant.now())) {
            throw new IllegalArgumentException("password_reset_token_expired");
        }
        users.updatePassword(token.userId(), passwordEncoder.encode(newPassword));
        jdbc.sql("update password_reset_tokens set used_at = now() where id = :id and used_at is null")
            .param("id", token.id())
            .update();
        audit.record(token.userId(), null, "auth.password_reset.confirm", "user", String.valueOf(token.userId()), "ALLOWED", "password_changed", Map.of("ip", ipAddress));
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public record ResetRequestResult(String token, boolean accountMatched) {}
    private record ResetToken(Long id, Long userId, Instant expiresAt, Instant usedAt) {}
}
