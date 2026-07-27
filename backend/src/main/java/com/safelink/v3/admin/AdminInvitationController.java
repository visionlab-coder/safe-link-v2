package com.safelink.v3.admin;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
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

    public AdminInvitationController(JdbcClient jdbc, SiteGuard siteGuard, AuditService audit) {
        this.jdbc = jdbc;
        this.siteGuard = siteGuard;
        this.audit = audit;
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
}
