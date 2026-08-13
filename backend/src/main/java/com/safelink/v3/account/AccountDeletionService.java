package com.safelink.v3.account;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountDeletionService {
    private final JdbcClient jdbc;
    private final AuditService audit;
    private final AccountDeletionProperties properties;

    public AccountDeletionService(JdbcClient jdbc, AuditService audit, AccountDeletionProperties properties) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.properties = properties;
    }

    @Transactional
    public DeletionResult deleteOwnAccount(SessionPrincipal actor, String confirmation, String reason, String ipAddress) {
        if (!properties.isEnabled()) {
            throw new IllegalArgumentException("account_deletion_policy_not_approved");
        }
        if (actor.roles().contains(Role.ROOT)) {
            throw new IllegalArgumentException("root_self_deletion_not_allowed");
        }
        if (!"DELETE".equals(confirmation) && !"회원탈퇴".equals(confirmation)) {
            throw new IllegalArgumentException("account_deletion_confirmation_required");
        }

        Long requestId = jdbc.sql("""
                insert into account_deletion_requests(user_id, status, reason, requester_ip)
                values (:userId, 'REQUESTED', :reason, cast(:ipAddress as inet))
                returning id
            """)
            .param("userId", actor.userId())
            .param("reason", normalizeReason(reason))
            .param("ipAddress", normalizeIp(ipAddress))
            .query(Long.class)
            .single();

        audit.record(actor.userId(), null, "account.deletion", "user", String.valueOf(actor.userId()),
            "ALLOWED", "deletion_requested", Map.of("requestId", requestId));

        jdbc.sql("update user_credentials set disabled_at = now() where user_id = :userId")
            .param("userId", actor.userId()).update();
        jdbc.sql("update user_roles set revoked_at = coalesce(revoked_at, now()) where user_id = :userId")
            .param("userId", actor.userId()).update();
        jdbc.sql("update site_memberships set status = 'REVOKED' where user_id = :userId and status <> 'REVOKED'")
            .param("userId", actor.userId()).update();
        jdbc.sql("update worker_quick_login_credentials set enabled = false where user_id = :userId")
            .param("userId", actor.userId()).update();
        jdbc.sql("update password_reset_tokens set used_at = coalesce(used_at, now()) where user_id = :userId")
            .param("userId", actor.userId()).update();

        jdbc.sql("""
                update file_objects
                set retention_until = coalesce(
                    retention_until,
                    now() + make_interval(days => (
                        select retention_days from data_retention_policies where data_type = 'SAFETY_RECORD'
                    ))
                )
                where owner_user_id = :userId
                  and status = 'READY'
            """)
            .param("userId", actor.userId())
            .update();

        int updated = jdbc.sql("""
                update users
                set email = 'deleted-' || id || '@invalid.safelink.local',
                    phone = null,
                    display_name = '탈퇴 사용자',
                    preferred_language = 'ko',
                    account_status = 'DEACTIVATED',
                    deletion_requested_at = now(),
                    anonymized_at = now()
                where id = :userId
                  and account_status <> 'DEACTIVATED'
            """)
            .param("userId", actor.userId())
            .update();
        if (updated != 1) {
            throw new IllegalArgumentException("account_already_deactivated");
        }

        jdbc.sql("""
                update account_deletion_requests
                set status = 'COMPLETED', completed_at = now()
                where id = :requestId
            """)
            .param("requestId", requestId)
            .update();
        return new DeletionResult(requestId, "COMPLETED", true);
    }

    private static String normalizeReason(String reason) {
        if (reason == null || reason.isBlank()) return null;
        String value = reason.trim();
        return value.length() > 500 ? value.substring(0, 500) : value;
    }

    private static String normalizeIp(String ipAddress) {
        if (ipAddress == null || ipAddress.isBlank()) return "0.0.0.0";
        String value = ipAddress.trim();
        return value.contains(",") ? value.substring(0, value.indexOf(',')) : value;
    }

    public record DeletionResult(Long requestId, String status, boolean anonymized) {}
}
