package com.safelink.v3.auth;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.safelink.v3.audit.AuditService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private static final Pattern INITIALS_PATTERN = Pattern.compile("^[A-Z0-9]{1,6}$");
    private static final Pattern PHONE_LAST4_PATTERN = Pattern.compile("^[0-9]{4}$");
    private static final Pattern LANG_PATTERN = Pattern.compile("^[a-z]{2,5}$");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Set<String> ADMIN_SIGNUP_FORBIDDEN_FIELDS = Set.of(
        "role",
        "roles",
        "site",
        "sites",
        "siteid",
        "siteids",
        "accountstatus",
        "isadmin",
        "admin",
        "permission",
        "permissions",
        "claims"
    );
    private final AuthService authService;
    private final AuditService audit;
    private final LoginAttemptRateLimiter loginAttemptRateLimiter;
    private final HttpSessionSecurityContextRepository contextRepository = new HttpSessionSecurityContextRepository();

    public AuthController(AuthService authService, AuditService audit, LoginAttemptRateLimiter loginAttemptRateLimiter) {
        this.authService = authService;
        this.audit = audit;
        this.loginAttemptRateLimiter = loginAttemptRateLimiter;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken csrfToken) {
        return new CsrfResponse(csrfToken.getHeaderName(), csrfToken.getParameterName(), csrfToken.getToken());
    }

    @PostMapping("/login")
    public CurrentUserResponse login(
        @Valid @RequestBody LoginRequest request,
        HttpServletRequest servletRequest,
        HttpServletResponse servletResponse
    ) {
        String ipAddress = clientIp(servletRequest);
        loginAttemptRateLimiter.checkAllowed(request.email(), ipAddress);
        SessionPrincipal principal;
        try {
            principal = authService.authenticate(request.email(), request.password(), ipAddress);
        } catch (org.springframework.security.authentication.BadCredentialsException ex) {
            loginAttemptRateLimiter.recordFailure(request.email(), ipAddress);
            throw ex;
        }
        loginAttemptRateLimiter.clear(request.email(), ipAddress);
        establishSession(principal, servletRequest, servletResponse);
        return CurrentUserResponse.from(principal);
    }

    @PostMapping("/admin-signup")
    public ResponseEntity<AdminSignupResponse> adminSignup(
        @RequestBody Map<String, Object> request,
        HttpServletRequest servletRequest
    ) {
        rejectAdminSignupRoleFields(request);
        var signup = authService.registerDirectAdminSignup(
            cleanEmail(request.get("email")),
            stringValue(request.get("password")),
            stringValue(request.get("display_name")),
            cleanLanguage(stringValue(request.get("preferred_lang"))),
            clientIp(servletRequest)
        );
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(AdminSignupResponse.from(signup));
    }

    @PostMapping("/worker-quick-login")
    public ResponseEntity<?> workerQuickLogin(
        @Valid @RequestBody WorkerQuickLoginRequest request,
        HttpServletRequest servletRequest,
        HttpServletResponse servletResponse
    ) {
        var result = authService.authenticateWorkerQuickLogin(
            cleanInitials(request.nameInitials()),
            cleanPhoneLast4(request.phoneLast4()),
            parseSiteId(request.siteId()),
            cleanLanguage(request.preferredLang()),
            clientIp(servletRequest)
        );

        if (result instanceof AuthService.WorkerQuickLoginMultipleSites multipleSites) {
            return ResponseEntity.status(409).body(new MultipleSitesResponse(
                multipleSites.sites().stream()
                    .map(site -> new SiteOptionResponse(String.valueOf(site.siteId()), site.name(), site.siteCode()))
                    .toList()
            ));
        }

        var success = (AuthService.WorkerQuickLoginSuccess) result;
        establishSession(success.principal(), servletRequest, servletResponse);
        return ResponseEntity.ok(CurrentUserResponse.from(success.principal()));
    }

    private void establishSession(
        SessionPrincipal principal,
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

    @GetMapping("/me")
    public CurrentUserResponse me(@AuthenticationPrincipal SessionPrincipal principal) {
        return CurrentUserResponse.from(principal);
    }

    @PostMapping("/setup-profile")
    public CurrentUserResponse setupProfile(
        @AuthenticationPrincipal SessionPrincipal principal,
        @RequestBody Map<String, Object> request,
        HttpServletRequest servletRequest,
        HttpServletResponse servletResponse
    ) {
        var updated = authService.updateOwnProfile(
            principal,
            stringValue(request.get("display_name")),
            cleanLanguage(stringValue(request.get("preferred_lang"))),
            setupMetadata(request),
            clientIp(servletRequest)
        );
        establishSession(updated, servletRequest, servletResponse);
        return CurrentUserResponse.from(updated);
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Boolean>> logout(
        @AuthenticationPrincipal SessionPrincipal principal,
        HttpServletRequest request
    ) {
        if (principal != null) {
            audit.record(principal.userId(), null, "auth.logout", "session", request.getSession(false) == null ? null : request.getSession(false).getId(), "ALLOWED", "user_request", Map.of());
        }
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(Map.of("ok", true));
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static String cleanInitials(String value) {
        String initials = value == null ? "" : value.trim().replaceAll("[^A-Za-z0-9]", "").toUpperCase();
        if (!INITIALS_PATTERN.matcher(initials).matches()) {
            throw new IllegalArgumentException("name_initials_required");
        }
        return initials;
    }

    private static String cleanPhoneLast4(String value) {
        String digits = value == null ? "" : value.replaceAll("\\D", "");
        if (!PHONE_LAST4_PATTERN.matcher(digits).matches()) {
            throw new IllegalArgumentException("phone_last4_required");
        }
        return digits;
    }

    private static String cleanLanguage(String value) {
        String language = value == null ? "ko" : value.trim().toLowerCase();
        return LANG_PATTERN.matcher(language).matches() ? language : "ko";
    }

    private static String cleanEmail(Object value) {
        String email = stringValue(value).trim();
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new IllegalArgumentException("email_invalid");
        }
        return email;
    }

    private static String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private static void rejectAdminSignupRoleFields(Map<String, Object> request) {
        for (String key : request.keySet()) {
            String normalized = key.replace("_", "").replace("-", "").toLowerCase(Locale.ROOT);
            if (ADMIN_SIGNUP_FORBIDDEN_FIELDS.contains(normalized)) {
                throw new IllegalArgumentException("admin_signup_role_fields_not_allowed");
            }
        }
    }

    private static Map<String, String> setupMetadata(Map<String, Object> request) {
        return Map.of(
            "requestedSetupRole", stringValue(request.get("setupRole")),
            "requestedSiteId", stringValue(request.get("site_id")),
            "requestedSiteCode", stringValue(request.get("site_code")),
            "requestedTitle", stringValue(request.get("title")),
            "requestedTrade", stringValue(request.get("trade")),
            "requestedPhone", stringValue(request.get("phone_number"))
        );
    }

    private static Long parseSiteId(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("invalid_site_id");
        }
    }

    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}
    public record WorkerQuickLoginRequest(
        @JsonProperty("name_initials") String nameInitials,
        @JsonProperty("phone_last4") String phoneLast4,
        @JsonProperty("preferred_lang") String preferredLang,
        @JsonProperty("site_id") String siteId
    ) {}
    public record MultipleSitesResponse(List<SiteOptionResponse> sites) {}
    public record SiteOptionResponse(String site_id, String name, String site_code) {}
    public record CsrfResponse(String headerName, String parameterName, String token) {}
    public record AdminSignupResponse(Long id, String email, String displayName, String preferredLanguage, String accountStatus, boolean approvalRequired) {
        static AdminSignupResponse from(AuthService.PendingAdminSignup signup) {
            return new AdminSignupResponse(
                signup.id(),
                signup.email(),
                signup.displayName(),
                signup.preferredLanguage(),
                signup.accountStatus(),
                signup.approvalRequired()
            );
        }
    }
    public record CurrentUserResponse(Long id, String email, String displayName, String preferredLanguage, List<String> roles, List<Long> siteIds) {
        static CurrentUserResponse from(SessionPrincipal principal) {
            return new CurrentUserResponse(
                principal.userId(),
                principal.email(),
                principal.displayName(),
                principal.preferredLanguage(),
                principal.roles().stream().map(Enum::name).sorted().toList(),
                principal.siteIds().stream().sorted().toList()
            );
        }
    }
}
