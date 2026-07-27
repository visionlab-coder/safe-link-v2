package com.safelink.v3.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.auth.UserAccount;
import com.safelink.v3.auth.UserAccountRepository;
import com.safelink.v3.domain.Role;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

class CurrentAccountSessionFilterTest {
    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void invalidatesSessionAndBlocksRequestWhenAccountIsSuspended() throws Exception {
        var users = mock(UserAccountRepository.class);
        var filter = new CurrentAccountSessionFilter(users);
        var principal = new SessionPrincipal(42L, "qa@example.com", "QA", Set.of(Role.SAFETY_MANAGER), Set.of(2L));
        SecurityContextHolder.getContext().setAuthentication(
            UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities())
        );
        when(users.findById(42L)).thenReturn(Optional.of(new UserAccount(
            42L, "qa@example.com", "QA", "ko", "SUSPENDED", "", Set.of(Role.SAFETY_MANAGER), Set.of(2L)
        )));
        var request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        request.getSession();
        var response = new MockHttpServletResponse();
        var chain = mock(org.springframework.mock.web.MockFilterChain.class);

        filter.doFilter(request, response, chain);

        assertThat(response.getStatus()).isEqualTo(401);
        assertThat(request.getSession(false)).isNull();
        verify(chain, org.mockito.Mockito.never()).doFilter(request, response);
    }

    @Test
    void refreshesRolesAndSiteMembershipsFromDatabase() throws Exception {
        var users = mock(UserAccountRepository.class);
        var filter = new CurrentAccountSessionFilter(users);
        var stale = new SessionPrincipal(43L, "qa@example.com", "QA", Set.of(Role.SAFETY_MANAGER), Set.of(2L));
        SecurityContextHolder.getContext().setAuthentication(
            UsernamePasswordAuthenticationToken.authenticated(stale, null, stale.getAuthorities())
        );
        when(users.findById(43L)).thenReturn(Optional.of(new UserAccount(
            43L, "qa@example.com", "QA", "ko", "ACTIVE", "", Set.of(Role.WORKER), Set.of(5L)
        )));
        var request = new MockHttpServletRequest("GET", "/api/v1/auth/me");
        var response = new MockHttpServletResponse();
        var chain = mock(org.springframework.mock.web.MockFilterChain.class);

        filter.doFilter(request, response, chain);

        var refreshed = (SessionPrincipal) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        assertThat(refreshed.roles()).containsExactly(Role.WORKER);
        assertThat(refreshed.siteIds()).containsExactly(5L);
    }
}
