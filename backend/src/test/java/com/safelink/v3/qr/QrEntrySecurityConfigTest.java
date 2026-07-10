package com.safelink.v3.qr;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.safelink.v3.config.SecurityConfig;
import com.safelink.v3.qr.QrEntryService.QrEntryResponse;
import com.safelink.v3.qr.QrEntryService.SitePayload;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(QrEntryController.class)
@Import(SecurityConfig.class)
class QrEntrySecurityConfigTest {
    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private QrEntryService qrEntryService;

    @Test
    void qrSiteEntryInfoPostDoesNotRequireCsrf() throws Exception {
        when(qrEntryService.info("1")).thenReturn(QrEntryResponse.info(new SitePayload("1", "Site A", null)));

        mockMvc.perform(post("/api/v1/qr/site-entry")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"info\",\"site_id\":\"1\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ok").value(true))
            .andExpect(jsonPath("$.site.id").value("1"));
    }
}
