package com.safelink.v3.auth;

import com.safelink.v3.admin.AdminInvitationController;
import com.safelink.v3.admin.RootBootstrapService;
import com.safelink.v3.audit.AuditService;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PasswordLengthPolicyTest {
    private static final String TEN = "TestPass10";
    private static final String NINE = "TestPass9";

    @Test void signupAcceptsTenAndRejectsNine() {
        var users = mock(UserAccountRepository.class);
        var encoder = mock(PasswordEncoder.class);
        var service = new AuthService(users, encoder, mock(AuditService.class));
        when(users.findByEmail("test@seowonenc.co.kr")).thenReturn(Optional.empty());
        when(encoder.encode(TEN)).thenReturn("hash");
        when(users.createPendingAdminSignupAccount("test@seowonenc.co.kr", "TEST", "ko", "hash"))
            .thenReturn(new UserAccount(1L,"test@seowonenc.co.kr","TEST","PENDING","hash",Set.of(),Set.of()));
        assertThatThrownBy(() -> service.registerDirectAdminSignup("test@seowonenc.co.kr",NINE,"TEST","ko","test"))
            .hasMessage("password_min_length");
        assertThat(service.registerDirectAdminSignup("test@seowonenc.co.kr",TEN,"TEST","ko","test").approvalRequired()).isTrue();
    }

    @Test void invitationAcceptsTenAndRejectsNine() {
        assertThatCode(() -> new AdminInvitationController.AcceptInvitationRequest("token",TEN,"TEST","ko")).doesNotThrowAnyException();
        assertThatThrownBy(() -> new AdminInvitationController.AcceptInvitationRequest("token",NINE,"TEST","ko"))
            .hasMessage("password_min_length");
    }

    @Test void resetAcceptsTenButStillRequiresValidToken() {
        var jdbc = mock(JdbcClient.class, RETURNS_DEEP_STUBS);
        var users = mock(UserAccountRepository.class);
        var service = new PasswordResetService(jdbc,users,mock(PasswordEncoder.class),mock(AuditService.class),mock(PasswordResetNotifier.class));
        assertThatThrownBy(() -> service.confirm("invalid-token",NINE,"test")).hasMessage("password_min_length");
        verifyNoInteractions(jdbc,users);
        assertThatThrownBy(() -> service.confirm("invalid-token",TEN,"test")).hasMessage("password_reset_token_invalid");
        verifyNoInteractions(users);
    }

    @Test void bootstrapAcceptsTenButStillRequiresExplicitTokens() {
        var users = mock(UserAccountRepository.class);
        var encoder = mock(PasswordEncoder.class);
        when(users.findByEmail("test@seowonenc.co.kr")).thenReturn(Optional.empty());
        when(encoder.encode(TEN)).thenReturn("hash");
        when(users.createRootBootstrapAccount("test@seowonenc.co.kr","TEST","ko","hash"))
            .thenReturn(new UserAccount(1L,"test@seowonenc.co.kr","TEST","ACTIVE","hash",Set.of(),Set.of()));
        var service = new RootBootstrapService(users,encoder,mock(AuditService.class));
        assertThatThrownBy(() -> service.bootstrap("test@seowonenc.co.kr",NINE,"TEST","ko","token","token"))
            .hasMessage("root_bootstrap_password_min_length");
        assertThat(service.bootstrap("test@seowonenc.co.kr",TEN,"TEST","ko","token","token").status()).isEqualTo("CREATED");
    }
}
