package com.safelink.v3.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "server.servlet.session.cookie.secure=true")
class AuthSecurityConfigTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private AuditService auditService;

    @MockitoBean
    private LoginAttemptRateLimiter loginAttemptRateLimiter;

    @Test
    void csrfCookieUsesSecureFlagWhenSessionCookieSecure() throws Exception {
        var result = mockMvc.perform(get("/api/v1/auth/csrf"))
            .andExpect(status().isOk())
            .andReturn();

        var cookie = result.getResponse().getCookie("XSRF-TOKEN");
        assertThat(cookie).isNotNull();
        assertThat(cookie.getSecure()).isTrue();
    }

    @Test
    void adminSignupPostDoesNotRequireCsrf() throws Exception {
        var signup = new AuthService.PendingAdminSignup(
            77L,
            "csrf-admin@seowonenc.co.kr",
            "CSRF Admin",
            "ko",
            "PENDING",
            true
        );
        when(authService.registerDirectAdminSignup(
            eq("csrf-admin@seowonenc.co.kr"),
            eq("password1234"),
            eq(""),
            eq("ko"),
            any()
        )).thenReturn(signup);

        mockMvc.perform(post("/api/v1/auth/admin-signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"csrf-admin@seowonenc.co.kr\",\"password\":\"password1234\",\"preferred_lang\":\"ko\"}"))
            .andExpect(status().isAccepted())
            .andExpect(jsonPath("$.id").value(77))
            .andExpect(jsonPath("$.accountStatus").value("PENDING"))
            .andExpect(jsonPath("$.approvalRequired").value(true));
    }
}
