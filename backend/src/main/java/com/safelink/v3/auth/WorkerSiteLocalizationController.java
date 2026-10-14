package com.safelink.v3.auth;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class WorkerSiteLocalizationController {
    private final WorkerSiteLocalizationService service;
    public WorkerSiteLocalizationController(WorkerSiteLocalizationService service) { this.service=service; }
    public record Input(String language) {}
    @PostMapping("/api/v1/worker-upgrade/sites/localize")
    public List<Map<String,Object>> localize(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody Input input) {
        return service.sites(actor,input.language());
    }
}
