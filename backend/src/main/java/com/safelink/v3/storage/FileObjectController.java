package com.safelink.v3.storage;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.security.SiteGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.net.URI;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
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
    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
        "image/png",
        "image/jpeg",
        "image/webp",
        "application/pdf",
        "audio/mpeg",
        "audio/wav",
        "audio/mp4"
    );
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
        String mimeType = request.mimeType().trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_MIME_TYPES.contains(mimeType)) {
            throw new IllegalArgumentException("unsupported_file_type");
        }
        if (request.byteSize() > properties.getMaxUploadBytes()) {
            throw new IllegalArgumentException("file_too_large");
        }
        String sha256 = request.sha256().trim().toLowerCase(Locale.ROOT);
        if (!sha256.matches("^[0-9a-f]{64}$")) {
            throw new IllegalArgumentException("invalid_sha256");
        }
        String purpose = request.purpose().trim().toUpperCase(Locale.ROOT);
        if (!purpose.matches("^[A-Z0-9_-]{1,40}$")) {
            throw new IllegalArgumentException("invalid_file_purpose");
        }
        String objectKey = "sites/%d/%s/%s".formatted(request.siteId(), purpose.toLowerCase(Locale.ROOT), UUID.randomUUID());
        URI uploadUrl = storage.createUploadUrl(objectKey, mimeType, Duration.ofSeconds(properties.getUploadUrlTtlSeconds()));
        Long id = files.createPending(request.siteId(), actor.userId(), objectKey, sha256, mimeType, request.byteSize(), purpose);
        audit.record(actor.userId(), request.siteId(), "file.upload_url.create", "file_object", String.valueOf(id), "ALLOWED", "presigned_put", Map.of("purpose", purpose));
        return new UploadUrlResponse(id, objectKey, uploadUrl.toString(), properties.getUploadUrlTtlSeconds());
    }

    @PostMapping("/{id}/complete")
    public CompleteUploadResponse completeUpload(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable Long id) {
        FileObject file = files.get(id);
        siteGuard.requireSiteAccess(actor, file.siteId(), "file.upload.complete", "file_object", String.valueOf(id));
        if (!"PENDING_UPLOAD".equals(file.status())) {
            throw new IllegalArgumentException("upload_not_pending");
        }

        ObjectStorageService.ObjectMetadata metadata = storage.headObject(file.objectKey());
        if (metadata.byteSize() <= 0
            || metadata.byteSize() != file.byteSize()
            || metadata.byteSize() > properties.getMaxUploadBytes()
            || !file.mimeType().equals(metadata.contentType())) {
            quarantine(actor, file, id);
            throw new IllegalArgumentException("file_content_validation_failed");
        }

        ObjectStorageService.StoredObject object = storage.getObject(file.objectKey());
        byte[] bytes = object.bytes();
        String detectedMimeType = detectMimeType(bytes);
        boolean valid = bytes.length == file.byteSize()
            && file.mimeType().equals(detectedMimeType)
            && file.sha256().equals(sha256(bytes));

        if (!valid) {
            quarantine(actor, file, id);
            throw new IllegalArgumentException("file_content_validation_failed");
        }

        files.markReady(id);
        audit.record(actor.userId(), file.siteId(), "file.upload.complete", "file_object", String.valueOf(id), "ALLOWED", "content_verified", Map.of());
        return new CompleteUploadResponse(id, "READY");
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
    public record CompleteUploadResponse(Long fileObjectId, String status) {}
    public record DownloadUrlResponse(Long fileObjectId, String downloadUrl, long expiresInSeconds) {}

    private static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("sha256_unavailable", impossible);
        }
    }

    private void quarantine(SessionPrincipal actor, FileObject file, Long id) {
        files.markQuarantined(id);
        storage.deleteObject(file.objectKey());
        audit.record(actor.userId(), file.siteId(), "file.upload.complete", "file_object", String.valueOf(id), "DENIED", "content_validation_failed", Map.of());
    }

    private static String detectMimeType(byte[] bytes) {
        if (startsWith(bytes, new int[] {0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a})) return "image/png";
        if (startsWith(bytes, new int[] {0xff, 0xd8, 0xff})) return "image/jpeg";
        if (asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WEBP")) return "image/webp";
        if (asciiAt(bytes, 0, "%PDF-")) return "application/pdf";
        if (asciiAt(bytes, 0, "ID3") || (bytes.length >= 2 && (bytes[0] & 0xff) == 0xff && ((bytes[1] & 0xe0) == 0xe0))) return "audio/mpeg";
        if (asciiAt(bytes, 0, "RIFF") && asciiAt(bytes, 8, "WAVE")) return "audio/wav";
        if (asciiAt(bytes, 4, "ftyp")) return "audio/mp4";
        return "application/octet-stream";
    }

    private static boolean startsWith(byte[] bytes, int[] prefix) {
        if (bytes.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if ((bytes[i] & 0xff) != prefix[i]) return false;
        }
        return true;
    }

    private static boolean asciiAt(byte[] bytes, int offset, String value) {
        if (bytes.length < offset + value.length()) return false;
        for (int i = 0; i < value.length(); i++) {
            if ((char) bytes[offset + i] != value.charAt(i)) return false;
        }
        return true;
    }
}
