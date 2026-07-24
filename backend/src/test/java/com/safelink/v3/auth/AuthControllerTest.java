package com.safelink.v3.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.domain.Role;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.http.HttpStatus;

class AuthControllerTest {
    private AuthService authService;
    private AuditService audit;
    private LoginAttemptRateLimiter loginAttemptRateLimiter;
    private AuthController authController;

    @BeforeEach
    void setUp() {
        authService = mock(AuthService.class);
        audit = mock(AuditService.class);
        loginAttemptRateLimiter = mock(LoginAttemptRateLimiter.class);
        authController = new AuthController(authService, audit, loginAttemptRateLimiter);
    }

    @Test
    void adminSignupCreatesPendingAccountWithoutSession() {
        var signup = new AuthService.PendingAdminSignup(
            31L,
            "admin@seowonenc.co.kr",
            "Admin",
            "ko",
            "PENDING",
            true
        );
        when(authService.registerDirectAdminSignup(
            eq("admin@seowonenc.co.kr"),
            eq("password1234"),
            eq("Admin"),
            eq("ko"),
            any()
        )).thenReturn(signup);

        var request = new MockHttpServletRequest();

        var response = authController.adminSignup(
            Map.of(
                "email", "admin@seowonenc.co.kr",
                "password", "password1234",
                "display_name", "Admin",
                "preferred_lang", "ko"
            ),
            request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().id()).isEqualTo(31L);
        assertThat(response.getBody().accountStatus()).isEqualTo("PENDING");
        assertThat(response.getBody().approvalRequired()).isTrue();
        assertThat(request.getSession(false)).isNull();
        verify(authService).registerDirectAdminSignup(
            eq("admin@seowonenc.co.kr"),
            eq("password1234"),
            eq("Admin"),
            eq("ko"),
            any()
        );
    }

    @Test
    void setupProfileKeepsRoleAndSiteServerControlled() {
        var principal = new SessionPrincipal(
            31L,
            "admin@seowonenc.co.kr",
            "Admin",
            Set.of(Role.SITE_ADMIN),
            Set.of()
        );
        var updated = new SessionPrincipal(
            31L,
            "admin@seowonenc.co.kr",
            "Site Manager",
            Set.of(Role.SITE_ADMIN),
            Set.of()
        );
        when(authService.updateOwnProfile(
            eq(principal),
            eq("Site Manager"),
            eq("ko"),
            any(),
            any()
        )).thenReturn(updated);

        var request = new MockHttpServletRequest();
        var response = new MockHttpServletResponse();

        var currentUser = authController.setupProfile(
            principal,
            Map.of(
                "display_name", "Site Manager",
                "preferred_lang", "ko",
                "setupRole", "root",
                "site_id", "999"
            ),
            request,
            response
        );

        assertThat(currentUser.displayName()).isEqualTo("Site Manager");
        assertThat(currentUser.roles()).containsExactly("SITE_ADMIN");
        assertThat(currentUser.siteIds()).isEmpty();
        verify(authService).updateOwnProfile(eq(principal), eq("Site Manager"), eq("ko"), any(), any());
    }

    @Test
    void adminSignupRejectsClientProvidedRoleFields() {
        assertThatThrownBy(() -> authController.adminSignup(
            Map.of(
                "email", "admin@seowonenc.co.kr",
                "password", "password123",
                "role", "ROOT"
            ),
            new MockHttpServletRequest()
        ))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("admin_signup_role_fields_not_allowed");

        verifyNoInteractions(authService);
    }
}
