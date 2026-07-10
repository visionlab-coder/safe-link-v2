package com.safelink.v3.domain;

import java.util.Locale;

public enum Role {
    ROOT,
    HQ_ADMIN,
    SITE_ADMIN,
    SAFETY_MANAGER,
    WORKER,
    VIEWER;

    public static Role parse(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("role_required");
        }
        return Role.valueOf(value.trim().toUpperCase(Locale.ROOT));
    }

    public boolean hasGlobalSiteScope() {
        return this == ROOT || this == HQ_ADMIN;
    }

    public boolean canCreateAdminInvitation() {
        return this == ROOT || this == HQ_ADMIN || this == SITE_ADMIN;
    }

    public boolean canManageSiteUsers() {
        return this == ROOT || this == HQ_ADMIN || this == SITE_ADMIN;
    }

    public boolean canUseAi() {
        return this != VIEWER;
    }
}
