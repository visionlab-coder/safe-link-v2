package com.safelink.v3.live;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.safelink.v3.ai.*;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import com.safelink.v3.tbm.TbmRepository;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;

class LiveTbmSummaryTest {
    @Test void emptySpeechCannotPublish() {
        assertThatThrownBy(() -> LiveTbmSummaryController.validateTranscript(" \n"))
            .isInstanceOf(IllegalArgumentException.class).hasMessage("tbm_transcript_empty");
    }
    @Test void longSpeechIsRejectedNotTruncated() {
        assertThatThrownBy(() -> LiveTbmSummaryController.validateTranscript("가".repeat(60001)))
            .hasMessage("tbm_transcript_too_long");
        assertThatCode(() -> LiveTbmSummaryController.validateTranscript("가".repeat(60000))).doesNotThrowAnyException();
    }
    @Test void anotherSpeakerCannotFinalize() {
        assertThatThrownBy(() -> LiveTbmSummaryController.validateSession(1L,2L,false))
            .isInstanceOf(AccessDeniedException.class);
    }
    @Test void speakingSessionCannotBeSummarizedYet() {
        assertThatThrownBy(() -> LiveTbmSummaryController.validateSession(1L,1L,true))
            .hasMessage("live_session_not_stopped");
        assertThatCode(() -> LiveTbmSummaryController.validateSession(1L,1L,false)).doesNotThrowAnyException();
    }
    @Test void wrongSiteOrWorkerCannotCallVendor() {
        var jdbc=mock(JdbcClient.class);
        var vendor=mock(AiVendorService.class);
        var audit=mock(AuditService.class);
        var controller=new LiveTbmSummaryController(jdbc,new SiteGuard(audit),mock(TbmRepository.class),vendor,
            mock(AiProperties.class),mock(AiQuotaService.class),mock(AiUsageRepository.class),audit,mock(LiveInterpreterEventBus.class));
        var admin=new SessionPrincipal(1L,"test","test",Set.of(Role.SITE_ADMIN),Set.of(10L));
        var worker=new SessionPrincipal(2L,"test","test",Set.of(Role.WORKER),Set.of(20L));
        assertThatThrownBy(() -> controller.finish(admin,new LiveTbmSummaryController.Request("s",20L)))
            .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.finish(worker,new LiveTbmSummaryController.Request("s",20L)))
            .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(jdbc,vendor);
    }
}
