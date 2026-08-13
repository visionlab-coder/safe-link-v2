package com.safelink.v3.storage;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import java.util.Map;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/system/retention")
public class FileRetentionController {
    private final FileRetentionService service;
    private final AuditService audit;

    public FileRetentionController(FileRetentionService service, AuditService audit) {
        this.service = service;
        this.audit = audit;
    }

    @GetMapping("/policies")
    public java.util.List<FileRetentionService.RetentionPolicy> policies(
        @AuthenticationPrincipal SessionPrincipal principal
    ) {
        requireRoot(principal);
        return service.listPolicies();
    }

    @PostMapping("/files/purge")
    public FileRetentionService.PurgeResult purge(
        @AuthenticationPrincipal SessionPrincipal principal,
        @RequestParam(defaultValue = "100") int limit,
        @RequestParam(defaultValue = "true") boolean dryRun,
        @RequestParam(required = false) String confirm
    ) {
        requireRoot(principal);
        if (!dryRun && !"DELETE_EXPIRED_FILES".equals(confirm)) {
            throw new IllegalArgumentException("retention_purge_confirmation_required");
        }
        var result = service.purgeDueFiles(limit, dryRun);
        audit.record(principal.userId(), null, "retention.file.purge", "file_object", null,
            "ALLOWED", dryRun ? "dry_run" : "approved_purge",
            Map.of("dueCount", result.dueCount(), "deletedCount", result.deletedCount(), "failedCount", result.failedIds().size()));
        return result;
    }

    private static void requireRoot(SessionPrincipal principal) {
        if (principal == null || !principal.roles().contains(Role.ROOT)) {
            throw new AccessDeniedException("root_required");
        }
    }
}
