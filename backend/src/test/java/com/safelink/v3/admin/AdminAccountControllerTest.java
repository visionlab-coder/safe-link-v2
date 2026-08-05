package com.safelink.v3.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.auth.UserAccount;
import com.safelink.v3.auth.UserAccountRepository;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.mockito.Answers;

class AdminAccountControllerTest {
    private UserAccountRepository users;
    private SiteGuard siteGuard;
    private AuditService audit;
    private AdminAccountController controller;

    @BeforeEach
    void setUp() {
        users = mock(UserAccountRepository.class);
        siteGuard = mock(SiteGuard.class);
        audit = mock(AuditService.class);
        controller = new AdminAccountController(users, siteGuard, audit, mock(JdbcClient.class, Answers.RETURNS_DEEP_STUBS));
    }

    @Test
    void approveSiteScopedAdminRequiresTargetSiteId() {
        var actor = new SessionPrincipal(1L, "hq@seowonenc.co.kr", "HQ", Set.of(Role.HQ_ADMIN), Set.of());

        assertThatThrownBy(() -> controller.approve(
            actor,
            31L,
            new AdminAccountController.ApproveAdminAccountRequest("SITE_ADMIN", null)
        ))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("target_site_id_required");

        verifyNoInteractions(users, siteGuard);
    }

    @Test
    void approvePendingSiteAdminValidatesSiteScopeAndActivatesAccount() {
        var actor = new SessionPrincipal(2L, "site-admin@seowonenc.co.kr", "Site Admin", Set.of(Role.SITE_ADMIN), Set.of(11L));
        var pending = new UserAccount(31L, "pending@seowonenc.co.kr", "Pending", "PENDING", "$2a$hash", Set.of(), Set.of());
        var approved = new UserAccount(31L, "pending@seowonenc.co.kr", "Pending", "ACTIVE", "$2a$hash", Set.of(Role.SITE_ADMIN), Set.of(11L));
        when(users.findById(31L)).thenReturn(Optional.of(pending));
        when(users.approvePendingAdminAccount(31L, Role.SITE_ADMIN, 11L, 2L)).thenReturn(approved);

        var response = controller.approve(
            actor,
            31L,
            new AdminAccountController.ApproveAdminAccountRequest("SITE_ADMIN", 11L)
        );

        assertThat(response.id()).isEqualTo(31L);
        assertThat(response.roles()).containsExactly("SITE_ADMIN");
        assertThat(response.siteIds()).containsExactly(11L);
        verify(siteGuard).requireGlobalOrSiteAdmin(actor, 11L, "admin.account.approve", "user", null);
        verify(users).assertActiveSite(11L);
        verify(audit).record(eq(2L), eq(11L), eq("admin.account.approve"), eq("user"), eq("31"), eq("ALLOWED"), eq("approved"), any());
    }

    @Test
    void approveHqAdminRequiresGlobalActor() {
        var actor = new SessionPrincipal(3L, "site-admin@seowonenc.co.kr", "Site Admin", Set.of(Role.SITE_ADMIN), Set.of(11L));

        assertThatThrownBy(() -> controller.approve(
            actor,
            31L,
            new AdminAccountController.ApproveAdminAccountRequest("HQ_ADMIN", null)
        ))
            .isInstanceOf(AccessDeniedException.class)
            .hasMessage("global_role_required");

        verifyNoInteractions(users, siteGuard);
        verify(audit).record(eq(3L), eq(null), eq("admin.account.approve"), eq("user"), eq(null), eq("DENIED"), eq("global_role_required"), any());
    }
}
