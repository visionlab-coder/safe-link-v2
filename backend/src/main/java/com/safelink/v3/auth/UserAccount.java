package com.safelink.v3.auth;

import com.safelink.v3.domain.Role;
import java.util.Set;

public record UserAccount(
    Long id,
    String email,
    String displayName,
    String preferredLanguage,
    String accountStatus,
    String passwordHash,
    Set<Role> roles,
    Set<Long> siteIds
) {
    public UserAccount(Long id, String email, String displayName, String accountStatus, String passwordHash, Set<Role> roles, Set<Long> siteIds) {
        this(id, email, displayName, "ko", accountStatus, passwordHash, roles, siteIds);
    }

    public UserAccount {
        preferredLanguage = preferredLanguage == null || preferredLanguage.isBlank() ? "ko" : preferredLanguage;
    }

    public boolean isActive() {
        return "ACTIVE".equalsIgnoreCase(accountStatus);
    }

    public SessionPrincipal toPrincipal() {
        return new SessionPrincipal(id, email, displayName, preferredLanguage, roles, siteIds);
    }
}
