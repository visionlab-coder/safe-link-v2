package com.safelink.v3.ai;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class NationwideTbmAiTest {
    AiQuotaService quota=mock(AiQuotaService.class);
    AiVendorService vendor=mock(AiVendorService.class);
    AiMediaService media=mock(AiMediaService.class);
    AiProperties properties=mock(AiProperties.class);
    AuditService audit=mock(AuditService.class);
    AiGatewayController controller=new AiGatewayController(quota,mock(AiUsageRepository.class),properties,new SiteGuard(audit),audit,vendor,media,mock(AiTranslationCacheService.class));
    SessionPrincipal actor(Role role) { return new SessionPrincipal(10L,null,"HQ",Set.of(role),Set.of()); }
    @Test void nationwideSummaryRequiresExplicitGlobalScopeAndUsesUserQuotaOnce() {
        when(properties.isVendorEnabled()).thenReturn(true);
        when(quota.checkAndIncrement("tbm_summary",null,10L)).thenReturn(new AiQuotaService.QuotaDecision(true,1,100,"user"));
        when(vendor.summarizeTbm("원문")).thenReturn(new AiVendorService.VendorResult("- 요약","mock","test"));
        var result=controller.summarizeTbm(actor(Role.HQ_ADMIN),new AiGatewayController.SummaryRequest(null,"원문",true));
        assertEquals("- 요약",result.text());
        verify(quota,times(1)).checkAndIncrement("tbm_summary",null,10L);
        assertThrows(AccessDeniedException.class,()->controller.summarizeTbm(actor(Role.SITE_ADMIN),new AiGatewayController.SummaryRequest(null,"원문",true)));
        assertThrows(AccessDeniedException.class,()->controller.summarizeTbm(actor(Role.HQ_ADMIN),new AiGatewayController.SummaryRequest(null,"원문",false)));
        assertThrows(IllegalArgumentException.class,()->controller.summarizeTbm(actor(Role.HQ_ADMIN),new AiGatewayController.SummaryRequest(2L,"원문",true)));
    }
    @Test void nationwideSttCannotBypassRoleOrUserQuota() {
        var request=new AiGatewayController.SttRequest(null,"YWJj","audio/webm","ko",48000,true,null,null,null,true);
        for (Role role:new Role[]{Role.WORKER,Role.SITE_ADMIN,Role.SAFETY_MANAGER,Role.VIEWER,Role.TEMP_WORKER})
            assertThrows(AccessDeniedException.class,()->controller.stt(actor(role),request));
        when(properties.isVendorEnabled()).thenReturn(true);
        when(quota.checkAndIncrement("stt",null,10L)).thenReturn(new AiQuotaService.QuotaDecision(false,101,100,"user"));
        assertEquals("ai_quota_exceeded",assertThrows(AccessDeniedException.class,()->controller.stt(actor(Role.HQ_ADMIN),request)).getMessage());
        verifyNoInteractions(media);
        assertThrows(AccessDeniedException.class,()->controller.stt(actor(Role.HQ_ADMIN),new AiGatewayController.SttRequest(null,"YWJj","audio/webm","ko",48000,true,null,null,null,false)));
    }
}
