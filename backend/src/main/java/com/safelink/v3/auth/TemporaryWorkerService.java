package com.safelink.v3.auth;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.domain.Role;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TemporaryWorkerService {
    public static final String CONSENT_VERSION = "temporary-worker-2026-09-28";
    private final JdbcClient jdbc;
    private final AuditService audit;
    private final String sponsorEmail;
    public TemporaryWorkerService(JdbcClient jdbc, AuditService audit,
        @Value("${safe-link.temporary-worker.sponsor-email:seann3113@gmail.com}") String sponsorEmail) {
        this.jdbc = jdbc; this.audit = audit; this.sponsorEmail = sponsorEmail;
    }

    /** Only the server's configured sponsor determines the test site; no client site/role input. */
    public Long siteId() {
        var sites = jdbc.sql("""
            select distinct m.site_id from users u
            join site_memberships m on m.user_id=u.id and m.status='ACTIVE'
            join sites s on s.id=m.site_id and s.status='ACTIVE'
            where lower(u.email)=lower(:email) and u.account_status='ACTIVE'
            """).param("email", sponsorEmail).query(Long.class).list();
        if (sites.size() != 1) throw new IllegalArgumentException("temporary_site_requires_configuration");
        return sites.getFirst();
    }

    public static void validate(String name, String phone, boolean consent, String version) {
        if (!consent || !CONSENT_VERSION.equals(version)) throw new IllegalArgumentException("privacy_consent_required");
        if (name == null || name.strip().isEmpty() || name.length()>80) throw new IllegalArgumentException("name_required");
        if (phone == null || !phone.matches("\\+?[0-9]{8,15}")) throw new IllegalArgumentException("phone_invalid");
    }

    @Transactional
    public SessionPrincipal register(String name, String phone, String language, boolean consent, String version) {
        validate(name, phone, consent, version);
        if (language == null || !language.matches("[a-z]{2,5}")) throw new IllegalArgumentException("language_invalid");
        Long site = siteId();
        // Never sign in or promote an existing account using an unverified phone number.
        Long id = jdbc.sql("""
            insert into users(phone,display_name,preferred_language,account_status)
            values(:phone,:name,:lang,'ACTIVE') on conflict(phone) do nothing returning id
            """).param("phone",phone).param("name",name.strip()).param("lang",language)
            .query(Long.class).optional().orElseThrow(() -> new IllegalArgumentException("temporary_registration_unavailable"));
        jdbc.sql("insert into user_roles(user_id,role) values(:id,'TEMP_WORKER')").param("id",id).update();
        jdbc.sql("insert into site_memberships(user_id,site_id,role) values(:id,:site,'TEMP_WORKER')")
            .param("id",id).param("site",site).update();
        jdbc.sql("insert into temporary_worker_consents(user_id,site_id,consent_version) values(:id,:site,:version)")
            .param("id",id).param("site",site).param("version",version).update();
        audit.record(id,site,"temporary_worker.register","user",String.valueOf(id),"ALLOWED","privacy_consent",
            Map.of("consentVersion",version,"role","TEMP_WORKER"));
        return new SessionPrincipal(id,null,name.strip(),language,Set.of(Role.TEMP_WORKER),Set.of(site));
    }
}
