package com.safelink.v3.ai;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class TbmSpeechDraftTest {
    final AiQuotaService quota = mock(AiQuotaService.class);
    final AiVendorService vendor = mock(AiVendorService.class);
    final SiteGuard guard = mock(SiteGuard.class);
    final AiProperties properties = new AiProperties();
    final AiGatewayController controller = new AiGatewayController(quota, mock(AiUsageRepository.class), properties,
        guard, mock(AuditService.class), vendor, mock(AiMediaService.class), mock(AiTranslationCacheService.class));
    final SessionPrincipal siteAdmin = new SessionPrincipal(1L,"fixture@example.invalid","Fixture",Set.of(Role.SITE_ADMIN),Set.of(160L));

    @BeforeEach void setUp() {
        properties.setVendorEnabled(true);
        when(quota.checkAndIncrement(anyString(), nullable(Long.class), anyLong())).thenReturn(new AiQuotaService.QuotaDecision(true,1,60,"fixture"));
        when(vendor.translateTbmSpeech("Hello","en")).thenReturn(new AiVendorService.VendorResult("안녕하세요","fixture","fixture"));
    }
    @Test void translatesEnglishWithPublisherAndSiteChecks() {
        var result=controller.tbmSpeechDraft(siteAdmin,new AiGatewayController.SpeechDraftRequest(160L,"Hello","en",false));
        assertEquals("안녕하세요",result.text());
        verify(guard).requireSiteAccess(eq(siteAdmin),eq(160L),anyString(),anyString(),anyString());
        verify(guard).requireTbmPublisher(eq(siteAdmin),eq(160L),anyString(),anyString(),anyString());
        verify(vendor).translateTbmSpeech("Hello","en");
    }
    @Test void hqNationwideUsesUserQuotaWithoutInventingSite() {
        var hq=new SessionPrincipal(2L,"hq@example.invalid","HQ",Set.of(Role.HQ_ADMIN),Set.of());
        controller.tbmSpeechDraft(hq,new AiGatewayController.SpeechDraftRequest(null,"Hello","en",true));
        verify(quota).checkAndIncrement("translate",null,2L);
        verifyNoInteractions(guard);
    }
    @Test void siteAdminCannotRequestNationwide() {
        assertThrows(AccessDeniedException.class,()->controller.tbmSpeechDraft(siteAdmin,new AiGatewayController.SpeechDraftRequest(null,"Hello","en",true)));
        verifyNoInteractions(vendor);
    }
    @Test void unauthenticatedAndCrossSiteAreBlockedBeforeVendor() {
        assertThrows(AccessDeniedException.class,()->controller.tbmSpeechDraft(null,new AiGatewayController.SpeechDraftRequest(160L,"Hello","en",false)));
        doThrow(new AccessDeniedException("site_denied")).when(guard).requireSiteAccess(eq(siteAdmin),eq(157L),anyString(),anyString(),anyString());
        assertThrows(AccessDeniedException.class,()->controller.tbmSpeechDraft(siteAdmin,new AiGatewayController.SpeechDraftRequest(157L,"Hello","en",false)));
        verifyNoInteractions(vendor);
    }
    @Test void quotaFailsClosed() {
        when(quota.checkAndIncrement(anyString(),nullable(Long.class),anyLong())).thenReturn(new AiQuotaService.QuotaDecision(false,61,60,"fixture"));
        assertThrows(AccessDeniedException.class,()->controller.tbmSpeechDraft(siteAdmin,new AiGatewayController.SpeechDraftRequest(160L,"Hello","en",false)));
        verifyNoInteractions(vendor);
    }
    @Test void emptyTranslationDoesNotBecomeKoreanDraft() {
        when(vendor.translateTbmSpeech("Hello","en")).thenReturn(new AiVendorService.VendorResult("","fixture","fixture"));
        assertThrows(com.safelink.v3.support.ServiceUnavailableException.class,()->controller.tbmSpeechDraft(siteAdmin,new AiGatewayController.SpeechDraftRequest(160L,"Hello","en",false)));
    }
    @Test void workerCanTranslatePublisherDraftAtOwnSite() {
        var worker=new SessionPrincipal(3L,"worker@example.invalid","Worker",Set.of(Role.WORKER),Set.of(160L));
        assertEquals("안녕하세요",controller.tbmSpeechDraft(worker,new AiGatewayController.SpeechDraftRequest(160L,"Hello","en",false)).text());
        verify(guard).requireTbmPublisher(eq(worker),eq(160L),anyString(),anyString(),anyString());
        verify(vendor).translateTbmSpeech("Hello","en");
    }
}
