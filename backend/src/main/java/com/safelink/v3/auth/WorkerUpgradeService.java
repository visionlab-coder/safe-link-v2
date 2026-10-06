package com.safelink.v3.auth;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkerUpgradeService {
    public static final String CONSENT_VERSION = "worker-upgrade-2026-09-28";
    private final JdbcClient jdbc;
    private final SiteGuard guard;
    private final AuditService audit;
    public WorkerUpgradeService(JdbcClient jdbc, SiteGuard guard, AuditService audit) {
        this.jdbc=jdbc; this.guard=guard; this.audit=audit;
    }
    public record Application(String name,String phone,Long siteId,String irisId,boolean consent,String consentVersion) {}
    public static void validate(Application input) {
        if (!input.consent() || !CONSENT_VERSION.equals(input.consentVersion())) throw new IllegalArgumentException("privacy_consent_required");
        EnglishName.require(input.name());
        if (input.phone()==null || !input.phone().matches("\\+?[0-9]{8,15}")) throw new IllegalArgumentException("phone_invalid");
        if (input.siteId()==null || input.siteId()<1) throw new IllegalArgumentException("site_required");
        if (input.irisId()==null || !input.irisId().matches("[0-9]{1,64}")) throw new IllegalArgumentException("iris_id_invalid");
    }
    public static void requireTemporary(SessionPrincipal actor) {
        if (actor==null || !actor.roles().equals(Set.of(Role.TEMP_WORKER))) throw new AccessDeniedException("temporary_worker_required");
    }
    public List<Map<String,Object>> sites(SessionPrincipal actor) {
        requireTemporary(actor);
        return jdbc.sql("select id,name from sites where status='ACTIVE' order by name,id").query().listOfRows();
    }
    public Map<String,Object> mine(SessionPrincipal actor) {
        if (actor==null) throw new AccessDeniedException("authentication_required");
        var rows=jdbc.sql("select r.id,r.site_id,r.display_name,r.phone,r.iris_id,r.status,r.decision_reason,c.name_initials as login_id from worker_upgrade_requests r left join worker_quick_login_credentials c on c.user_id=r.user_id where r.user_id=:user")
            .param("user",actor.userId()).query().listOfRows();
        return rows.isEmpty()?Map.of("status","NONE"):rows.getFirst();
    }
    private void lockTemporary(Long userId) {
        String state=jdbc.sql("select account_status from users where id=:id for update").param("id",userId).query(String.class).single();
        var roles=jdbc.sql("select role from user_roles where user_id=:id and revoked_at is null").param("id",userId).query(String.class).list();
        if (!"ACTIVE".equals(state) || !Set.copyOf(roles).equals(Set.of("TEMP_WORKER"))) throw new AccessDeniedException("temporary_worker_required");
    }
    private void requireActiveSite(Long site) {
        if (!jdbc.sql("select exists(select 1 from sites where id=:id and status='ACTIVE')").param("id",site).query(Boolean.class).single())
            throw new IllegalArgumentException("site_unavailable");
    }
    @Transactional
    public Map<String,Object> submit(SessionPrincipal actor,Application input) {
        requireTemporary(actor); validate(input); lockTemporary(actor.userId()); requireActiveSite(input.siteId());
        var current=jdbc.sql("select status from worker_upgrade_requests where user_id=:id").param("id",actor.userId()).query(String.class).optional();
        if (current.isPresent() && !"REJECTED".equals(current.get())) throw new IllegalArgumentException("upgrade_already_submitted");
        jdbc.sql("""
            insert into worker_upgrade_requests(user_id,site_id,display_name,phone,iris_id,consent_version)
            values(:user,:site,:name,:phone,:iris,:version)
            on conflict(user_id) do update set site_id=excluded.site_id,display_name=excluded.display_name,
            phone=excluded.phone,iris_id=excluded.iris_id,consent_version=excluded.consent_version,
            consented_at=now(),requested_at=now(),status='PENDING',decided_by=null,decided_at=null,
            decision_reason=null,verification_method=null,revision=worker_upgrade_requests.revision+1
            """).param("user",actor.userId()).param("site",input.siteId()).param("name",EnglishName.require(input.name()))
            .param("phone",input.phone()).param("iris",input.irisId()).param("version",CONSENT_VERSION).update();
        audit.record(actor.userId(),input.siteId(),"worker.upgrade.request","user",String.valueOf(actor.userId()),"ALLOWED","pending_manual_verification",Map.of("consentVersion",CONSENT_VERSION));
        return Map.of("status","PENDING");
    }
    public List<Map<String,Object>> pending(SessionPrincipal actor) {
        if (actor==null || actor.roles().stream().noneMatch(Role::canManageSiteUsers)) throw new AccessDeniedException("role_denied");
        if (!actor.hasAnyGlobalRole() && actor.siteIds().isEmpty()) return List.of();
        String scope=actor.hasAnyGlobalRole()?"":" and r.site_id in (:sites)";
        var query=jdbc.sql("select r.*,s.name as site_name from worker_upgrade_requests r join sites s on s.id=r.site_id where r.status='PENDING'"+scope+" order by r.requested_at limit 100");
        if (!actor.hasAnyGlobalRole()) query=query.param("sites",actor.siteIds());
        return query.query().listOfRows();
    }
    @Transactional
    public Map<String,Object> decide(SessionPrincipal actor,Long id,boolean approve,boolean contractVerified,String reason,int revision) {
        var matches=jdbc.sql("select user_id,site_id from worker_upgrade_requests where id=:id").param("id",id).query().listOfRows();
        if (matches.isEmpty()) throw new IllegalArgumentException("request_not_found");
        var row=matches.getFirst();
        Long user=((Number)row.get("user_id")).longValue();
        Long site=((Number)row.get("site_id")).longValue();
        guard.requireGlobalOrSiteAdmin(actor,site,"worker.upgrade.review","worker_upgrade_request",String.valueOf(id));
        lockTemporary(user);
        var request=jdbc.sql("select * from worker_upgrade_requests where id=:id for update").param("id",id).query().singleRow();
        // A rejected request can be resubmitted for a different site while the reviewer waits.
        site=((Number)request.get("site_id")).longValue();
        guard.requireGlobalOrSiteAdmin(actor,site,"worker.upgrade.decide","worker_upgrade_request",String.valueOf(id));
        if (!"PENDING".equals(request.get("status"))) throw new IllegalArgumentException("request_already_decided");
        if (((Number)request.get("revision")).intValue()!=revision) throw new IllegalArgumentException("request_changed_refresh_required");
        if (approve && !contractVerified) throw new IllegalArgumentException("contract_verification_required");
        if (!approve && (reason==null || reason.isBlank() || reason.length()>500)) throw new IllegalArgumentException("rejection_reason_required");
        if (approve) {
            requireActiveSite(site);
            String approvedName = EnglishName.require((String)request.get("display_name"));
            // Match the existing worker login mechanism without asking the worker to create another account.
            String loginId = "W" + Long.toString(user,36).toUpperCase(java.util.Locale.ROOT);
            if (loginId.length()>6) throw new IllegalArgumentException("worker_login_id_requires_configuration");
            String phone = (String)request.get("phone");
            jdbc.sql("insert into worker_quick_login_credentials(user_id,name_initials,phone_last4,enabled) values(:id,:login,:last4,true) on conflict(user_id) do update set phone_last4=excluded.phone_last4,enabled=true,updated_at=now()")
                .param("id",user).param("login",loginId).param("last4",phone.substring(phone.length()-4)).update();
            jdbc.sql("update users set display_name=:name,phone=:phone where id=:id").param("name",approvedName).param("phone",request.get("phone")).param("id",user).update();
            jdbc.sql("update user_roles set revoked_at=now() where user_id=:id and role='TEMP_WORKER' and revoked_at is null").param("id",user).update();
            jdbc.sql("insert into user_roles(user_id,role,granted_by) values(:id,'WORKER',:actor)").param("id",user).param("actor",actor.userId()).update();
            jdbc.sql("update site_memberships set status='REVOKED' where user_id=:id and role='TEMP_WORKER'").param("id",user).update();
            jdbc.sql("insert into site_memberships(user_id,site_id,role,status) values(:id,:site,'WORKER','ACTIVE') on conflict(user_id,site_id,role) do update set status='ACTIVE'")
                .param("id",user).param("site",site).update();
        }
        jdbc.sql("update worker_upgrade_requests set status=:status,decided_by=:actor,decided_at=now(),decision_reason=:reason,verification_method=:method where id=:id")
            .param("status",approve?"APPROVED":"REJECTED").param("actor",actor.userId()).param("reason",approve?null:reason.strip())
            .param("method",approve?"MANUAL_CONTRACT_CHECK":null).param("id",id).update();
        audit.record(actor.userId(),site,"worker.upgrade."+(approve?"approve":"reject"),"user",String.valueOf(user),"ALLOWED","manual_contract_check",Map.of("requestId",id));
        return Map.of("status",approve?"APPROVED":"REJECTED");
    }
}
