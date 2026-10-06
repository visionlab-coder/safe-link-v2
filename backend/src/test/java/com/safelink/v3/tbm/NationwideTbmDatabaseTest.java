package com.safelink.v3.tbm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.live.*;
import com.safelink.v3.security.SiteGuard;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class NationwideTbmDatabaseTest {
    static PostgreSQLContainer<?> postgres;
    static DriverManagerDataSource dataSource;
    @BeforeAll static void database() {
        // Explicit fallback only for a disposable loopback database, never the sandbox or production database.
        if ("1".equals(System.getenv("SQ_NATIONWIDE_TEST_DB"))) {
            dataSource=new DriverManagerDataSource("jdbc:postgresql://127.0.0.1:55439/sq_nationwide_test","sq_enrollment","local-fixture-only");
        } else {
            postgres=new PostgreSQLContainer<>("postgres:16-alpine"); postgres.start();
            dataSource=new DriverManagerDataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword());
        }
    }
    @AfterAll static void close() { if (postgres!=null) postgres.stop(); }
    JdbcClient jdbc; TransactionTemplate tx; NationwideTbmController national;
    LiveInterpreterController live; TbmLiveDraftController drafts; TbmRepository tbm;
    SiteGuard guard; LiveInterpreterEventBus events;
    SessionPrincipal hq = new SessionPrincipal(10L,null,"HQ",Set.of(Role.HQ_ADMIN),Set.of());
    SessionPrincipal otherHq = new SessionPrincipal(12L,null,"Other HQ",Set.of(Role.HQ_ADMIN),Set.of());
    SessionPrincipal worker = new SessionPrincipal(11L,null,"Worker",Set.of(Role.WORKER),Set.of(2L));
    @BeforeEach void setup() {
        var ds=dataSource;
        jdbc=JdbcClient.create(ds);
        jdbc.sql("drop schema public cascade").update(); jdbc.sql("create schema public").update();
        var scripts=new ResourceDatabasePopulator();
        for (String file : new String[]{"V001__create_identity_and_site_core.sql","V002__create_file_objects.sql",
            "V003__create_tbm_core.sql","V015__create_live_interpreter.sql","V025__add_tbm_notice_idempotency.sql",
            "V028__create_live_broadcast_sessions.sql","V031__live_tbm_summaries.sql","V032__tbm_notice_summary.sql",
            "V035__tbm_live_participation.sql","V036__tbm_live_drafts.sql","V037__nationwide_tbm.sql"})
            scripts.addScript(new ClassPathResource("db/migration/"+file));
        scripts.execute(ds);
        jdbc.sql("insert into organizations(id,name) values(1,'Local test')").update();
        jdbc.sql("insert into sites(id,organization_id,name,status) values(2,1,'A','ACTIVE'),(3,1,'B','ACTIVE'),(4,1,'Archived','ARCHIVED')").update();
        jdbc.sql("insert into users(id,email,display_name,account_status) values(10,'hq@example.invalid','HQ','ACTIVE'),(11,'worker@example.invalid','Worker','ACTIVE'),(12,'other@example.invalid','Other','ACTIVE')").update();
        var audit=mock(AuditService.class); guard=new SiteGuard(audit); events=mock(LiveInterpreterEventBus.class);
        live=new LiveInterpreterController(jdbc,new ObjectMapper(),guard,audit,events);
        drafts=new TbmLiveDraftController(jdbc,guard,events); tbm=new TbmRepository(jdbc);
        national=new NationwideTbmController(jdbc,live,drafts,tbm,events,audit);
        tx=new TransactionTemplate(new DataSourceTransactionManager(ds));
    }
    NationwideTbmController.Request req(String id) { return new NationwideTbmController.Request(id,true,"발화","수정한 원문","수정한 원문","- 보호구 확인"); }
    void start() { tx.executeWithoutResult(s->national.start(hq,req("tbm_nation"))); }
    long count(String table) { return jdbc.sql("select count(*) from "+table).query(Long.class).single(); }

    @Test void questionsOnlyReachNationwideSenderForWorkersOwnTargetSite() {
        var chat=new com.safelink.v3.chat.ChatRepository(jdbc);
        jdbc.sql("insert into user_roles(user_id,role) values(10,'HQ_ADMIN'),(12,'HQ_ADMIN')").update();
        assertNull(chat.nationwideTbmSenderSite(10L,Set.of(2L)));
        assertTrue(chat.listAdminsForWorker(Set.of(2L)).isEmpty());
        start();
        assertEquals(2L,chat.nationwideTbmSenderSite(10L,Set.of(2L)));
        assertEquals(10L,chat.listAdminsForWorker(Set.of(2L)).getFirst().id());
        assertNull(chat.nationwideTbmSenderSite(12L,Set.of(2L)));
        assertNull(chat.nationwideTbmSenderSite(10L,Set.of(4L)));
        assertTrue(chat.listAdminsForWorker(Set.of(4L)).isEmpty());
        jdbc.sql("update user_roles set revoked_at=now() where user_id=10").update();
        assertNull(chat.nationwideTbmSenderSite(10L,Set.of(2L)));
        assertTrue(chat.listAdminsForWorker(Set.of(2L)).isEmpty());
    }

    @Test void hqWithoutMembershipFansOutThroughExistingWorkerPathsAndSignsSeparately() {
        assertEquals(2,national.targets(hq).get("targetCount")); start();
        assertEquals(2L,count("live_broadcast_sessions")); assertEquals(0L,count("site_memberships"));
        var a=(LiveInterpreterController.BroadcastSessionEvent)live.currentSession(worker,"2").get("session");
        assertEquals("tbm_nation_s2",a.sessionId());
        assertThrows(AccessDeniedException.class,()->live.currentSession(worker,"3"));
        var participation=new TbmLiveParticipationController(jdbc,guard);
        tx.executeWithoutResult(s->participation.join(worker,new TbmLiveParticipationController.Join(a.sessionId(),2L)));
        tx.executeWithoutResult(s->national.translate(hq,req("tbm_nation")));
        assertEquals(1,live.translations(worker,"0","2",a.sessionId()).get("translations").size());
        tx.executeWithoutResult(s->national.draft(hq,req("tbm_nation")));
        assertEquals("수정한 원문",((TbmLiveDraftController.Draft)drafts.get(worker,a.sessionId(),2L).get("draft")).content());
        tx.executeWithoutResult(s->national.stop(hq,req("tbm_nation")));
        assertEquals(false,live.currentSession(worker,"2").get("active"));
        var result=tx.execute(s->national.finish(hq,req("tbm_nation")));
        assertEquals(2,result.targetCount()); assertEquals(2L,count("tbm_notices"));
        assertEquals("수정한 원문",tbm.getNotice(Long.valueOf(result.tbmId())).sourceText());
        assertEquals(true,participation.read(worker,2L,Long.valueOf(result.tbmId())).get("attended"));
        assertEquals(false,participation.read(new SessionPrincipal(12L,null,"Late",Set.of(Role.WORKER),Set.of(2L)),2L,Long.valueOf(result.tbmId())).get("attended"));
        assertEquals(0L,count("tbm_acknowledgements")); // Participation is not a signature.
        var notices=tbm.listLatest(false,Set.of(2L),10);
        assertEquals(1,notices.size()); assertEquals(2L,notices.getFirst().siteId());
        verify(events).publishAfterCommit(eq("translations:3"),eq("tbm-summary"),any(LiveTbmSummaryController.Summary.class));
    }
    @Test void onlyHqAndRootCanTargetNationwideAndOnlyOwnerCanChangeBroadcast() {
        for (Role role:Role.values()) {
            var actor=new SessionPrincipal(10L,null,"Test",Set.of(role),Set.of());
            if (role==Role.HQ_ADMIN || role==Role.ROOT) assertEquals(2,national.targets(actor).get("targetCount"));
            else assertThrows(AccessDeniedException.class,()->national.targets(actor));
        }
        assertThrows(AccessDeniedException.class,()->national.targets(null));
        assertThrows(IllegalArgumentException.class,()->tx.execute(s->national.start(hq,new NationwideTbmController.Request("tbm_no",false,null,null,null,null))));
        start();
        assertThrows(AccessDeniedException.class,()->tx.execute(s->national.stop(otherHq,req("tbm_nation"))));
        var siteAdmin=new SessionPrincipal(12L,null,"Site",Set.of(Role.SITE_ADMIN),Set.of(2L));
        assertThrows(AccessDeniedException.class,()->tx.execute(s->national.broadcast(siteAdmin,req("tbm_forged"))));
        assertThrows(AccessDeniedException.class,()->tx.execute(s->live.stopSession(siteAdmin,"tbm_nation_s2","2")));
    }
    @Test void existingBroadcastsAreNeverSilentlyReplacedInEitherDirection() {
        tx.executeWithoutResult(s->live.startSession(hq,new LiveInterpreterController.BroadcastSessionRequest("tbm_local","2")));
        assertThrows(IllegalArgumentException.class,this::start);
        assertEquals(0L,count("nationwide_tbm_broadcasts"));
        assertEquals("tbm_local",((LiveInterpreterController.BroadcastSessionEvent)live.currentSession(worker,"2").get("session")).sessionId());
        tx.executeWithoutResult(s->live.stopSession(hq,"tbm_local","2")); start();
        assertThrows(IllegalArgumentException.class,()->tx.execute(s->live.startSession(hq,new LiveInterpreterController.BroadcastSessionRequest("tbm_local2","2"))));
    }
    @Test void startStopAndFinalPublicationAreIdempotentAndSnapshotSites() {
        start(); start(); assertEquals(2L,count("live_broadcast_sessions"));
        jdbc.sql("insert into sites(id,organization_id,name) values(5,1,'Added later')").update();
        assertThrows(IllegalArgumentException.class,()->tx.execute(s->national.finish(hq,req("tbm_nation"))));
        tx.executeWithoutResult(s->national.stop(hq,req("tbm_nation")));
        tx.executeWithoutResult(s->national.stop(hq,req("tbm_nation")));
        var first=tx.execute(s->national.finish(hq,req("tbm_nation")));
        assertEquals(first,tx.execute(s->national.finish(hq,req("tbm_nation"))));
        assertEquals(2L,count("tbm_notices"));
        assertThrows(IllegalArgumentException.class,()->tx.execute(s->national.draft(hq,req("tbm_nation"))));
    }
    @Test void normalNationwideNoticeHasNoLiveAttendanceAndRetriesDoNotDuplicate() {
        var result=tx.execute(s->national.broadcast(hq,req("tbm_notice")));
        assertEquals(2,result.targetCount()); assertEquals(0L,count("live_broadcast_sessions"));
        assertEquals(0L,count("tbm_live_participation"));
        assertEquals(result,tx.execute(s->national.broadcast(hq,req("tbm_notice"))));
        assertEquals(2L,count("tbm_notices"));
        assertThrows(AccessDeniedException.class,()->tx.execute(s->national.broadcast(otherHq,req("tbm_notice"))));
    }
    @Test void failedPublicationAndTransactionRollbackLeaveNoPartialNotices() {
        start(); tx.executeWithoutResult(s->national.draft(hq,req("tbm_nation")));
        tx.executeWithoutResult(s->national.stop(hq,req("tbm_nation")));
        // Fail on the second target after the first insert, proving transaction atomicity.
        jdbc.sql("update tbm_live_drafts set content_ko='other revision' where site_id=3").update();
        assertThrows(IllegalArgumentException.class,()->tx.execute(s->national.finish(hq,req("tbm_nation"))));
        assertEquals(0L,count("tbm_notices")); assertEquals(0L,count("live_tbm_summaries"));
        tx.executeWithoutResult(s->{national.broadcast(hq,req("tbm_rollback"));s.setRollbackOnly();});
        assertEquals(0L,count("tbm_notices"));
    }
}
