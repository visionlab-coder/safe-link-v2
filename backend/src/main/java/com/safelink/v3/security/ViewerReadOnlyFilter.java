package com.safelink.v3.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import java.util.Set;
import org.springframework.http.MediaType;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ViewerReadOnlyFilter extends OncePerRequestFilter {
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");
    private static final Set<String> ALLOWED_SELF_SERVICE_PATHS = Set.of(
        "/api/v1/auth/logout",
        "/api/v1/auth/setup-profile"
    );

    private final ObjectMapper objectMapper;
    private final AuditService audit;

    public ViewerReadOnlyFilter(ObjectMapper objectMapper, AuditService audit) {
        this.objectMapper = objectMapper;
        this.audit = audit;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
            && authentication.getPrincipal() instanceof SessionPrincipal principal
            && principal.roles().equals(Set.of(Role.VIEWER))
            && !SAFE_METHODS.contains(request.getMethod())
            && !ALLOWED_SELF_SERVICE_PATHS.contains(request.getRequestURI())) {
            audit.record(
                principal.userId(),
                null,
                "viewer.write",
                "http_request",
                request.getRequestURI(),
                "DENIED",
                "viewer_read_only",
                Map.of("method", request.getMethod())
            );
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getOutputStream(), Map.of("error", "viewer_read_only"));
            return;
        }
        filterChain.doFilter(request, response);
    }
}
