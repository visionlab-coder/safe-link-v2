package com.safelink.v3.account;

import com.safelink.v3.auth.SessionPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/account")
public class AccountDeletionController {
    private final AccountDeletionService service;

    public AccountDeletionController(AccountDeletionService service) {
        this.service = service;
    }

    @PostMapping("/deletion")
    public AccountDeletionService.DeletionResult delete(
        @AuthenticationPrincipal SessionPrincipal principal,
        @Valid @RequestBody DeletionRequest request,
        HttpServletRequest servletRequest
    ) {
        var result = service.deleteOwnAccount(principal, request.confirmation(), request.reason(), clientIp(servletRequest));
        HttpSession session = servletRequest.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        return result;
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null || forwarded.isBlank() ? request.getRemoteAddr() : forwarded.split(",")[0].trim();
    }

    public record DeletionRequest(@NotBlank String confirmation, String reason) {}
}
