package com.safelink.v3.auth;

import com.safelink.v3.security.TemporaryWorkerAccessFilter;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class TemporaryWorkerTest {
    @Test void filterDeniesRegularWorkerResourceButPreservesRegularWorkers() throws Exception {
        var audit = org.mockito.Mockito.mock(com.safelink.v3.audit.AuditService.class);
        var filter = new TemporaryWorkerAccessFilter(audit);
        var context = org.springframework.security.core.context.SecurityContextHolder.createEmptyContext();
        try {
            for (var role : new com.safelink.v3.domain.Role[]{com.safelink.v3.domain.Role.TEMP_WORKER,com.safelink.v3.domain.Role.WORKER}) {
                var principal = new SessionPrincipal(10L,null,"Test",java.util.Set.of(role),java.util.Set.of(2L));
                context.setAuthentication(org.springframework.security.authentication.UsernamePasswordAuthenticationToken.authenticated(principal,null,principal.getAuthorities()));
                org.springframework.security.core.context.SecurityContextHolder.setContext(context);
                var request = new org.springframework.mock.web.MockHttpServletRequest("GET","/api/v1/tbm/notices");
                var response = new org.springframework.mock.web.MockHttpServletResponse();
                var chain = new org.springframework.mock.web.MockFilterChain();
                filter.doFilter(request,response,chain);
                if (role == com.safelink.v3.domain.Role.TEMP_WORKER) {
                    assertEquals(403,response.getStatus()); assertNull(chain.getRequest());
                } else { assertNotNull(chain.getRequest()); }
            }
        } finally { org.springframework.security.core.context.SecurityContextHolder.clearContext(); }
    }
    @Test void consentIsRequiredAndVersioned() {
        assertThrows(IllegalArgumentException.class, () -> TemporaryWorkerService.validate("Kim","01012345678",false,TemporaryWorkerService.CONSENT_VERSION));
        assertThrows(IllegalArgumentException.class, () -> TemporaryWorkerService.validate("Kim","01012345678",true,"old"));
        assertDoesNotThrow(() -> TemporaryWorkerService.validate("Kim","01012345678",true,TemporaryWorkerService.CONSENT_VERSION));
    }
    @Test void rejectsInvalidIdentity() {
        assertThrows(IllegalArgumentException.class, () -> TemporaryWorkerService.validate(" ","01012345678",true,TemporaryWorkerService.CONSENT_VERSION));
        assertThrows(IllegalArgumentException.class, () -> TemporaryWorkerService.validate("Kim","1234",true,TemporaryWorkerService.CONSENT_VERSION));
    }
    @Test void onlyLiveAndSessionEndpointsAllowed() {
        assertTrue(TemporaryWorkerAccessFilter.allows("GET","/api/v1/live/events"));
        assertTrue(TemporaryWorkerAccessFilter.allows("POST","/api/v1/ai/tts"));
        assertFalse(TemporaryWorkerAccessFilter.allows("POST","/api/v1/live/sessions"));
        for (String path : new String[]{"/api/v1/tbm", "/api/v1/chat", "/api/v1/files", "/api/v1/auth/setup-profile", "/api/v1/ai/vision", "/api/v1/live/summary"}) {
            assertFalse(TemporaryWorkerAccessFilter.allows("GET",path));
            assertFalse(TemporaryWorkerAccessFilter.allows("POST",path));
        }
    }
}
