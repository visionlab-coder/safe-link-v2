package com.safelink.v3.auth;

import com.safelink.v3.domain.Role;
import java.util.Collection;
import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public record SessionPrincipal(
    Long userId,
    String email,
    String displayName,
    String preferredLanguage,
    Set<Role> roles,
    Set<Long> siteIds
) implements UserDetails {
    public SessionPrincipal(Long userId, String email, String displayName, Set<Role> roles, Set<Long> siteIds) {
        this(userId, email, displayName, "ko", roles, siteIds);
    }

    public SessionPrincipal {
        preferredLanguage = preferredLanguage == null || preferredLanguage.isBlank() ? "ko" : preferredLanguage;
        roles = roles == null ? Collections.emptySet() : Set.copyOf(roles);
        siteIds = siteIds == null ? Collections.emptySet() : Set.copyOf(siteIds);
    }

    public boolean hasRole(Role role) {
        return roles.contains(role);
    }

    public boolean hasAnyGlobalRole() {
        return roles.stream().anyMatch(Role::hasGlobalSiteScope);
    }

    public boolean canAccessSite(Long siteId) {
        return siteId != null && (hasAnyGlobalRole() || siteIds.contains(siteId));
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return roles.stream()
            .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
            .collect(Collectors.toUnmodifiableSet());
    }

    @Override
    public String getPassword() {
        return "";
    }

    @Override
    public String getUsername() {
        return email == null ? String.valueOf(userId) : email;
    }
}
