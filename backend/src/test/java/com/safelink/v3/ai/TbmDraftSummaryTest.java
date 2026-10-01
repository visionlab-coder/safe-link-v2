package com.safelink.v3.ai;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import java.util.Set;
import org.junit.jupiter.api.Test;

class TbmDraftSummaryTest {
    final AiQuotaService quota = mock(AiQuotaService.class);
    final AiVendorService vendor = mock(AiVendorService.class);
    final AiProperties properties = mock(AiProperties.class);
    final AuditService audit = mock(AuditService.class);
    final AiUsageRepository usage = mock(AiUsageRepository.class);
    final AiGatewayController controller = new AiGatewayController(quota, usage, properties,
        new SiteGuard(audit), audit, vendor, mock(AiMediaService.class), mock(AiTranslationCacheService.class));
    final SessionPrincipal admin = new SessionPrincipal(1L, "test", "test", Set.of(Role.SITE_ADMIN), Set.of(10L));

    @Test void wrongSiteDoesNotCallVendor() {
        assertThatThrownBy(() -> controller.summarizeTbm(admin, new AiGatewayController.SummaryRequest(20L, "안전모 착용")))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(vendor, quota);
    }
    @Test void quotaDeniedDoesNotCallVendor() {
        when(properties.isVendorEnabled()).thenReturn(true);
        when(quota.checkAndIncrement("tbm_summary", 10L, 1L)).thenReturn(new AiQuotaService.QuotaDecision(false, 2, 1, "test"));
        assertThatThrownBy(() -> controller.summarizeTbm(admin, new AiGatewayController.SummaryRequest(10L, "안전모 착용")))
            .hasMessage("ai_quota_exceeded");
        verifyNoInteractions(vendor);
    }
    @Test void returnsDraftAndLogsUsageWithoutPublishing() {
        when(properties.isVendorEnabled()).thenReturn(true);
        when(quota.checkAndIncrement("tbm_summary", 10L, 1L)).thenReturn(new AiQuotaService.QuotaDecision(true, 1, 10, "test"));
        when(vendor.summarizeTbm("안전모 착용")).thenReturn(new AiVendorService.VendorResult("안전모를 착용하세요.", "openai", "test-model"));
        assertThat(controller.summarizeTbm(admin, new AiGatewayController.SummaryRequest(10L, "안전모 착용")).text())
            .isEqualTo("안전모를 착용하세요.");
        verify(usage).log(eq(1L), eq(10L), eq("tbm_summary"), eq("openai"), eq("test-model"), anyLong(), anyLong(), anyLong(), anyString());
    }
    @Test void blankAndOversizedDraftsFailValidation() {
        try (var factory = jakarta.validation.Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertThat(validator.validate(new AiGatewayController.SummaryRequest(10L, " "))).isNotEmpty();
            assertThat(validator.validate(new AiGatewayController.SummaryRequest(10L, "가".repeat(60001)))).isNotEmpty();
        }
    }
}
