package com.safelink.v3.auth;

import com.safelink.v3.domain.Role;
import java.sql.Array;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class UserAccountRepository {
    private final JdbcClient jdbc;

    public UserAccountRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<UserAccount> findByEmail(String email) {
        return jdbc.sql("""
                select u.id, u.email, u.display_name, u.preferred_language, u.account_status, c.password_hash
                from users u
                join user_credentials c on c.user_id = u.id
                where lower(u.email) = lower(:email)
                  and c.disabled_at is null
                limit 1
            """)
            .param("email", email)
            .query((rs, rowNum) -> new UserAccount(
                rs.getLong("id"),
                rs.getString("email"),
                rs.getString("display_name"),
                rs.getString("preferred_language"),
                rs.getString("account_status"),
                rs.getString("password_hash"),
                rolesFor(rs.getLong("id")),
                sitesFor(rs.getLong("id"))
            ))
            .optional();
    }

    public Optional<UserAccount> findById(Long userId) {
        return jdbc.sql("""
                select u.id,
                       u.email,
                       u.display_name,
                       u.preferred_language,
                       u.account_status,
                       c.password_hash,
                       array(
                         select ur.role
                         from user_roles ur
                         where ur.user_id = u.id
                           and ur.revoked_at is null
                         order by ur.role
                       ) as active_roles,
                       array(
                         select sm.site_id
                         from site_memberships sm
                         join sites s on s.id = sm.site_id
                         where sm.user_id = u.id
                           and sm.status = 'ACTIVE'
                           and s.status = 'ACTIVE'
                         order by sm.site_id
                       ) as active_site_ids
                from users u
                left join user_credentials c on c.user_id = u.id and c.disabled_at is null
                where u.id = :userId
                limit 1
            """)
            .param("userId", userId)
            .query((rs, rowNum) -> new UserAccount(
                rs.getLong("id"),
                rs.getString("email"),
                rs.getString("display_name"),
                rs.getString("preferred_language"),
                rs.getString("account_status"),
                rs.getString("password_hash"),
                rolesFrom(rs.getArray("active_roles")),
                siteIdsFrom(rs.getArray("active_site_ids"))
            ))
            .optional();
    }

    public PasswordResetContact findPasswordResetContact(Long userId) {
        return jdbc.sql("select email, phone from users where id = :userId")
            .param("userId", userId)
            .query((rs, rowNum) -> new PasswordResetContact(rs.getString("email"), rs.getString("phone")))
            .single();
    }

    public List<UserAccount> findWorkerQuickLoginCandidates(String initials, String phoneLast4) {
        return jdbc.sql("""
                select distinct u.id, u.email, u.display_name, u.preferred_language, u.account_status
                from worker_quick_login_credentials q
                join users u on u.id = q.user_id
                join user_roles ur on ur.user_id = u.id
                where q.enabled = true
                  and q.name_initials = :initials
                  and q.phone_last4 = :phoneLast4
                  and ur.role = 'WORKER'
                  and ur.revoked_at is null
                order by u.id
            """)
            .param("initials", initials)
            .param("phoneLast4", phoneLast4)
            .query((rs, rowNum) -> new UserAccount(
                rs.getLong("id"),
                rs.getString("email"),
                rs.getString("display_name"),
                rs.getString("preferred_language"),
                rs.getString("account_status"),
                null,
                rolesFor(rs.getLong("id")),
                sitesFor(rs.getLong("id"))
            ))
            .list();
    }

    public List<SiteOption> siteOptionsFor(Set<Long> siteIds) {
        if (siteIds == null || siteIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("""
                select id, name
                from sites
                where id in (:siteIds)
                  and status = 'ACTIVE'
                order by name, id
            """)
            .param("siteIds", siteIds)
            .query((rs, rowNum) -> new SiteOption(
                rs.getLong("id"),
                rs.getString("name"),
                null
            ))
            .list();
    }

    public void updatePreferredLanguage(Long userId, String preferredLanguage) {
        jdbc.sql("""
                update users
                set preferred_language = :preferredLanguage
                where id = :userId
            """)
            .param("userId", userId)
            .param("preferredLanguage", preferredLanguage)
            .update();
    }

    public void updateProfile(Long userId, String displayName, String preferredLanguage) {
        jdbc.sql("""
                update users
                set display_name = :displayName,
                    preferred_language = :preferredLanguage
                where id = :userId
            """)
            .param("userId", userId)
            .param("displayName", displayName)
            .param("preferredLanguage", preferredLanguage)
            .update();
    }

    public void updatePassword(Long userId, String passwordHash) {
        int updated = jdbc.sql("""
                update user_credentials
                set password_hash = :passwordHash,
                    password_updated_at = now(),
                    disabled_at = null
                where user_id = :userId
            """)
            .param("passwordHash", passwordHash)
            .param("userId", userId)
            .update();
        if (updated != 1) {
            throw new IllegalArgumentException("password_reset_account_invalid");
        }
    }

    public UserAccount createPendingAdminSignupAccount(
        String email,
        String displayName,
        String preferredLanguage,
        String passwordHash
    ) {
        Long userId = jdbc.sql("""
                insert into users(email, display_name, preferred_language, account_status)
                values (:email, :displayName, :preferredLanguage, 'PENDING')
                returning id
            """)
            .param("email", email)
            .param("displayName", displayName)
            .param("preferredLanguage", preferredLanguage)
            .query(Long.class)
            .single();

        jdbc.sql("""
                insert into user_credentials(user_id, password_hash)
                values (:userId, :passwordHash)
            """)
            .param("userId", userId)
            .param("passwordHash", passwordHash)
            .update();

        return findById(userId).orElseThrow(() -> new IllegalStateException("created_user_not_found"));
    }

    public UserAccount createRootBootstrapAccount(
        String email,
        String displayName,
        String preferredLanguage,
        String passwordHash
    ) {
        Long userId = jdbc.sql("""
                insert into users(email, display_name, preferred_language, account_status)
                values (:email, :displayName, :preferredLanguage, 'ACTIVE')
                returning id
            """)
            .param("email", email)
            .param("displayName", displayName)
            .param("preferredLanguage", preferredLanguage)
            .query(Long.class)
            .single();

        jdbc.sql("""
                insert into user_credentials(user_id, password_hash)
                values (:userId, :passwordHash)
            """)
            .param("userId", userId)
            .param("passwordHash", passwordHash)
            .update();

        jdbc.sql("""
                insert into user_roles(user_id, role, granted_by)
                values (:userId, 'ROOT', null)
            """)
            .param("userId", userId)
            .update();

        return findById(userId).orElseThrow(() -> new IllegalStateException("created_root_user_not_found"));
    }

    public UserAccount approvePendingAdminAccount(Long userId, Role role, Long siteId, Long approvedBy) {
        jdbc.sql("""
                update users
                set account_status = 'ACTIVE'
                where id = :userId
                  and account_status = 'PENDING'
            """)
            .param("userId", userId)
            .update();

        jdbc.sql("""
                insert into user_roles(user_id, role, granted_by)
                values (:userId, :role, :approvedBy)
            """)
            .param("userId", userId)
            .param("role", role.name())
            .param("approvedBy", approvedBy)
            .update();

        if (!role.hasGlobalSiteScope()) {
            if (siteId == null) {
                throw new IllegalArgumentException("target_site_id_required");
            }
            jdbc.sql("""
                    insert into site_memberships(user_id, site_id, role, status)
                    values (:userId, :siteId, :role, 'ACTIVE')
                    on conflict (user_id, site_id, role)
                    do update set status = 'ACTIVE'
                """)
                .param("userId", userId)
                .param("siteId", siteId)
                .param("role", role.name())
                .update();
        }

        return findById(userId).orElseThrow(() -> new IllegalStateException("approved_user_not_found"));
    }

    public void rejectPendingAdminAccount(Long userId) {
        int updated = jdbc.sql("""
                update users
                set account_status = 'DEACTIVATED'
                where id = :userId
                  and account_status = 'PENDING'
            """)
            .param("userId", userId)
            .update();
        if (updated != 1) {
            throw new IllegalArgumentException("account_not_pending");
        }
    }

    public List<UserAccount> findPendingAdminSignupAccounts() {
        return jdbc.sql("""
                select u.id, u.email, u.display_name, u.preferred_language, u.account_status, c.password_hash
                from users u
                join user_credentials c on c.user_id = u.id
                where u.account_status = 'PENDING'
                  and u.email is not null
                order by u.created_at, u.id
            """)
            .query((rs, rowNum) -> new UserAccount(
                rs.getLong("id"),
                rs.getString("email"),
                rs.getString("display_name"),
                rs.getString("preferred_language"),
                rs.getString("account_status"),
                rs.getString("password_hash"),
                rolesFor(rs.getLong("id")),
                sitesFor(rs.getLong("id"))
            ))
            .list();
    }

    public void assertActiveSite(Long siteId) {
        Boolean exists = jdbc.sql("""
                select exists (
                  select 1
                  from sites
                  where id = :siteId
                    and status = 'ACTIVE'
                )
            """)
            .param("siteId", siteId)
            .query(Boolean.class)
            .single();
        if (!Boolean.TRUE.equals(exists)) {
            throw new IllegalArgumentException("target_site_not_found");
        }
    }

    public boolean hasActiveRole(Role role) {
        Boolean exists = jdbc.sql("""
                select exists (
                  select 1
                  from users u
                  join user_roles ur on ur.user_id = u.id
                  where u.account_status = 'ACTIVE'
                    and ur.role = :role
                    and ur.revoked_at is null
                )
            """)
            .param("role", role.name())
            .query(Boolean.class)
            .single();
        return Boolean.TRUE.equals(exists);
    }

    private Set<Role> rolesFor(Long userId) {
        var rows = jdbc.sql("""
                select role
                from user_roles
                where user_id = :userId
                  and revoked_at is null
                order by role
            """)
            .param("userId", userId)
            .query(String.class)
            .list();
        var roles = new LinkedHashSet<Role>();
        for (String row : rows) {
            roles.add(Role.parse(row));
        }
        return roles;
    }

    private Set<Long> sitesFor(Long userId) {
        return new LinkedHashSet<>(jdbc.sql("""
                select sm.site_id
                from site_memberships sm
                join sites s on s.id = sm.site_id
                where sm.user_id = :userId
                  and sm.status = 'ACTIVE'
                  and s.status = 'ACTIVE'
                order by sm.site_id
            """)
            .param("userId", userId)
            .query(Long.class)
            .list());
    }

    private Set<Role> rolesFrom(Array values) throws SQLException {
        var roles = new LinkedHashSet<Role>();
        if (values == null) {
            return roles;
        }
        for (Object value : (Object[]) values.getArray()) {
            roles.add(Role.parse(String.valueOf(value)));
        }
        return roles;
    }

    private Set<Long> siteIdsFrom(Array values) throws SQLException {
        var siteIds = new LinkedHashSet<Long>();
        if (values == null) {
            return siteIds;
        }
        for (Object value : (Object[]) values.getArray()) {
            siteIds.add(value instanceof Number number
                ? number.longValue()
                : Long.parseLong(String.valueOf(value)));
        }
        return siteIds;
    }

    public record SiteOption(Long siteId, String name, String siteCode) {}
    public record PasswordResetContact(String email, String phone) {}
}
