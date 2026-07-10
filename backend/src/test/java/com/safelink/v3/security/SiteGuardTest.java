package com.safelink.v3.security;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

class SiteGuardTest {
    private AuditService audit;
    private SiteGuard siteGuard;

    @BeforeEach
    void setUp() {
        audit = mock(AuditService.class);
        siteGuard = new SiteGuard(audit);
    }

    @Test
    void allowsGlobalRoleAcrossSites() {
        var root = principal(1L, Role.ROOT, Set.of());

        assertThatCode(() -> siteGuard.requireSiteAccess(root, 99L, "tbm.read", "tbm_notice", "99"))
            .doesNotThrowAnyException();
    }

    @Test
    void allowsMemberInsideAssignedSite() {
        var siteAdmin = principal(2L, Role.SITE_ADMIN, Set.of(10L));

        assertThatCode(() -> siteGuard.requireSiteAccess(siteAdmin, 10L, "tbm.read", "tbm_notice", "10"))
            .doesNotThrowAnyException();
    }

    @Test
    void deniesMissingSiteId() {
        var worker = principal(3L, Role.WORKER, Set.of(10L));

        assertThatThrownBy(() -> siteGuard.requireSiteAccess(worker, null, "tbm.read", "tbm_notice", null))
            .isInstanceOf(AccessDeniedException.class)
            .hasMessage("site_id_required");

        verify(audit).record(eq(3L), eq(null), eq("tbm.read"), eq("tbm_notice"), eq(null), eq("DENIED"), eq("site_id_required"), any());
    }

    @Test
    void deniesCrossSiteAccess() {
        var safetyManager = principal(4L, Role.SAFETY_MANAGER, Set.of(10L));

        assertThatThrownBy(() -> siteGuard.requireSiteAccess(safetyManager, 11L, "chat.messages.read", "chat_thread", "42"))
            .isInstanceOf(AccessDeniedException.class)
            .hasMessage("cross_site_denied");

        verify(audit).record(eq(4L), eq(11L), eq("chat.messages.read"), eq("chat_thread"), eq("42"), eq("DENIED"), eq("cross_site_denied"), any());
    }

    @Test
    void deniesNonAdminSiteUserManagement() {
        var worker = principal(5L, Role.WORKER, Set.of(10L));

        assertThatThrownBy(() -> siteGuard.requireGlobalOrSiteAdmin(worker, 10L, "admin.user.invite", "admin_invitation", null))
            .isInstanceOf(AccessDeniedException.class)
            .hasMessage("role_denied");

        verify(audit).record(eq(5L), eq(10L), eq("admin.user.invite"), eq("admin_invitation"), eq(null), eq("DENIED"), eq("role_denied"), any());
    }

    private static SessionPrincipal principal(Long userId, Role role, Set<Long> siteIds) {
        return new SessionPrincipal(userId, "user%d@example.com".formatted(userId), "User " + userId, Set.of(role), siteIds);
    }
}
