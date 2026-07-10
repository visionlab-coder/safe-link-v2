package com.safelink.v3.security;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import java.util.Map;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
public class SiteGuard {
    private final AuditService audit;

    public SiteGuard(AuditService audit) {
        this.audit = audit;
    }

    public void requireSiteAccess(SessionPrincipal actor, Long siteId, String action, String resourceType, String resourceId) {
        if (actor == null) {
            deny(null, siteId, action, resourceType, resourceId, "authentication_required");
        }
        if (siteId == null) {
            deny(actor, null, action, resourceType, resourceId, "site_id_required");
        }
        if (actor.hasAnyGlobalRole() || actor.siteIds().contains(siteId)) {
            return;
        }
        deny(actor, siteId, action, resourceType, resourceId, "cross_site_denied");
    }

    public void requireGlobalOrSiteAdmin(SessionPrincipal actor, Long siteId, String action, String resourceType, String resourceId) {
        if (actor == null) {
            deny(null, siteId, action, resourceType, resourceId, "authentication_required");
        }
        boolean allowedRole = actor.roles().stream().anyMatch(role -> role.hasGlobalSiteScope() || role.canManageSiteUsers());
        if (!allowedRole) {
            deny(actor, siteId, action, resourceType, resourceId, "role_denied");
        }
        requireSiteAccess(actor, siteId, action, resourceType, resourceId);
    }

    private void deny(SessionPrincipal actor, Long siteId, String action, String resourceType, String resourceId, String reason) {
        audit.record(
            actor == null ? null : actor.userId(),
            siteId,
            action,
            resourceType,
            resourceId,
            "DENIED",
            reason,
            Map.of("roles", actor == null ? "anonymous" : actor.roles().toString())
        );
        throw new AccessDeniedException(reason);
    }
}
