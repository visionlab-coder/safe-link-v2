package com.safelink.v3.admin;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.auth.UserAccountRepository;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/invitations")
public class AdminInvitationController {
    private final JdbcClient jdbc;
    private final SiteGuard siteGuard;
    private final AuditService audit;
    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;

    public AdminInvitationController(
        JdbcClient jdbc,
        SiteGuard siteGuard,
        AuditService audit,
        UserAccountRepository users,
        PasswordEncoder passwordEncoder
    ) {
        this.jdbc = jdbc;
        this.siteGuard = siteGuard;
        this.audit = audit;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping
    public InvitationResponse create(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody CreateInvitationRequest request) {
        Role targetRole = Role.parse(request.targetRole());
        if (targetRole == Role.ROOT || targetRole == Role.WORKER) {
            throw new IllegalArgumentException("unsupported_invitation_role");
        }
        if (targetRole != Role.HQ_ADMIN && request.targetSiteId() == null) {
            throw new IllegalArgumentException("target_site_id_required");
        }
        boolean canInvite = actor.roles().stream().anyMatch(Role::canCreateAdminInvitation);
        if (!canInvite) {
            audit.record(actor.userId(), request.targetSiteId(), "admin.invitation.create", "admin_invitation", null, "DENIED", "invitation_role_denied", Map.of("targetRole", targetRole.name()));
            throw new AccessDeniedException("invitation_role_denied");
        }
        if (targetRole == Role.HQ_ADMIN && actor.roles().stream().noneMatch(Role::hasGlobalSiteScope)) {
            audit.record(actor.userId(), null, "admin.invitation.create", "admin_invitation", null, "DENIED", "hq_invitation_role_denied", Map.of("targetRole", targetRole.name()));
            throw new AccessDeniedException("hq_invitation_role_denied");
        }
        if (request.targetSiteId() != null) {
            siteGuard.requireGlobalOrSiteAdmin(actor, request.targetSiteId(), "admin.invitation.create", "admin_invitation", null);
        }

        String rawToken = UUID.randomUUID() + "." + UUID.randomUUID();
        String tokenHash = sha256(rawToken);
        Long id = jdbc.sql("""
                insert into admin_invitations(email, phone, target_role, target_site_id, token_hash, invited_by, expires_at)
                values (:email, :phone, :targetRole, :targetSiteId, :tokenHash, :invitedBy, :expiresAt)
                returning id
            """)
            .param("email", blankToNull(request.email()))
            .param("phone", blankToNull(request.phone()))
            .param("targetRole", targetRole.name())
            .param("targetSiteId", request.targetSiteId())
            .param("tokenHash", tokenHash)
            .param("invitedBy", actor.userId())
            // PostgreSQL JDBC does not bind java.time.Instant without an explicit SQL type.
            // Convert it to Timestamp so invitation expiry is stored consistently in UTC.
            .param("expiresAt", java.sql.Timestamp.from(request.expiresAt()))
            .query(Long.class)
            .single();

        audit.record(actor.userId(), request.targetSiteId(), "admin.invitation.create", "admin_invitation", String.valueOf(id), "ALLOWED", "created", Map.of("targetRole", targetRole.name()));
        return new InvitationResponse(id, "PENDING", rawToken);
    }

    @PostMapping("/accept")
    @Transactional(noRollbackFor = InvitationExpiredException.class)
    public AcceptedInvitationResponse accept(@Valid @RequestBody AcceptInvitationRequest request) {
        String tokenHash = sha256(request.token().trim());
        InvitationRow invitation = jdbc.sql("""
                select id, email, target_role, target_site_id, status, expires_at
                from admin_invitations
                where token_hash = :tokenHash
                for update
            """)
            .param("tokenHash", tokenHash)
            .query((rs, rowNum) -> new InvitationRow(
                rs.getLong("id"),
                rs.getString("email"),
                Role.parse(rs.getString("target_role")),
                rs.getObject("target_site_id", Long.class),
                rs.getString("status"),
                rs.getTimestamp("expires_at").toInstant()
            ))
            .optional()
            .orElseThrow(() -> new IllegalArgumentException("invitation_invalid"));

        if (!"PENDING".equals(invitation.status())) {
            throw new IllegalArgumentException("invitation_not_pending");
        }
        if (!invitation.expiresAt().isAfter(Instant.now())) {
            jdbc.sql("""
                    update admin_invitations
                    set status = 'EXPIRED', decided_at = now()
                    where id = :id and status = 'PENDING'
                """)
                .param("id", invitation.id())
                .update();
            audit.record(null, invitation.targetSiteId(), "admin.invitation.accept", "admin_invitation", String.valueOf(invitation.id()), "DENIED", "expired", Map.of());
            throw new InvitationExpiredException();
        }
        if (invitation.email() == null || invitation.email().isBlank()) {
            throw new IllegalArgumentException("invitation_email_required");
        }
        if (users.findByEmail(invitation.email()).isPresent()) {
            throw new IllegalArgumentException("invitation_email_already_registered");
        }

        var account = users.createPendingAdminSignupAccount(
            invitation.email().trim().toLowerCase(java.util.Locale.ROOT),
            request.displayName().trim(),
            request.preferredLanguage() == null || request.preferredLanguage().isBlank() ? "ko" : request.preferredLanguage().trim().toLowerCase(java.util.Locale.ROOT),
            passwordEncoder.encode(request.password())
        );
        jdbc.sql("""
                update admin_invitations
                set status = 'ACCEPTED', accepted_by = :userId, accepted_at = now()
                where id = :id and status = 'PENDING'
            """)
            .param("userId", account.id())
            .param("id", invitation.id())
            .update();
        audit.record(account.id(), invitation.targetSiteId(), "admin.invitation.accept", "admin_invitation", String.valueOf(invitation.id()), "ALLOWED", "pending_approval", Map.of("targetRole", invitation.targetRole().name()));
        return new AcceptedInvitationResponse(invitation.id(), "ACCEPTED", account.id(), "PENDING", true);
    }

    @PostMapping("/{invitationId}/revoke")
    @Transactional
    public InvitationStatusResponse revoke(
        @AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable Long invitationId
    ) {
        InvitationRow invitation = jdbc.sql("""
                select id, email, target_role, target_site_id, status, expires_at
                from admin_invitations
                where id = :id
                for update
            """)
            .param("id", invitationId)
            .query((rs, rowNum) -> new InvitationRow(
                rs.getLong("id"),
                rs.getString("email"),
                Role.parse(rs.getString("target_role")),
                rs.getObject("target_site_id", Long.class),
                rs.getString("status"),
                rs.getTimestamp("expires_at").toInstant()
            ))
            .optional()
            .orElseThrow(() -> new IllegalArgumentException("invitation_not_found"));
        if (invitation.targetSiteId() == null) {
            if (actor == null || !actor.hasAnyGlobalRole()) {
                throw new AccessDeniedException("global_role_required");
            }
        } else {
            siteGuard.requireGlobalOrSiteAdmin(actor, invitation.targetSiteId(), "admin.invitation.revoke", "admin_invitation", String.valueOf(invitationId));
        }
        if (!"PENDING".equals(invitation.status())) {
            throw new IllegalArgumentException("invitation_not_pending");
        }
        jdbc.sql("""
                update admin_invitations
                set status = 'REVOKED', decided_by = :actorId, decided_at = now()
                where id = :id and status = 'PENDING'
            """)
            .param("actorId", actor.userId())
            .param("id", invitationId)
            .update();
        audit.record(actor.userId(), invitation.targetSiteId(), "admin.invitation.revoke", "admin_invitation", String.valueOf(invitationId), "ALLOWED", "revoked", Map.of());
        return new InvitationStatusResponse(invitationId, "REVOKED");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public record CreateInvitationRequest(String email, String phone, @NotBlank String targetRole, Long targetSiteId, @NotNull @Future Instant expiresAt) {}
    public record InvitationResponse(Long id, String status, String oneTimeToken) {}
    public record AcceptInvitationRequest(@NotBlank String token, @NotBlank String password, @NotBlank String displayName, String preferredLanguage) {
        public AcceptInvitationRequest {
            if (password != null && password.length() < 12) {
                throw new IllegalArgumentException("password_min_length");
            }
        }
    }
    public record AcceptedInvitationResponse(Long invitationId, String invitationStatus, Long userId, String accountStatus, boolean approvalRequired) {}
    public record InvitationStatusResponse(Long invitationId, String status) {}
    private record InvitationRow(Long id, String email, Role targetRole, Long targetSiteId, String status, Instant expiresAt) {}

    private static final class InvitationExpiredException extends IllegalArgumentException {
        private InvitationExpiredException() {
            super("invitation_expired");
        }
    }
}
