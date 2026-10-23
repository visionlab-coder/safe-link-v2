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
            new ClassPathResource("db/migration/V034__worker_upgrade_requests.sql"),
            new ClassPathResource("db/migration/V040__worker_birth_date_login.sql")
        ).execute(ds);
        var reservations = new ResourceDatabasePopulator(new ClassPathResource("db/migration/V046__reserved_worker_test_iris.sql"));
        reservations.setSeparator(org.springframework.jdbc.datasource.init.ScriptUtils.EOF_STATEMENT_SEPARATOR);
        reservations.execute(ds);
        jdbc.sql("insert into organizations(id,name) values(1,'Test')").update();
        jdbc.sql("insert into sites(id,organization_id,name) values(2,1,'Training'),(3,1,'Contract site')").update();
        jdbc.sql("insert into users(id,phone,display_name,account_status) values(11,'01012345678','Kim','ACTIVE'),(20,'01087654321','Manager','ACTIVE')").update();
        jdbc.sql("insert into user_roles(user_id,role) values(11,'TEMP_WORKER'),(20,'SITE_ADMIN')").update();
        jdbc.sql("insert into site_memberships(user_id,site_id,role) values(11,2,'TEMP_WORKER'),(20,3,'SITE_ADMIN')").update();
        var audit=mock(AuditService.class);
        service=new WorkerUpgradeService(jdbc,new SiteGuard(audit),audit);
        tx=new TransactionTemplate(new DataSourceTransactionManager(ds));
    }
    @Test void sixDigitBirthLoginPreservesZeroesAndRejectsDuplicates() {
        jdbc.sql("insert into worker_quick_login_credentials(user_id,name_initials,phone_last4,birth_date) values(11,'TEMP','5678','010203')").update();
        assertEquals("010203", service.mine(temp).get("birth_date"));
        assertEquals("010203", service.mine(temp).get("login_id"));
        assertThrows(RuntimeException.class, () -> jdbc.sql("insert into worker_quick_login_credentials(user_id,name_initials,phone_last4,birth_date) values(20,'TEMP','5678','010203')").update());
        for (String value : new String[]{"19900521", "90052", "010229", "900431", "000000"})
            assertThrows(RuntimeException.class, () -> jdbc.sql("update worker_quick_login_credentials set birth_date=:birth where user_id=11").param("birth", value).update(), value);
        assertEquals("010203", service.mine(temp).get("birth_date"));
    }

    long submit() {
        tx.execute(status->service.submit(temp,new WorkerUpgradeService.Application("Kim","01012345678",3L,"00123",true,WorkerUpgradeService.CONSENT_VERSION)));
        return jdbc.sql("select id from worker_upgrade_requests").query(Long.class).single();
    }
    @Test void simpleSignupReloginAndImmediateConversionKeepCredentials() {
        var audit=mock(AuditService.class);
        jdbc.sql("update users set email='sponsor@example.invalid' where id=20").update();
        var registration=new TemporaryWorkerService(jdbc,audit,"sponsor@example.invalid");
        var actor=tx.execute(status->registration.register(null,"01099991234","en",true,TemporaryWorkerService.CONSENT_VERSION,"010203"));
        assertEquals("1234",actor.displayName()); assertEquals(Set.of(Role.TEMP_WORKER),actor.roles());
        var repository=new UserAccountRepository(jdbc);
        var auth=new AuthService(repository,mock(org.springframework.security.crypto.password.PasswordEncoder.class),audit);
        var before=auth.authenticateWorkerBirthLogin("010203","1234",null,null,"test");
        assertInstanceOf(AuthService.WorkerQuickLoginSuccess.class,before);
        assertThrows(AuthService.WorkerQuickLoginNotFoundException.class,()->auth.authenticateWorkerBirthLogin("010203","9999",null,null,"test"));
        assertEquals("APPROVED",tx.execute(status->service.submit(actor,new WorkerUpgradeService.Application(null,null,2L,"009876",true,WorkerUpgradeService.CONSENT_VERSION))).get("status"));
        var after=auth.authenticateWorkerBirthLogin("010203","1234",null,null,"test");
        assertInstanceOf(AuthService.WorkerQuickLoginSuccess.class,after);
        var account=repository.findWorkerBirthLoginCandidates("010203","1234").getFirst();
        assertEquals(actor.userId(),account.id()); assertEquals(Set.of(Role.WORKER),account.roles()); assertEquals(Set.of(2L),account.siteIds());
        assertEquals("1234",account.displayName());
        assertTrue(repository.findWorkerQuickLoginCandidates("TEMP","1234").isEmpty());
        assertThrows(RuntimeException.class,()->tx.execute(status->registration.register(null,"01088881234","en",true,TemporaryWorkerService.CONSENT_VERSION,"010203")));
        assertEquals(0L,jdbc.sql("select count(*) from users where phone='01088881234'").query(Long.class).single());
    }
    @Test void immediateConversionRejectsDuplicateIrisAndUntrustedSiteAndRequiresConsent() {
        jdbc.sql("insert into worker_quick_login_credentials(user_id,name_initials,phone_last4,birth_date) values(11,'TEMP','5678','900521')").update();
        assertThrows(RuntimeException.class,()->tx.execute(status->service.submit(temp,new WorkerUpgradeService.Application(null,null,999L,"00123",true,WorkerUpgradeService.CONSENT_VERSION))));
        assertThrows(RuntimeException.class,()->tx.execute(status->service.submit(temp,new WorkerUpgradeService.Application(null,null,3L,"00123",false,WorkerUpgradeService.CONSENT_VERSION))));
        jdbc.sql("insert into worker_upgrade_requests(user_id,site_id,display_name,phone,iris_id,consent_version,status,decided_by,verification_method) values(20,3,'Manager','01087654321','00123','test','APPROVED',20,'SELF_REPORTED_IRIS')").update();
        assertThrows(RuntimeException.class,()->tx.execute(status->service.submit(temp,new WorkerUpgradeService.Application(null,null,3L,"00123",true,WorkerUpgradeService.CONSENT_VERSION))));
        assertEquals("TEMP_WORKER",role());
        assertEquals(0L,jdbc.sql("select count(*) from worker_upgrade_requests where user_id=11").query(Long.class).single());
    }
    @Test void siteLabelsAreLocalizedCachedAndInvalidatedWithoutChangingSiteIdentity() {
        var gateway=mock(com.safelink.v3.ai.AiGatewayController.class);
        var labels=new WorkerSiteLocalizationService(jdbc,gateway);
        for(String lang:new String[]{"en","vi","zh","th","uz","ph","km","id","mn","my","ne","bn","kk","ru","jp","fr","es","ar","hi"}) {
            org.mockito.Mockito.when(gateway.translate(org.mockito.Mockito.eq(temp),org.mockito.Mockito.any()))
                .thenReturn(org.springframework.http.ResponseEntity.ok(new com.safelink.v3.ai.AiGatewayController.TranslateResponse("[3] Translated B\n[2] Translated A","test","fixture")));
            var result=labels.sites(temp,lang);
            assertTrue(result.stream().allMatch(r->Boolean.TRUE.equals(r.get("translation_available"))));
            assertEquals("Translated A",result.stream().filter(r->r.get("id").equals(2L)).findFirst().orElseThrow().get("name"));
        }
        org.mockito.Mockito.clearInvocations(gateway);
        labels.sites(temp,"en"); labels.sites(temp,"ko"); org.mockito.Mockito.verifyNoInteractions(gateway);
        jdbc.sql("update sites set name='Changed' where id=2").update();
        org.mockito.Mockito.when(gateway.translate(org.mockito.Mockito.eq(temp),org.mockito.Mockito.any())).thenThrow(new IllegalStateException("provider_unavailable"));
        var fallback=labels.sites(temp,"en").stream().filter(r->r.get("id").equals(2L)).findFirst().orElseThrow();
        assertEquals("Changed",fallback.get("name")); assertEquals(false,fallback.get("translation_available"));
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->labels.sites(manager,"en"));
        assertThrows(IllegalArgumentException.class,()->labels.sites(temp,"xx"));
    }
    String role() {return jdbc.sql("select role from user_roles where user_id=11 and revoked_at is null").query(String.class).single();}
    @Test void reservedIrisIsOwnerOnlyAndConsumedBySuccessfulConversionOnce() {
        jdbc.sql("insert into worker_quick_login_credentials(user_id,name_initials,phone_last4,birth_date) values(11,'TEMP','5678','991111')").update();
        jdbc.sql("insert into worker_test_iris_reservations(iris_id,user_id,reason) values('990001',11,'fixture')").update();
        assertThrows(RuntimeException.class, () -> jdbc.sql("insert into worker_upgrade_requests(user_id,site_id,display_name,phone,iris_id,consent_version) values(20,3,'Other','01087654321','990001','test')").update());
        assertThrows(RuntimeException.class, () -> tx.execute(status -> service.submit(temp,new WorkerUpgradeService.Application(null,null,999L,"990001",true,WorkerUpgradeService.CONSENT_VERSION))));
        assertTrue(jdbc.sql("select consumed_at is null from worker_test_iris_reservations").query(Boolean.class).single());
        // A later failure must roll back both conversion and reservation consumption.
        tx.execute(status -> {
            service.submit(temp,new WorkerUpgradeService.Application(null,null,3L,"990001",true,WorkerUpgradeService.CONSENT_VERSION));
            status.setRollbackOnly(); return null;
        });
        assertEquals("TEMP_WORKER",role());
        assertTrue(jdbc.sql("select consumed_at is null from worker_test_iris_reservations").query(Boolean.class).single());
        assertEquals("APPROVED",tx.execute(status -> service.submit(temp,new WorkerUpgradeService.Application(null,null,3L,"990001",true,WorkerUpgradeService.CONSENT_VERSION))).get("status"));
        assertFalse(jdbc.sql("select consumed_at is null from worker_test_iris_reservations").query(Boolean.class).single());
        assertThrows(RuntimeException.class, () -> tx.execute(status -> service.submit(temp,new WorkerUpgradeService.Application(null,null,3L,"990001",true,WorkerUpgradeService.CONSENT_VERSION))));
        assertThrows(RuntimeException.class, () -> jdbc.sql("update worker_upgrade_requests set status='REJECTED' where user_id=11").update());
        jdbc.sql("update worker_upgrade_requests set decision_reason='unchanged identity' where user_id=11").update();
        // Even removal of the request by an operator does not make the ID reusable.
        jdbc.sql("delete from worker_upgrade_requests where user_id=11").update();
        assertThrows(RuntimeException.class, () -> jdbc.sql("insert into worker_upgrade_requests(user_id,site_id,display_name,phone,iris_id,consent_version) values(11,3,'Kim','01012345678','990001','test')").update());
    }
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
