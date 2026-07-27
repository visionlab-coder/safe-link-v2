package com.safelink.v3.security;

import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.auth.UserAccountRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Refreshes the authenticated account from the database for every session-backed
 * request. This prevents a stale session from retaining access after an account
 * is suspended, disabled, or has its roles/site memberships changed.
 */
@Component
public class CurrentAccountSessionFilter extends OncePerRequestFilter {
    private final UserAccountRepository users;
    private final HttpSessionSecurityContextRepository contextRepository = new HttpSessionSecurityContextRepository();

    public CurrentAccountSessionFilter(UserAccountRepository users) {
        this.users = users;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication != null && authentication.getPrincipal() instanceof SessionPrincipal existing)) {
            filterChain.doFilter(request, response);
            return;
        }

        var account = users.findById(existing.userId()).orElse(null);
        if (account == null || !account.isActive()) {
            var session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
            SecurityContextHolder.clearContext();
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "session_account_inactive");
            return;
        }

        var refreshed = account.toPrincipal();
        var refreshedAuthentication = UsernamePasswordAuthenticationToken.authenticated(
            refreshed,
            null,
            refreshed.getAuthorities()
        );
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(refreshedAuthentication);
        SecurityContextHolder.setContext(context);
        contextRepository.saveContext(context, request, response);
        filterChain.doFilter(request, response);
    }
}
