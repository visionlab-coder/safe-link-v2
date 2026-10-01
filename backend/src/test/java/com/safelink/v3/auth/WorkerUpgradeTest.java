package com.safelink.v3.auth;

import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import com.safelink.v3.security.TemporaryWorkerAccessFilter;
import com.safelink.v3.audit.AuditService;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class WorkerUpgradeTest {
    private final SessionPrincipal temp=new SessionPrincipal(11L,null,"Kim",Set.of(Role.TEMP_WORKER),Set.of(2L));
    @Test void requiresConsentAndNumericIrisWithoutDroppingLeadingZeros() {
        var valid=new WorkerUpgradeService.Application("Kim","01012345678",2L,"00123",true,WorkerUpgradeService.CONSENT_VERSION);
        assertDoesNotThrow(()->WorkerUpgradeService.validate(valid));
        assertEquals("00123",valid.irisId());
        assertThrows(IllegalArgumentException.class,()->WorkerUpgradeService.validate(new WorkerUpgradeService.Application("Kim","01012345678",2L,"123",false,WorkerUpgradeService.CONSENT_VERSION)));
        assertThrows(IllegalArgumentException.class,()->WorkerUpgradeService.validate(new WorkerUpgradeService.Application("Kim","01012345678",2L,"12A",true,WorkerUpgradeService.CONSENT_VERSION)));
        assertThrows(IllegalArgumentException.class,()->WorkerUpgradeService.validate(new WorkerUpgradeService.Application("Kim","01012345678",2L,"123",true,"old")));
    }
    @Test void onlyTemporaryUserCanApply() {
        assertDoesNotThrow(()->WorkerUpgradeService.requireTemporary(temp));
        assertThrows(AccessDeniedException.class,()->WorkerUpgradeService.requireTemporary(null));
        assertThrows(AccessDeniedException.class,()->WorkerUpgradeService.requireTemporary(new SessionPrincipal(12L,null,"Worker",Set.of(Role.WORKER),Set.of(2L))));
        assertThrows(AccessDeniedException.class,()->WorkerUpgradeService.requireTemporary(new SessionPrincipal(12L,null,"Admin",Set.of(Role.ROOT,Role.TEMP_WORKER),Set.of(2L))));
    }
    @Test void temporaryCanSubmitButCannotApproveOrAccessOtherFeatures() {
        assertTrue(TemporaryWorkerAccessFilter.allows("POST","/api/v1/worker-upgrade"));
        assertTrue(TemporaryWorkerAccessFilter.allows("GET","/api/v1/worker-upgrade/sites"));
        assertFalse(TemporaryWorkerAccessFilter.allows("POST","/api/v1/admin/worker-upgrades/1/decision"));
        assertFalse(TemporaryWorkerAccessFilter.allows("GET","/api/v1/tbm"));
    }
    @Test void onlyAuthorizedSiteManagerCanReview() {
        var guard=new SiteGuard(mock(AuditService.class));
        var manager=new SessionPrincipal(20L,null,"Manager",Set.of(Role.SITE_ADMIN),Set.of(2L));
        assertDoesNotThrow(()->guard.requireGlobalOrSiteAdmin(manager,2L,"review","request","1"));
        assertThrows(AccessDeniedException.class,()->guard.requireGlobalOrSiteAdmin(manager,3L,"review","request","1"));
        assertThrows(AccessDeniedException.class,()->guard.requireGlobalOrSiteAdmin(temp,2L,"review","request","1"));
        var safety=new SessionPrincipal(21L,null,"Safety",Set.of(Role.SAFETY_MANAGER),Set.of(2L));
        assertThrows(AccessDeniedException.class,()->guard.requireGlobalOrSiteAdmin(safety,2L,"review","request","1"));
    }
}
