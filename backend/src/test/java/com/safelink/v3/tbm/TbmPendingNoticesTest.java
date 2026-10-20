package com.safelink.v3.tbm;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import com.safelink.v3.storage.FileObjectRepository;
import com.safelink.v3.storage.ObjectStorageService;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.security.access.AccessDeniedException;
import org.testcontainers.containers.PostgreSQLContainer;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Disposable container only: no production or developer database credentials. */
class TbmPendingNoticesTest {
    static final PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");
    JdbcClient jdbc;
    TbmRepository repository;
    TbmController controller;
    SessionPrincipal worker = new SessionPrincipal(11L, null, "TEST", Set.of(Role.WORKER), Set.of(2L));
    @BeforeAll static void start() { postgres.start(); }
    @AfterAll static void stop() { postgres.stop(); }
    @BeforeEach void setup() {
        var ds = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
        jdbc = JdbcClient.create(ds);
        jdbc.sql("drop schema public cascade").update();
        jdbc.sql("create schema public").update();
        // V042 also alters live_broadcast_sessions. The table only needs its identifier for this test.
        var base = new ResourceDatabasePopulator();
        for (String file : List.of("V001__create_identity_and_site_core.sql", "V002__create_file_objects.sql",
            "V003__create_tbm_core.sql", "V025__add_tbm_notice_idempotency.sql", "V032__tbm_notice_summary.sql"))
            base.addScript(new ClassPathResource("db/migration/" + file));
        base.execute(ds);
        jdbc.sql("create table live_broadcast_sessions(session_id text primary key)").update();
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V042__tbm_trade_types.sql")).execute(ds);
        new ResourceDatabasePopulator(new ClassPathResource("db/migration/V043__tbm_home_notification_visibility.sql")).execute(ds);
        jdbc.sql("insert into organizations(id,name) values(1,'TEST')").update();
        jdbc.sql("insert into sites(id,organization_id,name,status) values(2,1,'A','ACTIVE'),(3,1,'B','ACTIVE')").update();
        jdbc.sql("insert into users(id,email,display_name,account_status) values(10,'admin@example.invalid','Admin','ACTIVE'),(11,'worker@example.invalid','Worker','ACTIVE'),(12,'other@example.invalid','Other','ACTIVE')").update();
        repository = new TbmRepository(jdbc);
        var audit = mock(AuditService.class);
        controller = new TbmController(repository, mock(FileObjectRepository.class), mock(ObjectStorageService.class), new SiteGuard(audit), audit);
    }

    TbmRepository.NoticeRow notice(long site) {
        return repository.createPublished(site, 10L, "TEST", "TEXT", null, "SUMMARY", List.of("철근", "정리"));
    }

    @Test void excludesOnlyOwnSignedNoticesAndOtherSitesAndUnpublished() {
        var signed = notice(2);
        var otherSigned = notice(2);
        var draft = notice(2);
        var archived = notice(2);
        notice(3);
        repository.acknowledge(signed.id(), 11L, 2L, null);
        repository.acknowledge(otherSigned.id(), 12L, 2L, null);
        jdbc.sql("update tbm_notices set status='DRAFT' where id=:id").param("id", draft.id()).update();
        jdbc.sql("update tbm_notices set status='ARCHIVED' where id=:id").param("id", archived.id()).update();
        var result = controller.pending(worker, 2L, null, 50);
        assertThat(result.tbms()).extracting(TbmController.CompatNoticeResponse::id).containsExactly(otherSigned.id().toString());
        assertThat(result.tbms().getFirst().tradeTypes()).containsExactly("철근", "정리");
        assertThat(result.hasMore()).isFalse();
        assertThat(result.nextCursor()).isNull();
    }

    @Test void onlyTodaysPublicationsAppearWithoutDeletingHistory() {
        var old = notice(2);
        var today = notice(2);
        jdbc.sql("update tbm_notices set created_at='2020-01-01',published_at='2020-01-01' where id=:id")
            .param("id", old.id()).update();
        assertThat(controller.pending(worker, 2L, null, 50).tbms())
            .extracting(TbmController.CompatNoticeResponse::id).containsExactly(today.id().toString());
        var admin = new SessionPrincipal(10L, null, "Admin", Set.of(Role.SITE_ADMIN), Set.of(2L));
        assertThat(controller.notices(admin, "2", null, 10).tbms())
            .extracting(TbmController.CompatNoticeResponse::id).containsExactly(today.id().toString(), old.id().toString());
        assertThat(controller.today(worker, old.id().toString(), 1).tbms()).hasSize(1);
        assertThat(jdbc.sql("select count(*) from tbm_notices").query(Long.class).single()).isEqualTo(2L);
    }

    @Test void koreanMidnightIsInclusiveAndNextMidnightExclusiveUsingPublicationTime() {
        var day = LocalDate.now(ZoneId.of("Asia/Seoul"));
        var start = day.atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant();
        var end = day.plusDays(1).atStartOfDay(ZoneId.of("Asia/Seoul")).toInstant();
        var yesterday = notice(2);
        var midnight = notice(2);
        var lastMoment = notice(2);
        var tomorrow = notice(2);
        var legacy = notice(2);
        for (var entry : java.util.Map.of(yesterday.id(), start.minusMillis(1), midnight.id(), start,
            lastMoment.id(), end.minusMillis(1), tomorrow.id(), end).entrySet()) {
            jdbc.sql("update tbm_notices set created_at='2020-01-01',published_at=:time where id=:id")
                .param("time", Timestamp.from(entry.getValue())).param("id", entry.getKey()).update();
        }
        jdbc.sql("update tbm_notices set published_at=null,created_at=:time where id=:id")
            .param("time", Timestamp.from(start)).param("id", legacy.id()).update();
        assertThat(controller.pending(worker, 2L, null, 50).tbms())
            .extracting(TbmController.CompatNoticeResponse::id)
            .containsExactly(legacy.id().toString(), lastMoment.id().toString(), midnight.id().toString());
    }

    @Test void paginationIncludesMoreThanTwentyWithoutDuplicates() {
        for (int i = 0; i < 27; i++) notice(2);
        var first = controller.pending(worker, 2L, null, 20);
        var second = controller.pending(worker, 2L, Long.valueOf(first.nextCursor()), 20);
        assertThat(first.tbms()).hasSize(20);
        assertThat(first.hasMore()).isTrue();
        assertThat(second.tbms()).hasSize(7);
        assertThat(second.hasMore()).isFalse();
        assertThat(first.tbms()).doesNotContainAnyElementsOf(second.tbms());
        // A new insertion while paging is picked up on the next refresh, not duplicated in page 2.
        notice(2);
        assertThat(controller.pending(worker, 2L, Long.valueOf(first.nextCursor()), 20).tbms()).isEqualTo(second.tbms());
    }

    @Test void hiddenNotificationsPreserveContentSignaturesHistoryAndNewPublications() {
        var hidden = notice(2);
        var signed = notice(2);
        repository.acknowledge(signed.id(), 11L, 2L, null);
        jdbc.sql("update tbm_notices set home_notification_hidden_at=now()").update();
        var fresh = notice(2);
        assertThat(controller.pending(worker, 2L, null, 50).tbms())
            .extracting(TbmController.CompatNoticeResponse::id).containsExactly(fresh.id().toString());
        assertThat(repository.getNotice(hidden.id())).isEqualTo(hidden);
        assertThat(repository.getNotice(signed.id())).isEqualTo(signed);
        assertThat(repository.findAck(signed.id(), 11L)).isPresent();
        assertThat(repository.listRecent(true, Set.of(), null, 10)).hasSize(3);
        assertThat(controller.today(worker, hidden.id().toString(), 1).tbms()).hasSize(1);
        // Reversible: restoring visibility does not create a signature or republish the TBM.
        jdbc.sql("update tbm_notices set home_notification_hidden_at=null where id=:id")
            .param("id", hidden.id()).update();
        assertThat(controller.pending(worker, 2L, null, 50).tbms())
            .extracting(TbmController.CompatNoticeResponse::id)
            .containsExactly(fresh.id().toString(), hidden.id().toString());
    }

    @Test void unauthorizedAndCrossSiteAccessDenied() {
        assertThatThrownBy(() -> controller.pending(worker, 3L, null, 50)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.pending(null, 2L, null, 50)).isInstanceOf(AccessDeniedException.class);
        var temporary = new SessionPrincipal(12L, null, "TEMP", Set.of(Role.TEMP_WORKER), Set.of(2L));
        assertThatThrownBy(() -> controller.pending(temporary, 2L, null, 50)).isInstanceOf(AccessDeniedException.class);
    }

    @Test void zeroLimitStillReturnsOneAndEmptyResultIsValid() {
        assertThat(controller.pending(worker, 2L, null, 50).tbms()).isEmpty();
        notice(2); notice(2);
        assertThat(controller.pending(worker, 2L, null, 0).tbms()).hasSize(1);
    }
}
