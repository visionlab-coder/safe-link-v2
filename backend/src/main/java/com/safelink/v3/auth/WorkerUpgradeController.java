package com.safelink.v3.auth;

import java.util.List;
import java.util.Map;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class WorkerUpgradeController {
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    @ResponseStatus(org.springframework.http.HttpStatus.CONFLICT)
    public Map<String,String> conflict() { return Map.of("error","worker_identity_conflict"); }
    private final WorkerUpgradeService service;
    public WorkerUpgradeController(WorkerUpgradeService service) { this.service=service; }
    @GetMapping("/api/v1/worker-upgrade")
    public Map<String,Object> mine(@AuthenticationPrincipal SessionPrincipal actor) { return service.mine(actor); }
    @GetMapping("/api/v1/worker-upgrade/sites")
    public List<Map<String,Object>> sites(@AuthenticationPrincipal SessionPrincipal actor) { return service.sites(actor); }
    @PostMapping("/api/v1/worker-upgrade")
    public Map<String,Object> submit(@AuthenticationPrincipal SessionPrincipal actor,@RequestBody WorkerUpgradeService.Application request) { return service.submit(actor,request); }
    @GetMapping("/api/v1/admin/worker-upgrades")
    public List<Map<String,Object>> pending(@AuthenticationPrincipal SessionPrincipal actor) { return service.pending(actor); }
    @PostMapping("/api/v1/admin/worker-upgrades/{id}/decision")
    public Map<String,Object> decide(@AuthenticationPrincipal SessionPrincipal actor,@PathVariable Long id,@RequestBody Decision request) {
        return service.decide(actor,id,request.approve(),request.contractVerified(),request.reason(),request.revision());
    }
    public record Decision(boolean approve,boolean contractVerified,String reason,int revision) {}
}
