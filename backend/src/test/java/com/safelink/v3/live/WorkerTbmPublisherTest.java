package com.safelink.v3.live;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class WorkerTbmPublisherTest {
    private final SessionPrincipal worker = new SessionPrincipal(10L,"worker@example.invalid","WORKER",Set.of(Role.WORKER),Set.of(2L));
    private final JdbcClient jdbc = mock(JdbcClient.class, RETURNS_DEEP_STUBS);
    private final AuditService audit = mock(AuditService.class);
    private final LiveInterpreterController controller = new LiveInterpreterController(jdbc,new ObjectMapper(),new SiteGuard(audit),audit,mock(LiveInterpreterEventBus.class));

    @Test void workerCanStartTbmAtOwnSite() {
        when(jdbc.sql(anyString()).param(anyString(),any()).param(anyString(),any()).query(Boolean.class).single()).thenReturn(false);
        when(jdbc.sql(anyString()).param(anyString(),any()).query(Boolean.class).single()).thenReturn(false);
        var result=controller.startSession(worker,new LiveInterpreterController.BroadcastSessionRequest("tbm_test","2"));
        assertThat(result.active()).isTrue();
    }
    @Test void workerCannotTakeOverSomeoneElsesBroadcast() {
        when(jdbc.sql(anyString()).param(anyString(),any()).param(anyString(),any()).query(Boolean.class).single()).thenReturn(true);
        assertThatThrownBy(()->controller.startSession(worker,new LiveInterpreterController.BroadcastSessionRequest("tbm_test","2")))
            .hasMessage("live_broadcast_already_active");
    }
    @Test void workerCannotStartAtOtherSite() {
        assertThatThrownBy(()->controller.startSession(worker,new LiveInterpreterController.BroadcastSessionRequest("tbm_test","3")))
            .hasMessage("cross_site_denied");
        verifyNoInteractions(jdbc);
    }
    @Test void workerCannotStartUnrelatedLiveBroadcast() {
        assertThatThrownBy(()->controller.startSession(worker,new LiveInterpreterController.BroadcastSessionRequest("live_test","2")))
            .hasMessage("role_denied");
        verifyNoInteractions(jdbc);
    }
    @Test void workerCannotStopAnotherPublishersTbm() {
        when(jdbc.sql(anyString()).param(anyString(),any()).param(anyString(),any()).query(Long.class).optional()).thenReturn(Optional.of(99L));
        assertThatThrownBy(()->controller.stopSession(worker,"tbm_test","2")).hasMessage("live_session_owner_required");
    }
    @Test void workerCannotInsertSpeechIntoAnotherPublishersTbm() {
        when(jdbc.sql(anyString()).param(anyString(),any()).param(anyString(),any()).query(Long.class).optional()).thenReturn(Optional.of(99L));
        assertThatThrownBy(()->controller.createTranslation(worker,new LiveInterpreterController.TranslationRequest("tbm_test","2","안전 확인",Map.of())))
            .hasMessage("live_session_not_active_or_owned");
    }
    @Test void restrictedRolesStillCannotPublish() {
        for (Role role: Set.of(Role.TEMP_WORKER,Role.VIEWER)) {
            var actor=new SessionPrincipal(11L,"test@example.invalid","TEST",Set.of(role),Set.of(2L));
            assertThatThrownBy(()->LiveInterpreterController.requireBroadcastPublisher(actor,"tbm_test")).hasMessage("role_denied");
        }
    }
}
