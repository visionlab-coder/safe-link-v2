package com.safelink.v3.tbm;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import com.safelink.v3.storage.FileObjectRepository;
import com.safelink.v3.storage.ObjectStorageService;
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
        jdbc.sql("update tbm_notices set created_at='2020-01-01',published_at='2020-01-01' where id=:id").param("id", otherSigned.id()).update();
        var result = controller.pending(worker, 2L, null, 50);
        assertThat(result.tbms()).extracting(TbmController.CompatNoticeResponse::id).containsExactly(otherSigned.id().toString());
        assertThat(result.tbms().getFirst().tradeTypes()).containsExactly("철근", "정리");
        assertThat(result.hasMore()).isFalse();
        assertThat(result.nextCursor()).isNull();
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
