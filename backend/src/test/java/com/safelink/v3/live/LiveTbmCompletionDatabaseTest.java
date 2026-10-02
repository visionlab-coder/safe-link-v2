package com.safelink.v3.live;

import com.safelink.v3.ai.*;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import com.safelink.v3.tbm.TbmRepository;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@Testcontainers(disabledWithoutDocker=true)
class LiveTbmCompletionDatabaseTest {
    @Container static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");
    JdbcClient jdbc;
    TransactionTemplate tx;
    LiveTbmSummaryController controller;
    TbmRepository repository;
    AiVendorService vendor;
    LiveInterpreterEventBus events;
    SessionPrincipal admin = new SessionPrincipal(10L, null, "Manager", Set.of(Role.SITE_ADMIN), Set.of(2L));
    SessionPrincipal worker = new SessionPrincipal(11L, null, "Worker", Set.of(Role.WORKER), Set.of(2L));
    @BeforeEach void setup() {
        var ds = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        jdbc = JdbcClient.create(ds);
        jdbc.sql("drop schema public cascade").update();
        jdbc.sql("create schema public").update();
        var populator = new ResourceDatabasePopulator();
        for (String file : new String[]{"V001__create_identity_and_site_core.sql", "V002__create_file_objects.sql",
                "V003__create_tbm_core.sql", "V015__create_live_interpreter.sql", "V025__add_tbm_notice_idempotency.sql",
                "V028__create_live_broadcast_sessions.sql", "V031__live_tbm_summaries.sql", "V032__tbm_notice_summary.sql",
                "V035__tbm_live_participation.sql", "V036__tbm_live_drafts.sql"})
            populator.addScript(new ClassPathResource("db/migration/" + file));
        populator.execute(ds);
        jdbc.sql("insert into organizations(id,name) values(1,'Test')").update();
        jdbc.sql("insert into sites(id,organization_id,name) values(2,1,'Site'),(3,1,'Other')").update();
        jdbc.sql("insert into users(id,phone,display_name,account_status) values(10,'01000000010','Manager','ACTIVE'),(11,'01000000011','Worker','ACTIVE'),(12,'01000000012','Other manager','ACTIVE')").update();
        jdbc.sql("insert into user_roles(user_id,role) values(10,'SITE_ADMIN'),(11,'WORKER')").update();
        jdbc.sql("insert into site_memberships(user_id,site_id,role) values(10,2,'SITE_ADMIN'),(11,2,'WORKER')").update();
        jdbc.sql("insert into live_broadcast_sessions(session_id,site_id,started_by,active) values('tbm_test',2,10,false)").update();
        jdbc.sql("insert into live_translation_events(session_id,site_id,created_by,text_ko) values('tbm_test',2,10,'첫 발화')").update();
        var audit = mock(AuditService.class);
        vendor = mock(AiVendorService.class);
        events = mock(LiveInterpreterEventBus.class);
        var props = mock(AiProperties.class);
        when(props.isVendorEnabled()).thenReturn(true);
        var quota = mock(AiQuotaService.class);
        when(quota.checkAndIncrement(any(), any(), any())).thenReturn(new AiQuotaService.QuotaDecision(true,1,100,"test"));
        when(vendor.summarizeTbm(anyString())).thenReturn(new AiVendorService.VendorResult("- 보호구 확인", "test", "test-model"));
        repository = new TbmRepository(jdbc);
        controller = new LiveTbmSummaryController(jdbc,new SiteGuard(audit),repository,vendor,props,quota,
                mock(AiUsageRepository.class),audit,events);
        tx = new TransactionTemplate(new DataSourceTransactionManager(ds));
    }
    LiveTbmSummaryController.Summary finish(String text) {
        return tx.execute(status -> controller.finish(admin,new LiveTbmSummaryController.Request("tbm_test",2L,text)));
    }
    @Test void draftCorrectionsAreVersionedScopedAndImmutableAfterPublication() {
        var drafts = new TbmLiveDraftController(jdbc,new SiteGuard(mock(AuditService.class)),events);
        var first = tx.execute(status -> {
            var saved = drafts.save(admin,new TbmLiveDraftController.Request("tbm_test",2L,"수정된 원문"));
            verifyNoInteractions(events);
            return saved;
        });
        assertEquals(1L,first.revision());
        verify(events).publish("translations:2","tbm-draft",first);
        assertEquals(first,drafts.get(worker,"tbm_test",2L).get("draft"));
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
            () -> drafts.get(worker,"tbm_test",3L));
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
            () -> tx.execute(status -> drafts.save(worker,new TbmLiveDraftController.Request("tbm_test",2L,"조작"))));
        var otherAdmin = new SessionPrincipal(12L,null,"Other",Set.of(Role.SITE_ADMIN),Set.of(2L));
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
            () -> tx.execute(status -> drafts.save(otherAdmin,new TbmLiveDraftController.Request("tbm_test",2L,"조작"))));
        var second = tx.execute(status -> drafts.save(admin,new TbmLiveDraftController.Request("tbm_test",2L,"최종 수정")));
        assertEquals(2L,second.revision());
        assertThrows(IllegalArgumentException.class,() -> finish("수정 전 원문"));
        var published = finish("최종 수정");
        assertEquals("최종 수정",repository.getNotice(Long.valueOf(published.tbmId())).sourceText());
        assertThrows(IllegalArgumentException.class,
            () -> tx.execute(status -> drafts.save(admin,new TbmLiveDraftController.Request("tbm_test",2L,"전파 후 변경"))));
    }
    @Test void publishesFullDrainedDraftAndSummaryOnceAndNotifiesAfterCommit() {
        var result = finish("첫 발화\n마지막 발화와 위험성평가 항목");
        var notice = repository.getNotice(Long.valueOf(result.tbmId()));
        assertEquals("첫 발화\n마지막 발화와 위험성평가 항목",notice.sourceText());
        assertEquals("- 보호구 확인",notice.summaryText());
        assertEquals(10L,notice.createdBy());
        assertEquals(result,finish("retry cannot replace published content"));
        verify(vendor,times(1)).summarizeTbm(anyString());
        verify(events,times(1)).publish("translations:2","tbm-summary",result);
        assertEquals(result,controller.get(worker,"tbm_test",2L).get("summary"));
        assertEquals(0L,jdbc.sql("select count(*) from tbm_acknowledgements").query(Long.class).single());
    }
    @Test void generationFailurePublishesNothingAndRetryRetainsOriginalSession() {
        when(vendor.summarizeTbm(anyString())).thenThrow(new IllegalStateException("vendor_failed"));
        assertThrows(IllegalStateException.class,()->finish("원문"));
        assertEquals(0L,jdbc.sql("select count(*) from tbm_notices").query(Long.class).single());
        assertTrue(controller.get(worker,"tbm_test",2L).isEmpty());
        verifyNoInteractions(events);
        doReturn(new AiVendorService.VendorResult("- 재시도 요약","test","test")).when(vendor).summarizeTbm(anyString());
        assertEquals("- 재시도 요약",finish("원문").text());
    }
    @Test void publicationRollbackDoesNotAnnounceSummary() {
        tx.executeWithoutResult(status -> {
            controller.finish(admin,new LiveTbmSummaryController.Request("tbm_test",2L,"원문"));
            verifyNoInteractions(events);
            status.setRollbackOnly();
        });
        verifyNoInteractions(events);
        assertEquals(0L,jdbc.sql("select count(*) from tbm_notices").query(Long.class).single());
    }
    @Test void ownerActiveAndCrossSiteGuardsRemain() {
        var other = new SessionPrincipal(12L,null,"Other",Set.of(Role.SITE_ADMIN),Set.of(2L));
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> tx.execute(status ->
                controller.finish(other,new LiveTbmSummaryController.Request("tbm_test",2L,"원문"))));
        assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> controller.get(worker,"tbm_test",3L));
        jdbc.sql("update live_broadcast_sessions set active=true").update();
        assertThrows(IllegalArgumentException.class, () -> finish("원문"));
        verifyNoInteractions(vendor,events);
    }
    @Test void emptyDraftCannotFallBackToEarlierSpeech() {
        assertThrows(IllegalArgumentException.class, () -> finish(" "));
        verifyNoInteractions(vendor,events);
    }
    @Test void reviewedSummaryPublishesOnlyOnExplicitRequestAndRetriesAreIdempotent() {
        assertEquals(0L,jdbc.sql("select count(*) from tbm_notices").query(Long.class).single());
        var request = new LiveTbmSummaryController.Request("tbm_test",2L,"수정한 원문","- 관리자가 검토한 요약");
        var result = tx.execute(status -> controller.finish(admin,request));
        assertEquals(result,tx.execute(status -> controller.finish(admin,request)));
        assertEquals("수정한 원문",repository.getNotice(Long.valueOf(result.tbmId())).sourceText());
        assertEquals("- 관리자가 검토한 요약",result.text());
        verifyNoInteractions(vendor);
        verify(events,times(1)).publish("translations:2","tbm-summary",result);
    }
    @Test void participationSurvivesReloadAndOnlyAppliesToTheExactNoticeAndWorker() {
        var participation = new TbmLiveParticipationController(jdbc,new SiteGuard(mock(AuditService.class)));
        var join = new TbmLiveParticipationController.Join("tbm_test",2L);
        jdbc.sql("update live_broadcast_sessions set active=true where session_id='tbm_test'").update();
        tx.execute(status -> participation.join(worker,join));
        tx.execute(status -> participation.join(worker,join));
        assertEquals(1L,jdbc.sql("select count(*) from tbm_live_participation").query(Long.class).single());
        jdbc.sql("update live_broadcast_sessions set active=false where session_id='tbm_test'").update();
        assertEquals("tbm_test",participation.read(worker,2L,null).get("sessionId"));
        assertThrows(IllegalArgumentException.class,() -> tx.execute(status -> participation.join(worker,join)));
        var notice = finish("전체 원문");
        var reloadedController = new TbmLiveParticipationController(jdbc,new SiteGuard(mock(AuditService.class)));
        assertEquals(true,reloadedController.read(worker,2L,Long.valueOf(notice.tbmId())).get("attended"));
        assertEquals(false,reloadedController.read(worker,2L,9999L).get("attended"));
        var lateWorker = new SessionPrincipal(12L,null,"Late worker",Set.of(Role.WORKER),Set.of(2L));
        assertEquals(false,reloadedController.read(lateWorker,2L,Long.valueOf(notice.tbmId())).get("attended"));
        assertThrows(IllegalArgumentException.class,() -> tx.execute(status -> participation.join(lateWorker,join)));
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
            () -> reloadedController.read(worker,3L,Long.valueOf(notice.tbmId())));
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
            () -> tx.execute(status -> participation.join(admin,join)));
    }
}
