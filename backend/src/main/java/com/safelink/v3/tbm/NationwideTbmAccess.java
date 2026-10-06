package com.safelink.v3.tbm;

import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import org.springframework.security.access.AccessDeniedException;

public final class NationwideTbmAccess {
    private NationwideTbmAccess() {}
    public static void require(SessionPrincipal actor) {
        if (actor == null || !(actor.hasRole(Role.HQ_ADMIN) || actor.hasRole(Role.ROOT)))
            throw new AccessDeniedException("nationwide_tbm_admin_required");
    }
}
