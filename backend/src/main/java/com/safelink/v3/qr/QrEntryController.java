package com.safelink.v3.qr;

import com.safelink.v3.qr.QrEntryService.QrEntryRequest;
import com.safelink.v3.qr.QrEntryService.QrEntryResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/qr/site-entry")
public class QrEntryController {
    private final QrEntryService qrEntryService;
    private final HttpSessionSecurityContextRepository contextRepository = new HttpSessionSecurityContextRepository();

    public QrEntryController(QrEntryService qrEntryService) {
        this.qrEntryService = qrEntryService;
    }

    @PostMapping
    public ResponseEntity<QrEntryResponse> siteEntry(
        @RequestBody QrEntryRequest request,
        HttpServletRequest servletRequest,
        HttpServletResponse servletResponse
    ) {
        if ("info".equalsIgnoreCase(request.mode())) {
            return ResponseEntity.ok(qrEntryService.info(request.siteId()));
        }

        var outcome = qrEntryService.enter(request, clientIp(servletRequest));
        if (outcome.principal() == null) {
            invalidateSession(servletRequest);
            return ResponseEntity.ok(outcome.response());
        }

        establishSession(outcome.principal(), servletRequest, servletResponse);
        return ResponseEntity.ok(outcome.response());
    }

    private void establishSession(
        com.safelink.v3.auth.SessionPrincipal principal,
        HttpServletRequest servletRequest,
        HttpServletResponse servletResponse
    ) {
        var authentication = UsernamePasswordAuthenticationToken.authenticated(
            principal,
            null,
            principal.getAuthorities()
        );
        var context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        servletRequest.getSession(true);
        servletRequest.changeSessionId();
        contextRepository.saveContext(context, servletRequest, servletResponse);
    }

    private static void invalidateSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
