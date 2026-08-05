package com.safelink.v3.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/password-reset")
public class PasswordResetController {
    private final PasswordResetService service;
    private final boolean exposeToken;

    public PasswordResetController(
        PasswordResetService service,
        @Value("${safe-link.password-reset.expose-token:false}") boolean exposeToken
    ) {
        this.service = service;
        this.exposeToken = exposeToken;
    }

    @PostMapping("/request")
    public ResponseEntity<Map<String, Object>> request(@Valid @RequestBody ResetRequest request, HttpServletRequest servletRequest) {
        var result = service.request(request.email(), clientIp(servletRequest));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("accepted", true);
        response.put("message", "password_reset_request_accepted");
        if (exposeToken && result.accountMatched()) {
            response.put("testToken", result.token());
        }
        return ResponseEntity.accepted().body(response);
    }

    @PostMapping("/confirm")
    public Map<String, Boolean> confirm(@Valid @RequestBody ResetConfirm request, HttpServletRequest servletRequest) {
        service.confirm(request.token(), request.newPassword(), clientIp(servletRequest));
        return Map.of("ok", true);
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        return forwarded == null || forwarded.isBlank() ? request.getRemoteAddr() : forwarded.split(",")[0].trim();
    }

    public record ResetRequest(@Email @NotBlank String email) {}
    public record ResetConfirm(@NotBlank String token, @NotBlank String newPassword) {}
}
