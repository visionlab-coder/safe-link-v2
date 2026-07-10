package com.safelink.v3.storage;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.security.SiteGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/files")
public class FileObjectController {
    private final FileObjectRepository files;
    private final ObjectStorageService storage;
    private final StorageProperties properties;
    private final SiteGuard siteGuard;
    private final AuditService audit;

    public FileObjectController(FileObjectRepository files, ObjectStorageService storage, StorageProperties properties, SiteGuard siteGuard, AuditService audit) {
        this.files = files;
        this.storage = storage;
        this.properties = properties;
        this.siteGuard = siteGuard;
        this.audit = audit;
    }

    @PostMapping("/upload-url")
    public UploadUrlResponse uploadUrl(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody UploadUrlRequest request) {
        siteGuard.requireSiteAccess(actor, request.siteId(), "file.upload_url.create", "file_object", null);
        String purpose = request.purpose().trim().toUpperCase(Locale.ROOT);
        String objectKey = "sites/%d/%s/%s".formatted(request.siteId(), purpose.toLowerCase(Locale.ROOT), UUID.randomUUID());
        URI uploadUrl = storage.createUploadUrl(objectKey, request.mimeType(), Duration.ofSeconds(properties.getUploadUrlTtlSeconds()));
        Long id = files.createPending(request.siteId(), actor.userId(), objectKey, request.sha256(), request.mimeType(), request.byteSize(), purpose);
        audit.record(actor.userId(), request.siteId(), "file.upload_url.create", "file_object", String.valueOf(id), "ALLOWED", "presigned_put", Map.of("purpose", purpose));
        return new UploadUrlResponse(id, objectKey, uploadUrl.toString(), properties.getUploadUrlTtlSeconds());
    }

    @GetMapping("/{id}/download-url")
    public DownloadUrlResponse downloadUrl(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable Long id) {
        FileObject file = files.get(id);
        siteGuard.requireSiteAccess(actor, file.siteId(), "file.download_url.create", "file_object", String.valueOf(id));
        URI downloadUrl = storage.createDownloadUrl(file.objectKey(), Duration.ofSeconds(properties.getDownloadUrlTtlSeconds()));
        audit.record(actor.userId(), file.siteId(), "file.download_url.create", "file_object", String.valueOf(id), "ALLOWED", "presigned_get", Map.of("purpose", file.purpose()));
        return new DownloadUrlResponse(id, downloadUrl.toString(), properties.getDownloadUrlTtlSeconds());
    }

    public record UploadUrlRequest(@NotNull Long siteId, @NotBlank String purpose, @NotBlank String mimeType, @Min(1) Long byteSize, @NotBlank String sha256) {}
    public record UploadUrlResponse(Long fileObjectId, String objectKey, String uploadUrl, long expiresInSeconds) {}
    public record DownloadUrlResponse(Long fileObjectId, String downloadUrl, long expiresInSeconds) {}
}
