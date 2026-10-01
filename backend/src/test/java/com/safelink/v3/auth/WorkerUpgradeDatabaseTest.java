package com.safelink.v3.auth;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

@Testcontainers(disabledWithoutDocker=true)
class WorkerUpgradeDatabaseTest {
    @Container static PostgreSQLContainer<?> postgres=new PostgreSQLContainer<>("postgres:16-alpine");
    JdbcClient jdbc;
    WorkerUpgradeService service;
    TransactionTemplate tx;
    SessionPrincipal temp=new SessionPrincipal(11L,null,"Kim",Set.of(Role.TEMP_WORKER),Set.of(2L));
    SessionPrincipal manager=new SessionPrincipal(20L,null,"Manager",Set.of(Role.SITE_ADMIN),Set.of(3L));
    @BeforeEach void setup() {
        var ds=new DriverManagerDataSource(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword());
        jdbc=JdbcClient.create(ds);
        jdbc.sql("drop schema public cascade").update();
        jdbc.sql("create schema public").update();
        new ResourceDatabasePopulator(
            new ClassPathResource("db/migration/V001__create_identity_and_site_core.sql"),
            new ClassPathResource("db/migration/V007__create_worker_quick_login_credentials.sql"),
            new ClassPathResource("db/migration/V033__temporary_worker.sql"),
            new ClassPathResource("db/migration/V034__worker_upgrade_requests.sql")
        ).execute(ds);
        jdbc.sql("insert into organizations(id,name) values(1,'Test')").update();
        jdbc.sql("insert into sites(id,organization_id,name) values(2,1,'Training'),(3,1,'Contract site')").update();
        jdbc.sql("insert into users(id,phone,display_name,account_status) values(11,'01012345678','Kim','ACTIVE'),(20,'01087654321','Manager','ACTIVE')").update();
        jdbc.sql("insert into user_roles(user_id,role) values(11,'TEMP_WORKER'),(20,'SITE_ADMIN')").update();
        jdbc.sql("insert into site_memberships(user_id,site_id,role) values(11,2,'TEMP_WORKER'),(20,3,'SITE_ADMIN')").update();
        var audit=mock(AuditService.class);
        service=new WorkerUpgradeService(jdbc,new SiteGuard(audit),audit);
        tx=new TransactionTemplate(new DataSourceTransactionManager(ds));
    }
    long submit() {
        tx.execute(status->service.submit(temp,new WorkerUpgradeService.Application("Kim","01012345678",3L,"00123",true,WorkerUpgradeService.CONSENT_VERSION)));
        return jdbc.sql("select id from worker_upgrade_requests").query(Long.class).single();
    }
    String role() {return jdbc.sql("select role from user_roles where user_id=11 and revoked_at is null").query(String.class).single();}
    @Test void pendingDoesNotGrantAndApprovalTransitionsSameUserExactlyOnce() {
        long id=submit(); assertEquals("TEMP_WORKER",role());
        assertThrows(IllegalArgumentException.class,()->tx.execute(status->service.decide(manager,id,true,false,null,1)));
        assertEquals("TEMP_WORKER",role());
        tx.execute(status->service.decide(manager,id,true,true,null,1));
        assertEquals("WORKER",role());
        assertEquals(3L,jdbc.sql("select site_id from site_memberships where user_id=11 and status='ACTIVE'").query(Long.class).single());
        assertEquals("APPROVED",service.mine(temp).get("status"));
        assertEquals("WB",service.mine(temp).get("login_id"));
        assertThrows(RuntimeException.class,()->tx.execute(status->service.decide(manager,id,true,true,null,1)));
        assertEquals(1L,jdbc.sql("select count(*) from user_roles where user_id=11 and role='WORKER'").query(Long.class).single());
    }
    @Test void rejectionAllowsResubmissionWithoutGrantingRole() {
        long id=submit();
        tx.execute(status->service.decide(manager,id,false,false,"계약 정보 확인 필요",1));
        assertEquals("TEMP_WORKER",role());
        submit(); assertEquals("PENDING",service.mine(temp).get("status"));
        assertThrows(IllegalArgumentException.class,()->tx.execute(status->service.decide(manager,id,true,true,null,1)));
        assertEquals("TEMP_WORKER",role());
        tx.execute(status->service.decide(manager,id,true,true,null,2));
        assertEquals("WORKER",role());
    }
    @Test void inactiveTargetAndForeignManagerCannotApprove() {
        long id=submit();
        var foreign=new SessionPrincipal(20L,null,"Manager",Set.of(Role.SITE_ADMIN),Set.of(2L));
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->tx.execute(status->service.decide(foreign,id,true,true,null,1)));
        jdbc.sql("update sites set status='SUSPENDED' where id=3").update();
        assertThrows(IllegalArgumentException.class,()->tx.execute(status->service.decide(manager,id,true,true,null,1)));
        assertEquals("TEMP_WORKER",role());
    }
    @Test void identityConflictRollsBackAllRoleChanges() {
        long id=submit();
        jdbc.sql("update worker_upgrade_requests set phone='01087654321' where id=:id").param("id",id).update();
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->tx.execute(status->service.decide(manager,id,true,true,null,1)));
        assertEquals("TEMP_WORKER",role());
        assertEquals("PENDING",service.mine(temp).get("status"));
        assertEquals(0L,jdbc.sql("select count(*) from worker_quick_login_credentials where user_id=11").query(Long.class).single());
    }
    @Test void duplicateApprovedIrisRollsBackEvenAfterRoleUpdates() {
        long id=submit();
        jdbc.sql("insert into users(id,phone,display_name,account_status) values(12,'01011112222','Other','ACTIVE')").update();
        jdbc.sql("insert into worker_upgrade_requests(user_id,site_id,display_name,phone,iris_id,consent_version,status,decided_by,verification_method) values(12,3,'Other','01011112222','00123','test','APPROVED',20,'MANUAL_CONTRACT_CHECK')").update();
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class,()->tx.execute(status->service.decide(manager,id,true,true,null,1)));
        assertEquals("TEMP_WORKER",role());
        assertEquals("PENDING",service.mine(temp).get("status"));
        assertEquals(2L,jdbc.sql("select site_id from site_memberships where user_id=11 and status='ACTIVE'").query(Long.class).single());
    }
}
