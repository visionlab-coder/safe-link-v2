package com.safelink.v3.security;

import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Fail closed: temporary membership never grants regular worker APIs. */
@Component
public class TemporaryWorkerAccessFilter extends OncePerRequestFilter {
    private final com.safelink.v3.audit.AuditService audit;
    public TemporaryWorkerAccessFilter(com.safelink.v3.audit.AuditService audit) { this.audit = audit; }
    private static final Set<String> READ = Set.of(
        "/api/v1/auth/me", "/api/v1/auth/csrf",
        "/api/v1/worker-upgrade", "/api/v1/worker-upgrade/sites",
        "/api/v1/glossary", "/api/v1/glossary/translations",
        "/api/v1/live/sessions", "/api/v1/live/events", "/api/v1/live/translations", "/api/v1/live/tbm-participation", "/api/v1/live/tbm-draft"
    );
    private static final Set<String> WRITE = Set.of(
        "/api/v1/auth/logout", "/api/v1/live/worker-responses", "/api/v1/live/tbm-participation",
        "/api/v1/worker-upgrade",
        "/api/v1/ai/translate", "/api/v1/ai/stt", "/api/v1/ai/tts",
        "/api/v1/ai/vendor", "/api/v1/ai/reserve"
    );
    public static boolean allows(String method, String path) {
        return ("GET".equals(method) && READ.contains(path)) || ("POST".equals(method) && WRITE.contains(path));
    }
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof SessionPrincipal actor
            && actor.hasRole(Role.TEMP_WORKER) && !allows(request.getMethod(), request.getRequestURI())) {
            audit.record(actor.userId(),null,"temporary_worker.access","http_request",request.getRequestURI(),
                "DENIED","temporary_worker_live_only",java.util.Map.of("method",request.getMethod()));
            response.setStatus(403);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"temporary_worker_live_only\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
