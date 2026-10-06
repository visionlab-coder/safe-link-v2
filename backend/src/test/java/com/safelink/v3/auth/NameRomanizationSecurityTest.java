package com.safelink.v3.auth;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(NameRomanizationController.class)
@Import(SecurityConfig.class)
class NameRomanizationSecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean AuditService audit;
    @MockitoBean UserAccountRepository users;
    @MockitoBean LoginAttemptRateLimiter limiter;
    @Test void allowsPreSignupSuggestionWithCsrfButNotWithoutIt() throws Exception {
        mvc.perform(post("/api/v1/auth/romanize-name").with(csrf()).contentType("application/json").content("{\"name\":\"홍길동\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.romanized").isString()).andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(post("/api/v1/auth/romanize-name").contentType("application/json").content("{\"name\":\"홍길동\"}"))
            .andExpect(status().isForbidden());
    }
    @Test void rejectsInvalidNameBeforeConversion() throws Exception {
        mvc.perform(post("/api/v1/auth/romanize-name").with(csrf()).contentType("application/json").content("{\"name\":\"<script>\"}"))
            .andExpect(status().isBadRequest());
    }
}
