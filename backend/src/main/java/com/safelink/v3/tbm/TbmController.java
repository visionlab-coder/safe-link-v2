package com.safelink.v3.tbm;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import com.safelink.v3.storage.FileObject;
import com.safelink.v3.storage.FileObjectRepository;
import com.safelink.v3.storage.ObjectStorageService;
import jakarta.validation.constraints.NotBlank;
import java.net.URI;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tbm/compat")
public class TbmController {
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final int MAX_SIGNATURE_BYTES = 1_000_000;
    private static final Pattern DATA_URL_PATTERN = Pattern.compile("^data:([\\w.+-]+/[\\w.+-]+);base64,(.+)$", Pattern.DOTALL);
    private static final Set<String> SIGNATURE_MIME_TYPES = Set.of("image/png", "image/jpeg", "image/webp");

    private final TbmRepository tbm;
    private final FileObjectRepository files;
    private final ObjectStorageService storage;
    private final SiteGuard siteGuard;
    private final AuditService audit;

    public TbmController(TbmRepository tbm, FileObjectRepository files, ObjectStorageService storage, SiteGuard siteGuard, AuditService audit) {
        this.tbm = tbm;
        this.files = files;
        this.storage = storage;
        this.siteGuard = siteGuard;
        this.audit = audit;
    }

    @GetMapping("/today")
    public TbmListResponse today(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam(required = false) String id,
        @RequestParam(defaultValue = "5") int limit
    ) {
        if (id != null && !id.isBlank()) {
            var notice = tbm.getNotice(parseLong(id, "tbm_id_invalid"));
            siteGuard.requireSiteAccess(actor, notice.siteId(), "tbm.notice.read", "tbm_notice", String.valueOf(notice.id()));
            return new TbmListResponse(List.of(toCompatNotice(notice)));
        }
        requireSiteScoped(actor);
        int safeLimit = Math.max(1, Math.min(limit, 20));
        var rows = tbm.listLatest(actor.hasAnyGlobalRole(), actor.siteIds(), safeLimit).stream()
            .map(this::toCompatNotice)
            .toList();
        return new TbmListResponse(rows);
    }

    @GetMapping("/notices")
    public TbmListResponse notices(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestParam(required = false, name = "site_id") String siteId,
        @RequestParam(required = false) String date,
        @RequestParam(defaultValue = "10") int limit
    ) {
        requireTbmAdmin(actor);
        Long requestedSiteId = cleanOptionalLong(siteId, "site_id_invalid");
        if (requestedSiteId != null) {
            siteGuard.requireSiteAccess(actor, requestedSiteId, "tbm.notice.list", "tbm_notice", null);
        } else {
            requireSiteScoped(actor);
        }
        LocalDate targetDate = date == null || date.isBlank() ? LocalDate.now(KST) : LocalDate.parse(date);
        Instant start = targetDate.atStartOfDay(KST).toInstant();
        Instant end = targetDate.plusDays(1).atStartOfDay(KST).toInstant();
        int safeLimit = Math.max(1, Math.min(limit, 100));
        var rows = tbm.listForDate(actor.hasAnyGlobalRole(), actor.siteIds(), requestedSiteId, start, end, safeLimit).stream()
            .map(this::toCompatNotice)
            .toList();
        return new TbmListResponse(rows);
    }

    @PostMapping("/broadcast")
    public TbmBroadcastResponse broadcast(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestBody BroadcastRequest request
    ) {
        requireTbmAdmin(actor);
        String content = cleanRequired(request.contentKo(), "content_required");
        Long siteId = resolveWritableSite(actor, request.siteId());
        String title = request.title() == null || request.title().isBlank()
            ? "TBM 안전 브리핑"
            : request.title().trim();

        if (tbm.listWorkers(actor.hasAnyGlobalRole(), actor.siteIds(), siteId).isEmpty()) {
            audit.record(
                actor.userId(),
                siteId,
                "tbm.notice.create",
                "tbm_notice",
                null,
                "DENIED",
                "tbm_no_target_workers",
                Map.of()
            );
            throw new IllegalArgumentException("tbm_no_target_workers");
        }

        var notice = tbm.createPublished(siteId, actor.userId(), title, content);
        audit.record(actor.userId(), siteId, "tbm.notice.create", "tbm_notice", String.valueOf(notice.id()), "ALLOWED", "compat_server_api", Map.of());
        return new TbmBroadcastResponse(toCompatNotice(notice));
    }

    @GetMapping("/acks")
    public AckListResponse acks(@AuthenticationPrincipal SessionPrincipal actor, @RequestParam String tbmId) {
        requireTbmAdmin(actor);
        var notice = tbm.getNotice(parseLong(tbmId, "tbm_id_invalid"));
        siteGuard.requireSiteAccess(actor, notice.siteId(), "tbm.ack.list", "tbm_notice", String.valueOf(notice.id()));
        var rows = tbm.listAcks(notice.id()).stream()
            .map(this::toCompatAck)
            .toList();
        return new AckListResponse(rows);
    }

    @GetMapping("/workers")
    public WorkerListResponse workers(@AuthenticationPrincipal SessionPrincipal actor, @RequestParam(required = false, name = "site_id") String siteId) {
        requireTbmAdmin(actor);
        Long requestedSiteId = cleanOptionalLong(siteId, "site_id_invalid");
        if (requestedSiteId != null) {
            siteGuard.requireSiteAccess(actor, requestedSiteId, "tbm.worker.list", "user", null);
        } else {
            requireSiteScoped(actor);
        }
        var rows = tbm.listWorkers(actor.hasAnyGlobalRole(), actor.siteIds(), requestedSiteId).stream()
            .map(worker -> new CompatWorkerResponse(
                String.valueOf(worker.id()),
                worker.displayName(),
                worker.preferredLanguage() == null || worker.preferredLanguage().isBlank() ? "ko" : worker.preferredLanguage(),
                null,
                String.valueOf(worker.siteId())
            ))
            .toList();
        return new WorkerListResponse(rows);
    }

    @PostMapping("/sign")
    @Transactional
    public SignResponse sign(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestBody SignRequest request
    ) {
        requireWorker(actor);
        var notice = tbm.getNotice(parseLong(request.tbmId(), "tbm_id_required"));
        siteGuard.requireSiteAccess(actor, notice.siteId(), "tbm.ack.create", "tbm_notice", String.valueOf(notice.id()));
        var existing = tbm.findAck(notice.id(), actor.userId());
        if (existing.isPresent()) {
            return SignResponse.already(existing.get());
        }

        DecodedSignature signature = decodeSignature(request.signatureData());
        String sha256 = sha256(signature.bytes());
        String extension = extensionFor(signature.mimeType());
        String objectKey = "sites/%d/tbm-signatures/%d/%d/%s.%s".formatted(
            notice.siteId(),
            notice.id(),
            actor.userId(),
            sha256,
            extension
        );

        storage.putObject(objectKey, signature.mimeType(), signature.bytes());
        Long fileObjectId = files.createReady(
            notice.siteId(),
            actor.userId(),
            objectKey,
            sha256,
            signature.mimeType(),
            (long) signature.bytes().length,
            "TBM_SIGNATURE"
        );

        var ack = tbm.acknowledge(notice.id(), actor.userId(), notice.siteId(), fileObjectId);
        audit.record(actor.userId(), notice.siteId(), "tbm.ack.create", "tbm_acknowledgement", String.valueOf(ack.id()), "ALLOWED", "object_storage_signature", Map.of("signatureFileId", fileObjectId, "sha256", sha256));
        return SignResponse.signed(ack, fileObjectId, sha256);
    }

    @GetMapping("/sign")
    public SignStatusResponse signStatus(@AuthenticationPrincipal SessionPrincipal actor, @RequestParam String tbmId) {
        requireWorker(actor);
        var notice = tbm.getNotice(parseLong(tbmId, "tbm_id_invalid"));
        siteGuard.requireSiteAccess(actor, notice.siteId(), "tbm.ack.read", "tbm_notice", String.valueOf(notice.id()));
        var ack = tbm.findAck(notice.id(), actor.userId());
        return ack
            .map(row -> new SignStatusResponse(true, row.acknowledgedAt().toString(), row.signatureFileId() == null ? null : String.valueOf(row.signatureFileId())))
            .orElseGet(() -> new SignStatusResponse(false, null, null));
    }

    @GetMapping("/signatures/{fileObjectId}")
    public ResponseEntity<byte[]> signature(
        @AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable Long fileObjectId
    ) {
        FileObject file = files.get(fileObjectId);
        siteGuard.requireSiteAccess(actor, file.siteId(), "tbm.signature.read", "file_object", String.valueOf(fileObjectId));
        if (!"TBM_SIGNATURE".equals(file.purpose())) {
            throw new AccessDeniedException("file_purpose_denied");
        }
        if (!canReadSignature(actor, file)) {
            throw new AccessDeniedException("signature_reader_denied");
        }
        var object = storage.getObject(file.objectKey());
        return ResponseEntity.ok()
            .cacheControl(CacheControl.noStore())
            .header(HttpHeaders.CONTENT_TYPE, object.contentType())
            .body(object.bytes());
    }

    private CompatNoticeResponse toCompatNotice(TbmRepository.NoticeRow notice) {
        String contentKo = notice.normalizedText() == null || notice.normalizedText().isBlank()
            ? notice.sourceText()
            : notice.normalizedText();
        return new CompatNoticeResponse(
            String.valueOf(notice.id()),
            String.valueOf(notice.siteId()),
            notice.siteName(),
            notice.title(),
            contentKo,
            notice.sourceText(),
            notice.normalizedText(),
            notice.status(),
            notice.publishedAt() == null ? null : notice.publishedAt().toString(),
            notice.createdAt().toString()
        );
    }

    private CompatAckResponse toCompatAck(TbmRepository.AckRow ack) {
        return new CompatAckResponse(
            String.valueOf(ack.workerId()),
            ack.acknowledgedAt().toString(),
            ack.signatureFileId() == null ? null : "/api/tbm/signature/" + ack.signatureFileId(),
            ack.signatureFileId() == null ? null : String.valueOf(ack.signatureFileId())
        );
    }

    private Long resolveWritableSite(SessionPrincipal actor, String requestedSiteId) {
        Long siteId = cleanOptionalLong(requestedSiteId, "site_id_invalid");
        if (siteId == null) {
            siteId = firstLong(actor.siteIds());
        }
        if (siteId == null) {
            throw new IllegalArgumentException("site_id_required");
        }
        siteGuard.requireGlobalOrSiteAdmin(actor, siteId, "tbm.notice.create", "tbm_notice", null);
        return siteId;
    }

    private static void requireSiteScoped(SessionPrincipal actor) {
        if (actor == null) {
            throw new IllegalArgumentException("authentication_required");
        }
        if (!actor.hasAnyGlobalRole() && actor.siteIds().isEmpty()) {
            throw new IllegalArgumentException("site_id_required");
        }
    }

    private static void requireTbmAdmin(SessionPrincipal actor) {
        if (actor == null || actor.roles().stream().noneMatch(role ->
            role == Role.ROOT || role == Role.HQ_ADMIN || role == Role.SITE_ADMIN || role == Role.SAFETY_MANAGER || role == Role.VIEWER
        )) {
            throw new AccessDeniedException("admin_required");
        }
    }

    private static void requireWorker(SessionPrincipal actor) {
        if (actor == null || !actor.hasRole(Role.WORKER)) {
            throw new AccessDeniedException("worker_required");
        }
    }

    private static boolean canReadSignature(SessionPrincipal actor, FileObject file) {
        if (actor.hasAnyGlobalRole()) {
            return true;
        }
        if (file.ownerUserId() != null && file.ownerUserId().equals(actor.userId())) {
            return true;
        }
        return actor.roles().stream().anyMatch(role ->
            role == Role.SITE_ADMIN || role == Role.SAFETY_MANAGER
        );
    }

    private static String cleanRequired(String value, String error) {
        String cleaned = value == null ? "" : value.trim();
        if (cleaned.isBlank()) {
            throw new IllegalArgumentException(error);
        }
        return cleaned;
    }

    private static Long cleanOptionalLong(String value, String error) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return parseLong(value, error);
    }

    private static Long parseLong(String value, String error) {
        try {
            return Long.valueOf(value == null ? "" : value.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(error);
        }
    }

    private static Long firstLong(Set<Long> values) {
        return values == null || values.isEmpty() ? null : values.stream().sorted().findFirst().orElse(null);
    }

    private static DecodedSignature decodeSignature(String signatureData) {
        String raw = cleanRequired(signatureData, "signature_required");
        Matcher matcher = DATA_URL_PATTERN.matcher(raw);
        String mimeType = "image/png";
        String base64 = raw;
        if (matcher.matches()) {
            mimeType = matcher.group(1).toLowerCase(Locale.ROOT);
            base64 = matcher.group(2);
        }
        if (!SIGNATURE_MIME_TYPES.contains(mimeType)) {
            throw new IllegalArgumentException("signature_mime_type_not_allowed");
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(base64.replaceAll("\\s", ""));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("signature_base64_invalid");
        }
        if (bytes.length == 0) {
            throw new IllegalArgumentException("signature_required");
        }
        if (bytes.length > MAX_SIGNATURE_BYTES) {
            throw new IllegalArgumentException("signature_too_large");
        }
        return new DecodedSignature(mimeType, bytes);
    }

    private static String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (Exception e) {
            throw new IllegalStateException("sha256_unavailable", e);
        }
    }

    private static String extensionFor(String mimeType) {
        return switch (mimeType) {
            case "image/jpeg" -> "jpg";
            case "image/webp" -> "webp";
            default -> "png";
        };
    }

    public record TbmListResponse(List<CompatNoticeResponse> tbms) {}
    public record TbmBroadcastResponse(CompatNoticeResponse tbm) {}
    public record AckListResponse(List<CompatAckResponse> acks) {}
    public record WorkerListResponse(List<CompatWorkerResponse> workers) {}
    public record BroadcastRequest(@JsonProperty("content_ko") String contentKo, @JsonProperty("site_id") String siteId, String title) {}
    public record SignRequest(@JsonProperty("tbm_id") @NotBlank String tbmId, @JsonProperty("signature_data") @NotBlank String signatureData) {}
    public record DecodedSignature(String mimeType, byte[] bytes) {}
    public record CompatNoticeResponse(
        String id,
        @JsonProperty("site_id") String siteId,
        @JsonProperty("site_name") String siteName,
        String title,
        @JsonProperty("content_ko") String contentKo,
        @JsonProperty("source_text") String sourceText,
        @JsonProperty("normalized_text") String normalizedText,
        String status,
        @JsonProperty("published_at") String publishedAt,
        @JsonProperty("created_at") String createdAt
    ) {}
    public record CompatAckResponse(
        @JsonProperty("worker_id") String workerId,
        @JsonProperty("ack_at") String ackAt,
        @JsonProperty("signature_data") String signatureData,
        @JsonProperty("signature_file_id") String signatureFileId
    ) {}
    public record CompatWorkerResponse(
        String id,
        @JsonProperty("display_name") String displayName,
        @JsonProperty("preferred_lang") String preferredLang,
        String nationality,
        @JsonProperty("site_id") String siteId
    ) {}
    public record SignResponse(
        boolean ok,
        @JsonProperty("signed_at") String signedAt,
        @JsonProperty("already_signed") boolean alreadySigned,
        @JsonProperty("signature_file_id") String signatureFileId,
        @JsonProperty("signature_sha256") String signatureSha256
    ) {
        static SignResponse signed(TbmRepository.AckRow ack, Long signatureFileId, String sha256) {
            return new SignResponse(true, ack.acknowledgedAt().toString(), false, String.valueOf(signatureFileId), sha256);
        }

        static SignResponse already(TbmRepository.AckRow ack) {
            return new SignResponse(true, ack.acknowledgedAt().toString(), true, ack.signatureFileId() == null ? null : String.valueOf(ack.signatureFileId()), null);
        }
    }
    public record SignStatusResponse(boolean signed, @JsonProperty("signed_at") String signedAt, @JsonProperty("signature_file_id") String signatureFileId) {}
}
