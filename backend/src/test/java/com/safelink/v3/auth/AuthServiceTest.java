package com.safelink.v3.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.domain.Role;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

class AuthServiceTest {
    private UserAccountRepository users;
    private PasswordEncoder passwordEncoder;
    private AuditService audit;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        users = mock(UserAccountRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        audit = mock(AuditService.class);
        authService = new AuthService(users, passwordEncoder, audit);
    }

    @Test
    void authenticatesActiveUserIntoSessionPrincipal() {
        var account = new UserAccount(
            7L,
            "admin@seowonenc.co.kr",
            "Site Admin",
            "ACTIVE",
            "$2a$hash",
            Set.of(Role.SITE_ADMIN),
            Set.of(11L)
        );
        when(users.findByEmail("admin@seowonenc.co.kr")).thenReturn(Optional.of(account));
        when(passwordEncoder.matches("password", "$2a$hash")).thenReturn(true);

        SessionPrincipal principal = authService.authenticate("admin@seowonenc.co.kr", "password", "127.0.0.1");

        assertThat(principal.userId()).isEqualTo(7L);
        assertThat(principal.roles()).containsExactly(Role.SITE_ADMIN);
        assertThat(principal.siteIds()).containsExactly(11L);
        verify(audit).record(eq(7L), eq(null), eq("auth.login"), eq("user"), eq("7"), eq("ALLOWED"), eq("password"), any());
    }

    @Test
    void rejectsInactiveAccount() {
        var account = new UserAccount(
            8L,
            "pending@example.com",
            "Pending User",
            "PENDING",
            "$2a$hash",
            Set.of(Role.WORKER),
            Set.of(11L)
        );
        when(users.findByEmail("pending@example.com")).thenReturn(Optional.of(account));

        assertThatThrownBy(() -> authService.authenticate("pending@example.com", "password", "127.0.0.1"))
            .isInstanceOf(BadCredentialsException.class)
            .hasMessage("account_not_active");

        verify(audit).record(eq(8L), eq(null), eq("auth.login"), eq("user"), eq("8"), eq("DENIED"), eq("account_not_active"), any());
    }

    @Test
    void rejectsPasswordMismatch() {
        var account = new UserAccount(
            9L,
            "worker@example.com",
            "Worker",
            "ACTIVE",
            "$2a$hash",
            Set.of(Role.WORKER),
            Set.of(11L)
        );
        when(users.findByEmail("worker@example.com")).thenReturn(Optional.of(account));
        when(passwordEncoder.matches("bad", "$2a$hash")).thenReturn(false);

        assertThatThrownBy(() -> authService.authenticate("worker@example.com", "bad", "127.0.0.1"))
            .isInstanceOf(BadCredentialsException.class)
            .hasMessage("invalid_credentials");

        verify(audit).record(eq(9L), eq(null), eq("auth.login"), eq("user"), eq("9"), eq("DENIED"), eq("password_mismatch"), any());
    }

    @Test
    void quickLoginAuthenticatesWorkerIntoSessionPrincipal() {
        var account = new UserAccount(
            10L,
            "worker@example.com",
            "Worker",
            "ACTIVE",
            null,
            Set.of(Role.WORKER),
            Set.of(21L)
        );
        when(users.findWorkerQuickLoginCandidates("WK", "1234")).thenReturn(List.of(account));

        var result = authService.authenticateWorkerQuickLogin("WK", "1234", 21L, "ko", "127.0.0.1");

        assertThat(result).isInstanceOf(AuthService.WorkerQuickLoginSuccess.class);
        var principal = ((AuthService.WorkerQuickLoginSuccess) result).principal();
        assertThat(principal.userId()).isEqualTo(10L);
        assertThat(principal.roles()).containsExactly(Role.WORKER);
        assertThat(principal.siteIds()).containsExactly(21L);
        verify(users).updatePreferredLanguage(10L, "ko");
        verify(audit).record(eq(10L), eq(21L), eq("auth.worker_quick_login"), eq("user"), eq("10"), eq("ALLOWED"), eq("quick_login"), any());
    }

    @Test
    void quickLoginRequiresSiteSelectionForMultipleSites() {
        var account = new UserAccount(
            11L,
            "worker2@example.com",
            "Worker 2",
            "ACTIVE",
            null,
            Set.of(Role.WORKER),
            Set.of(31L, 32L)
        );
        when(users.findWorkerQuickLoginCandidates("W2", "5678")).thenReturn(List.of(account));
        when(users.siteOptionsFor(Set.of(31L, 32L))).thenReturn(List.of(
            new UserAccountRepository.SiteOption(31L, "A Site", null),
            new UserAccountRepository.SiteOption(32L, "B Site", null)
        ));

        var result = authService.authenticateWorkerQuickLogin("W2", "5678", null, "ko", "127.0.0.1");

        assertThat(result).isInstanceOf(AuthService.WorkerQuickLoginMultipleSites.class);
        var sites = ((AuthService.WorkerQuickLoginMultipleSites) result).sites();
        assertThat(sites).extracting(UserAccountRepository.SiteOption::siteId).containsExactly(31L, 32L);
        verify(audit).record(eq(null), eq(null), eq("auth.worker_quick_login"), eq("user"), eq(null), eq("DENIED"), eq("multiple_site_match"), any());
    }

    @Test
    void quickLoginRejectsUnknownWorker() {
        when(users.findWorkerQuickLoginCandidates("NO", "0000")).thenReturn(List.of());

        assertThatThrownBy(() -> authService.authenticateWorkerQuickLogin("NO", "0000", null, "ko", "127.0.0.1"))
            .isInstanceOf(AuthService.WorkerQuickLoginNotFoundException.class)
            .hasMessage("worker_not_found");

        verify(audit).record(eq(null), eq(null), eq("auth.worker_quick_login"), eq("user"), eq(null), eq("DENIED"), eq("worker_not_found"), any());
    }

    @Test
    void directAdminSignupCreatesPendingApprovalRequest() {
        var account = new UserAccount(
            21L,
            "admin@seowonenc.co.kr",
            "Admin",
            "PENDING",
            "$2a$new",
            Set.of(),
            Set.of()
        );
        when(users.findByEmail("admin@seowonenc.co.kr")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password123")).thenReturn("$2a$new");
        when(users.createPendingAdminSignupAccount("admin@seowonenc.co.kr", "Admin", "ko", "$2a$new")).thenReturn(account);

        AuthService.PendingAdminSignup signup = authService.registerDirectAdminSignup(
            "ADMIN@seowonenc.co.kr",
            "password123",
            "Admin",
            "ko",
            "127.0.0.1"
        );

        assertThat(signup.id()).isEqualTo(21L);
        assertThat(signup.accountStatus()).isEqualTo("PENDING");
        assertThat(signup.approvalRequired()).isTrue();
        verify(audit).record(eq(21L), eq(null), eq("auth.admin_signup"), eq("user"), eq("21"), eq("ALLOWED"), eq("pending_approval"), any());
    }

    @Test
    void directAdminSignupRejectsNonSeowonEmailDomain() {
        assertThatThrownBy(() -> authService.registerDirectAdminSignup(
            "admin@example.com",
            "password123",
            "Admin",
            "ko",
            "127.0.0.1"
        ))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("domain_not_allowed");

        verify(audit).record(eq(null), eq(null), eq("auth.admin_signup"), eq("user"), eq("admin@example.com"), eq("DENIED"), eq("domain_not_allowed"), any());
    }

    @Test
    void profileSetupUpdatesOnlySafeProfileFields() {
        var principal = new SessionPrincipal(
            23L,
            "admin@seowonenc.co.kr",
            "Admin",
            Set.of(Role.SITE_ADMIN),
            Set.of()
        );
        var account = new UserAccount(
            23L,
            "admin@seowonenc.co.kr",
            "Site Manager",
            "ACTIVE",
            "$2a$hash",
            Set.of(Role.SITE_ADMIN),
            Set.of()
        );
        when(users.findById(23L)).thenReturn(Optional.of(account));

        SessionPrincipal updated = authService.updateOwnProfile(
            principal,
            "Site Manager",
            "ko",
            java.util.Map.of("requestedSetupRole", "root", "requestedSiteId", "999"),
            "127.0.0.1"
        );

        assertThat(updated.displayName()).isEqualTo("Site Manager");
        assertThat(updated.roles()).containsExactly(Role.SITE_ADMIN);
        assertThat(updated.siteIds()).isEmpty();
        verify(users).updateProfile(23L, "Site Manager", "ko");
        verify(audit).record(eq(23L), eq(null), eq("auth.profile_setup"), eq("user"), eq("23"), eq("ALLOWED"), eq("self_profile_update"), any());
    }

    @Test
    void directAdminSignupRejectsDuplicateEmail() {
        var account = new UserAccount(
            22L,
            "admin@seowonenc.co.kr",
            "Admin",
            "ACTIVE",
            "$2a$hash",
            Set.of(Role.SITE_ADMIN),
            Set.of()
        );
        when(users.findByEmail("admin@seowonenc.co.kr")).thenReturn(Optional.of(account));

        assertThatThrownBy(() -> authService.registerDirectAdminSignup(
            "admin@seowonenc.co.kr",
            "password123",
            "Admin",
            "ko",
            "127.0.0.1"
        ))
            .isInstanceOf(AuthService.UserAlreadyExistsException.class)
            .hasMessage("email_already_registered");

        verify(audit).record(eq(null), eq(null), eq("auth.admin_signup"), eq("user"), eq("admin@seowonenc.co.kr"), eq("DENIED"), eq("email_already_registered"), any());
    }
}
