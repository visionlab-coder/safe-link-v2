package com.safelink.v3.sandbox;

import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.auth.WorkerUpgradeService;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.context.annotation.DependsOn;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Local harness only; never included in production artifacts. Not a HiInfo integration. */
@Service
@Primary
@Profile("enrollment-sandbox")
@DependsOn("flywayInitializer")
public class EnrollmentSandboxUpgradeService extends WorkerUpgradeService {
    private final JdbcClient jdbc;
    private final AuditService audit;
    private final Long managerId;
    private final Long siteId;

    public EnrollmentSandboxUpgradeService(JdbcClient jdbc, SiteGuard guard, AuditService audit, Environment env) {
        super(jdbc, guard, audit);
        if (!"jdbc:postgresql://127.0.0.1:55439/sq_enrollment_sandbox".equals(env.getProperty("spring.datasource.url"))
            || !"127.0.0.1".equals(env.getProperty("server.address"))
            || !"127.0.0.1".equals(env.getProperty("spring.data.redis.host"))
            || !"56389".equals(env.getProperty("spring.data.redis.port")))
            throw new IllegalStateException("Enrollment harness requires dedicated loopback DB/Redis");
        if (!"sq_enrollment_sandbox".equals(jdbc.sql("select current_database()").query(String.class).single()))
            throw new IllegalStateException("Wrong sandbox database");
        this.jdbc = jdbc;
        this.audit = audit;
        // Fictitious fixtures only; never import production data or reset data on restart.
        Long org = jdbc.sql("select id from organizations where name='LOCAL ENROLLMENT SANDBOX'").query(Long.class).optional()
            .orElseGet(() -> jdbc.sql("insert into organizations(name) values('LOCAL ENROLLMENT SANDBOX') returning id").query(Long.class).single());
        siteId = jdbc.sql("select id from sites where organization_id=:org").param("org", org).query(Long.class).optional()
            .orElseGet(() -> jdbc.sql("insert into sites(organization_id,name) values(:org,'로컬 가입 테스트 현장') returning id").param("org", org).query(Long.class).single());
        managerId = jdbc.sql("select id from users where email='enrollment-manager@example.invalid'").query(Long.class).optional()
            .orElseGet(() -> jdbc.sql("insert into users(email,display_name,account_status) values('enrollment-manager@example.invalid','로컬 더미 관리자','ACTIVE') returning id").query(Long.class).single());
        jdbc.sql("insert into user_roles(user_id,role) select :id,'SITE_ADMIN' where not exists(select 1 from user_roles where user_id=:id and role='SITE_ADMIN' and revoked_at is null)").param("id", managerId).update();
        jdbc.sql("insert into site_memberships(user_id,site_id,role) values(:id,:site,'SITE_ADMIN') on conflict do nothing").param("id", managerId).param("site", siteId).update();
        jdbc.sql("create table if not exists sandbox_contracts(iris_id text primary key,display_name text not null,phone text unique not null,site_id bigint not null references sites(id))").update();
        for (int i = 1; i <= 9; i++) {
            jdbc.sql("insert into sandbox_contracts values(:iris,:name,:phone,:site) on conflict do nothing")
                .param("iris", "9900100" + i).param("name", "테스트근로자" + i)
                .param("phone", "0100000900" + i).param("site", siteId).update();
        }
    }

    @Override
    public Map<String,Object> mine(SessionPrincipal actor) {
        var result = new HashMap<>(super.mine(actor));
        result.put("local_enrollment_test", true);
        return result;
    }

    @Override
    @Transactional
    public Map<String,Object> submit(SessionPrincipal actor, Application input) {
        requireTemporary(actor);
        validate(input);
        // Match a pre-verified dummy contract AND the signed-in account, not arbitrary input.
        boolean matches = jdbc.sql("""
            select exists(select 1 from sandbox_contracts c join users u on u.id=:user
                where c.iris_id=:iris and c.display_name=:name and c.phone=:phone and c.site_id=:site
                and u.display_name=c.display_name and u.phone=c.phone)
            """).param("user", actor.userId()).param("iris", input.irisId()).param("name", input.name().strip())
            .param("phone", input.phone()).param("site", input.siteId()).query(Boolean.class).single();
        if (!matches) throw new IllegalArgumentException("sandbox_contract_mismatch");
        super.submit(actor, input);
        var request = jdbc.sql("select id,revision from worker_upgrade_requests where user_id=:id").param("id", actor.userId()).query().singleRow();
        var manager = new SessionPrincipal(managerId, "enrollment-manager@example.invalid", "로컬 더미 관리자", Set.of(Role.SITE_ADMIN), Set.of(siteId));
        super.decide(manager, ((Number)request.get("id")).longValue(), true, true, null, ((Number)request.get("revision")).intValue());
        audit.record(actor.userId(), siteId, "sandbox.fixture.auto_transition", "user", String.valueOf(actor.userId()), "ALLOWED", "LOCAL_DUMMY_CONTRACT_ONLY", Map.of());
        return mine(actor);
    }
}
