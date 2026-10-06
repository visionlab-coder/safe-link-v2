package com.safelink.v3.tbm;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.UserAccount;
import com.safelink.v3.auth.UserAccountRepository;
import com.safelink.v3.config.SecurityConfig;
import com.safelink.v3.domain.Role;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TbmLibraryController.class)
@Import(SecurityConfig.class)
class TbmLibrarySecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean AuditService audit;
    @MockitoBean UserAccountRepository users;
    @Test void sessionRequiredAndOnlyTbmAdministratorsCanReadReference() throws Exception {
        mvc.perform(get("/api/v1/tbm/library")).andExpect(status().isForbidden());
        var allowed = Set.of(Role.ROOT, Role.HQ_ADMIN, Role.SITE_ADMIN, Role.SAFETY_MANAGER);
        for (Role role : Role.values()) {
            var account = new UserAccount(2L,"local@example.invalid","LOCAL","ACTIVE",null,Set.of(role),Set.of(1L));
            when(users.findById(2L)).thenReturn(Optional.of(account));
            var response = mvc.perform(get("/api/v1/tbm/library").with(user(account.toPrincipal())));
            if (allowed.contains(role)) response.andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.sources.length()").value(2))
                .andExpect(jsonPath("$.data.length()").value(456))
                .andExpect(jsonPath("$.data[0].category").value("철근작업"))
                .andExpect(jsonPath("$.data[0].hazard_description").isNotEmpty())
                .andExpect(jsonPath("$.data[0].preventive_measure").isNotEmpty());
            else response.andExpect(status().isForbidden());
        }
    }
}
