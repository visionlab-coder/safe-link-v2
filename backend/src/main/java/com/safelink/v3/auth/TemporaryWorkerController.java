package com.safelink.v3.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth/temporary-worker")
public class TemporaryWorkerController {
    private final TemporaryWorkerService service;
    private final LoginAttemptRateLimiter limiter;
    public TemporaryWorkerController(TemporaryWorkerService service, LoginAttemptRateLimiter limiter) {
        this.service=service; this.limiter=limiter;
    }
    @PostMapping
    public Map<String,Object> register(@RequestBody Registration body, HttpServletRequest request, HttpServletResponse response) {
        String bucket="temporary-worker-registration";
        limiter.checkAllowed(bucket,request.getRemoteAddr());
        limiter.recordFailure(bucket,request.getRemoteAddr()); // Count successes too; public enrollment abuse limit.
        var actor=service.register(body.name(),body.phone(),body.language(),body.consent(),body.consentVersion());
        var context=SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(actor,null,actor.getAuthorities()));
        SecurityContextHolder.setContext(context);
        request.getSession(true);
        request.changeSessionId();
        new HttpSessionSecurityContextRepository().saveContext(context,request,response);
        return Map.of("ok",true,"siteId",actor.siteIds().iterator().next(),"role","TEMP_WORKER");
    }
    public record Registration(String name,String phone,String language,boolean consent,String consentVersion) {}
}
