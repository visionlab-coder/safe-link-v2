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
import com.safelink.v3.auth.UserAccount;
import com.safelink.v3.auth.UserAccountRepository;
import com.safelink.v3.domain.Role;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class RootBootstrapServiceTest {
    private UserAccountRepository users;
    private PasswordEncoder passwordEncoder;
    private AuditService audit;
    private RootBootstrapService service;

    @BeforeEach
    void setUp() {
        users = mock(UserAccountRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        audit = mock(AuditService.class);
        service = new RootBootstrapService(users, passwordEncoder, audit);
    }

    @Test
    void createsRootOnlyWithMatchingBootstrapToken() {
        var account = new UserAccount(
            1L,
            "root@seowonenc.co.kr",
            "System Root",
            "ko",
            "ACTIVE",
            "$2a$root",
            Set.of(Role.ROOT),
            Set.of()
        );
        when(users.hasActiveRole(Role.ROOT)).thenReturn(false);
        when(users.findByEmail("root@seowonenc.co.kr")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("very-strong-password")).thenReturn("$2a$root");
        when(users.createRootBootstrapAccount("root@seowonenc.co.kr", "System Root", "ko", "$2a$root"))
            .thenReturn(account);

        var result = service.bootstrap(
            "ROOT@seowonenc.co.kr",
            "very-strong-password",
            "System Root",
            "ko",
            "bootstrap-token",
            "bootstrap-token"
        );

        assertThat(result.status()).isEqualTo("CREATED");
        assertThat(result.userId()).isEqualTo(1L);
        verify(audit).record(eq(1L), eq(null), eq("root.bootstrap"), eq("user"), eq("1"), eq("ALLOWED"), eq("created"), any());
    }

    @Test
    void skipsWhenActiveRootAlreadyExists() {
        when(users.hasActiveRole(Role.ROOT)).thenReturn(true);

        var result = service.bootstrap(
            "root@seowonenc.co.kr",
            "very-strong-password",
            "System Root",
            "ko",
            "bootstrap-token",
            "bootstrap-token"
        );

        assertThat(result.status()).isEqualTo("SKIPPED");
        assertThat(result.reason()).isEqualTo("root_already_exists");
        verifyNoInteractions(passwordEncoder, audit);
    }

    @Test
    void rejectsMismatchedBootstrapToken() {
        assertThatThrownBy(() -> service.bootstrap(
            "root@seowonenc.co.kr",
            "very-strong-password",
            "System Root",
            "ko",
            "bootstrap-token",
            "other-token"
        ))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("root_bootstrap_token_mismatch");

        verifyNoInteractions(users, passwordEncoder, audit);
    }

    @Test
    void rejectsExistingNonRootEmail() {
        var existing = new UserAccount(
            9L,
            "root@seowonenc.co.kr",
            "Pending",
            "ko",
            "PENDING",
            "$2a$pending",
            Set.of(),
            Set.of()
        );
        when(users.hasActiveRole(Role.ROOT)).thenReturn(false);
        when(users.findByEmail("root@seowonenc.co.kr")).thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.bootstrap(
            "root@seowonenc.co.kr",
            "very-strong-password",
            "System Root",
            "ko",
            "bootstrap-token",
            "bootstrap-token"
        ))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("root_bootstrap_email_already_registered");

        verifyNoInteractions(passwordEncoder, audit);
    }
}
