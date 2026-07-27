package com.safelink.v3.admin;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.auth.UserAccount;
import com.safelink.v3.auth.UserAccountRepository;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import com.safelink.v3.support.NotFoundException;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/accounts")
public class AdminAccountController {
    private final UserAccountRepository users;
    private final SiteGuard siteGuard;
    private final AuditService audit;

    public AdminAccountController(UserAccountRepository users, SiteGuard siteGuard, AuditService audit) {
        this.users = users;
        this.siteGuard = siteGuard;
        this.audit = audit;
    }

    @GetMapping("/pending")
    public PendingAdminAccountsResponse pending(@AuthenticationPrincipal SessionPrincipal actor) {
        requireApprovalAuthority(actor, null, Role.SITE_ADMIN);
        return new PendingAdminAccountsResponse(
            users.findPendingAdminSignupAccounts().stream()
                .map(PendingAdminAccount::from)
                .toList()
        );
    }

    @PostMapping("/{userId}/approve")
    public ApprovedAdminAccount approve(
        @AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable Long userId,
        @RequestBody ApproveAdminAccountRequest request
    ) {
        Role role = request.targetRole() == null || request.targetRole().isBlank()
            ? Role.SITE_ADMIN
            : Role.parse(request.targetRole());
        if (role == Role.ROOT || role == Role.WORKER) {
            throw new IllegalArgumentException("unsupported_admin_approval_role");
        }
        Long siteId = request.targetSiteId();
        if (!role.hasGlobalSiteScope() && siteId == null) {
            throw new IllegalArgumentException("target_site_id_required");
        }
        requireApprovalAuthority(actor, siteId, role);

        var account = users.findById(userId)
            .orElseThrow(() -> new NotFoundException("pending_admin_not_found"));
        if (!"PENDING".equalsIgnoreCase(account.accountStatus())) {
            throw new IllegalArgumentException("account_not_pending");
        }

        if (!role.hasGlobalSiteScope()) {
            users.assertActiveSite(siteId);
        }

        var approved = users.approvePendingAdminAccount(userId, role, siteId, actor.userId());
        audit.record(
            actor.userId(),
            role.hasGlobalSiteScope() ? null : siteId,
            "admin.account.approve",
            "user",
            String.valueOf(userId),
            "ALLOWED",
            "approved",
            Map.of("targetRole", role.name())
        );
        return ApprovedAdminAccount.from(approved);
    }

    @PostMapping("/{userId}/reject")
    public java.util.Map<String, Boolean> reject(
        @AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable Long userId
    ) {
        // A pending applicant has no site membership yet; only a global administrator
        // may reject it before a site-specific role is granted.
        requireApprovalAuthority(actor, null, Role.SITE_ADMIN);
        var account = users.findById(userId)
            .orElseThrow(() -> new NotFoundException("pending_admin_not_found"));
        if (!"PENDING".equalsIgnoreCase(account.accountStatus())) {
            throw new IllegalArgumentException("account_not_pending");
        }
        users.rejectPendingAdminAccount(userId);
        audit.record(actor.userId(), null, "admin.account.reject", "user", String.valueOf(userId), "ALLOWED", "rejected", Map.of());
        return java.util.Map.of("ok", true);
    }

    private void requireApprovalAuthority(SessionPrincipal actor, Long siteId, Role targetRole) {
        if (actor == null) {
            throw new AccessDeniedException("authentication_required");
        }
        if (targetRole == Role.HQ_ADMIN) {
            if (!actor.hasAnyGlobalRole()) {
                audit.record(actor.userId(), null, "admin.account.approve", "user", null, "DENIED", "global_role_required", Map.of("targetRole", targetRole.name()));
                throw new AccessDeniedException("global_role_required");
            }
            return;
        }
        if (siteId == null) {
            boolean canApproveAnySite = actor.roles().stream().anyMatch(Role::hasGlobalSiteScope);
            if (!canApproveAnySite) {
                audit.record(actor.userId(), null, "admin.account.approve", "user", null, "DENIED", "target_site_id_required", Map.of("targetRole", targetRole.name()));
                throw new AccessDeniedException("target_site_id_required");
            }
            return;
        }
        siteGuard.requireGlobalOrSiteAdmin(actor, siteId, "admin.account.approve", "user", null);
    }

    public record ApproveAdminAccountRequest(@JsonProperty("target_role") String targetRole, @JsonProperty("target_site_id") Long targetSiteId) {}
    public record PendingAdminAccountsResponse(List<PendingAdminAccount> accounts) {}
    public record PendingAdminAccount(Long id, String email, String displayName, String preferredLanguage, String accountStatus) {
        static PendingAdminAccount from(UserAccount account) {
            return new PendingAdminAccount(account.id(), account.email(), account.displayName(), account.preferredLanguage(), account.accountStatus());
        }
    }
    public record ApprovedAdminAccount(Long id, String email, String displayName, String preferredLanguage, List<String> roles, List<Long> siteIds) {
        static ApprovedAdminAccount from(UserAccount account) {
            return new ApprovedAdminAccount(
                account.id(),
                account.email(),
                account.displayName(),
                account.preferredLanguage(),
                account.roles().stream().map(Enum::name).sorted().toList(),
                account.siteIds().stream().sorted().toList()
            );
        }
    }
}
