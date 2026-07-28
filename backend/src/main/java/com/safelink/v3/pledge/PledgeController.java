package com.safelink.v3.pledge;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import com.safelink.v3.security.SiteGuard;
import com.safelink.v3.storage.FileObjectRepository;
import com.safelink.v3.storage.ObjectStorageService;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pledges")
public class PledgeController {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Pattern DATA_URL_PATTERN = Pattern.compile("^data:([^;]+);base64,(.+)$", Pattern.CASE_INSENSITIVE);
    private static final Set<String> SIGNATURE_MIME_TYPES = Set.of("image/png", "image/jpeg", "image/webp");
    private static final int MAX_SIGNATURE_BYTES = 200_000;

    private final JdbcClient jdbc;
    private final SiteGuard siteGuard;
    private final AuditService audit;
    private final ObjectStorageService storage;
    private final FileObjectRepository files;
    private final ObjectMapper objectMapper;

    public PledgeController(JdbcClient jdbc, SiteGuard siteGuard, AuditService audit, ObjectStorageService storage, FileObjectRepository files, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.siteGuard = siteGuard;
        this.audit = audit;
        this.storage = storage;
        this.files = files;
        this.objectMapper = objectMapper;
    }

    @PostMapping
    @Transactional
    public PledgeCreateResponse create(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestBody PledgeCreateRequest request,
        HttpServletRequest servletRequest
    ) {
        requireWorker(actor);
        Long siteId = parseLong(request.siteId(), "siteId_required");
        siteGuard.requireSiteAccess(actor, siteId, "pledge.create", "site", String.valueOf(siteId));
        String content = cleanRequired(request.pledgeContent(), "pledgeContent_required");
        String contentHash = sha256(content.getBytes(StandardCharsets.UTF_8));

        StoredSignature signature = storeSignatureIfPresent(siteId, actor.userId(), request.signatureData(), "pledge-signatures");
        OffsetDateTime approvedAt = signature == null ? null : OffsetDateTime.now(SEOUL);
        String clientIp = signature == null ? null : clientIp(servletRequest);

        Long pledgeId = jdbc.sql("""
                insert into claim13_pledges(
                  tbm_session_id, worker_id, site_id, pledge_content, pledge_content_hash,
                  nfc_uid, signature_file_id, signature_sha256, client_ip, approved_at
                )
                values (:tbmSessionId, :workerId, :siteId, :content, :contentHash,
                        :nfcUid, :signatureFileId, :signatureSha256, :clientIp, :approvedAt)
                returning id
            """)
            .param("tbmSessionId", blankToNull(request.tbmSessionId()))
            .param("workerId", actor.userId())
            .param("siteId", siteId)
            .param("content", content)
            .param("contentHash", contentHash)
            .param("nfcUid", blankToNull(request.nfcUid()))
            .param("signatureFileId", signature == null ? null : signature.fileObjectId())
            .param("signatureSha256", signature == null ? null : signature.sha256())
            .param("clientIp", clientIp)
            .param("approvedAt", approvedAt)
            .query(Long.class)
            .single();

        Long hashChainEventId = null;
        if (signature != null) {
            hashChainEventId = appendHashEvent(siteId, "claim13_pledge", String.valueOf(pledgeId), "pledge_signed", Map.of(
                "pledge_id", pledgeId,
                "worker_id", actor.userId(),
                "tbm_session_id", safeString(request.tbmSessionId()),
                "pledge_content_hash", contentHash,
                "signature_file_id", signature.fileObjectId(),
                "signature_sha256", signature.sha256(),
                "nfc_uid", safeString(request.nfcUid()),
                "approved_at", approvedAt.toString(),
                "client_ip", safeString(clientIp)
            ), actor.userId());
            jdbc.sql("update claim13_pledges set hash_chain_event_id = :eventId where id = :pledgeId")
                .param("eventId", hashChainEventId)
                .param("pledgeId", pledgeId)
                .update();
        }
        audit.record(actor.userId(), siteId, "pledge.create", "claim13_pledge", String.valueOf(pledgeId), "ALLOWED", signature == null ? "created" : "signed", Map.of("signatureFileId", signature == null ? "" : signature.fileObjectId()));
        return new PledgeCreateResponse(String.valueOf(pledgeId), contentHash, signature == null ? null : String.valueOf(signature.fileObjectId()), signature == null ? null : signature.sha256(), hashChainEventId == null ? null : String.valueOf(hashChainEventId));
    }

    @GetMapping
    public PledgeListResponse list(@AuthenticationPrincipal SessionPrincipal actor, @RequestParam String tbmSessionId) {
        requireAdmin(actor);
        Long siteId = sessionSiteId(tbmSessionId);
        siteGuard.requireSiteAccess(actor, siteId, "pledge.list", "tbm_session", tbmSessionId);
        return new PledgeListResponse(pledgesForSession(tbmSessionId));
    }

    @PatchMapping("/{id}/sign")
    @Transactional
    public PledgeSignResponse sign(
        @AuthenticationPrincipal SessionPrincipal actor,
        @PathVariable Long id,
        @RequestBody PledgeSignRequest request,
        HttpServletRequest servletRequest
    ) {
        requireWorker(actor);
        PledgeRow pledge = pledge(id);
        if (!pledge.workerId().equals(actor.userId())) {
            throw new AccessDeniedException("FORBIDDEN");
        }
        siteGuard.requireSiteAccess(actor, pledge.siteId(), "pledge.sign", "claim13_pledge", String.valueOf(id));
        if (pledge.approvedAt() != null) {
            throw new IllegalArgumentException("pledge_already_signed");
        }
        StoredSignature signature = storeSignatureIfPresent(pledge.siteId(), actor.userId(), request.signatureData(), "pledge-signatures");
        if (signature == null) {
            throw new IllegalArgumentException("signatureData_required");
        }
        OffsetDateTime approvedAt = OffsetDateTime.now(SEOUL);
        int updated = jdbc.sql("""
                update claim13_pledges
                set signature_file_id = :signatureFileId,
                    signature_sha256 = :signatureSha256,
                    client_ip = :clientIp,
                    approved_at = :approvedAt
                where id = :id
                  and approved_at is null
            """)
            .param("id", id)
            .param("signatureFileId", signature.fileObjectId())
            .param("signatureSha256", signature.sha256())
            .param("clientIp", clientIp(servletRequest))
            .param("approvedAt", approvedAt)
            .update();
        if (updated == 0) {
            throw new IllegalArgumentException("pledge_already_signed");
        }

        Long eventId = appendHashEvent(pledge.siteId(), "claim13_pledge", String.valueOf(id), "pledge_signed", Map.of(
            "pledge_id", id,
            "worker_id", pledge.workerId(),
            "tbm_session_id", safeString(pledge.tbmSessionId()),
            "pledge_content_hash", pledge.pledgeContentHash(),
            "signature_file_id", signature.fileObjectId(),
            "signature_sha256", signature.sha256(),
            "approved_at", approvedAt.toString()
        ), actor.userId());
        jdbc.sql("update claim13_pledges set hash_chain_event_id = :eventId where id = :id")
            .param("eventId", eventId)
            .param("id", id)
            .update();
        return new PledgeSignResponse(true, approvedAt.toString(), String.valueOf(eventId), String.valueOf(signature.fileObjectId()), signature.sha256());
    }

    @GetMapping("/report")
    public PledgeReportResponse report(@AuthenticationPrincipal SessionPrincipal actor, @RequestParam String tbmSessionId) {
        requireAdmin(actor);
        Long siteId = sessionSiteId(tbmSessionId);
        siteGuard.requireSiteAccess(actor, siteId, "pledge.report", "tbm_session", tbmSessionId);
        var session = jdbc.sql("""
                select id, site_id, title, status, started_at
                from tbm_sessions
                where id = :sessionId
            """)
            .param("sessionId", parseLong(tbmSessionId, "tbmSessionId_invalid"))
            .query((rs, rowNum) -> Map.of(
                "id", String.valueOf(rs.getLong("id")),
                "site_id", String.valueOf(rs.getLong("site_id")),
                "title", rs.getString("title") == null ? "" : rs.getString("title"),
                "status", rs.getString("status"),
                "started_at", rs.getObject("started_at", OffsetDateTime.class).toString()
            ))
            .single();
        var attendance = jdbc.sql("select worker_id, is_certified, certified_at from tbm_attendance where session_id = :sessionId")
            .param("sessionId", parseLong(tbmSessionId, "tbmSessionId_invalid"))
            .query((rs, rowNum) -> Map.of(
                "worker_id", String.valueOf(rs.getLong("worker_id")),
                "is_certified", rs.getBoolean("is_certified"),
                "certified_at", rs.getObject("certified_at", OffsetDateTime.class) == null ? "" : rs.getObject("certified_at", OffsetDateTime.class).toString()
            ))
            .list();
        var pledges = pledgesForSession(tbmSessionId);
        long signedCount = pledges.stream().filter(pledge -> pledge.approved_at() != null).count();
        int unsignedCount = Math.max(attendance.size() - (int) signedCount, 0);
        var report = Map.of(
            "reportType", "tbm_signature_report",
            "generatedBy", String.valueOf(actor.userId()),
            "generatedAt", OffsetDateTime.now(SEOUL).toString(),
            "scope", Map.of("siteId", String.valueOf(siteId), "tbmSessionId", tbmSessionId),
            "sourceTables", List.of("tbm_sessions", "tbm_attendance", "claim13_pledges", "file_objects", "claim13_hash_chain_events")
        );
        return new PledgeReportResponse(session, (int) signedCount, unsignedCount, pledges, Map.of(
            "requiredFields", List.of("작업내용", "주요 위험요인", "위험성 감소대책", "근로자 준수사항", "관리감독자 확인"),
            "note", "TBM 서명 보고서는 참석·서명 증빙이며, 위험성평가/TBM 법적 방어력을 위해 세션 metadata 또는 TBM 본문에 위 항목을 포함해야 합니다."
        ), report);
    }

    @GetMapping("/hash-chain")
    public HashChainVerifyResponse verifyHashChain(@AuthenticationPrincipal SessionPrincipal actor, @RequestParam String siteId) {
        requireAdmin(actor);
        Long parsedSiteId = parseLong(siteId, "siteId_required");
        siteGuard.requireSiteAccess(actor, parsedSiteId, "audit.hash_chain.verify", "site", siteId);
        var rows = jdbc.sql("""
                select id, entity_type, entity_id, event_type, payload::text as payload, previous_hash, event_hash
                from claim13_hash_chain_events
                where site_id = :siteId
                order by id
            """)
            .param("siteId", parsedSiteId)
            .query((rs, rowNum) -> new HashChainRow(
                rs.getLong("id"),
                rs.getString("entity_type"),
                rs.getString("entity_id"),
                rs.getString("event_type"),
                rs.getString("payload"),
                rs.getString("previous_hash"),
                rs.getString("event_hash")
            ))
            .list();
        var breaks = new java.util.ArrayList<Map<String, Object>>();
        String previous = null;
        for (HashChainRow row : rows) {
            if ((previous == null && row.previousHash() != null) || (previous != null && !previous.equals(row.previousHash()))) {
                breaks.add(Map.of("id", row.id(), "reason", "previous_hash_mismatch"));
            }
            String expected = sha256((siteId + "|" + row.entityType() + "|" + row.entityId() + "|" + row.eventType() + "|" + row.payload() + "|" + (row.previousHash() == null ? "" : row.previousHash())).getBytes(StandardCharsets.UTF_8));
            if (!expected.equals(row.eventHash())) {
                breaks.add(Map.of("id", row.id(), "reason", "event_hash_mismatch"));
            }
            previous = row.eventHash();
        }
        return new HashChainVerifyResponse(siteId, breaks.isEmpty(), breaks);
    }

    private Long appendHashEvent(Long siteId, String entityType, String entityId, String eventType, Map<String, ?> payload, Long createdBy) {
        String payloadJson = canonicalJson(toJson(payload));
        String previousHash = jdbc.sql("""
                select event_hash
                from claim13_hash_chain_events
                where site_id = :siteId
                order by id desc
                limit 1
                for update
            """)
            .param("siteId", siteId)
            .query(String.class)
            .optional()
            .orElse(null);
        String eventHash = sha256((siteId + "|" + entityType + "|" + entityId + "|" + eventType + "|" + payloadJson + "|" + (previousHash == null ? "" : previousHash)).getBytes(StandardCharsets.UTF_8));
        return jdbc.sql("""
                insert into claim13_hash_chain_events(site_id, entity_type, entity_id, event_type, payload, previous_hash, event_hash, created_by)
                values (:siteId, :entityType, :entityId, :eventType, cast(:payload as jsonb), :previousHash, :eventHash, :createdBy)
                returning id
            """)
            .param("siteId", siteId)
            .param("entityType", entityType)
            .param("entityId", entityId)
            .param("eventType", eventType)
            .param("payload", payloadJson)
            .param("previousHash", previousHash)
            .param("eventHash", eventHash)
            .param("createdBy", createdBy)
            .query(Long.class)
            .single();
    }

    private List<PledgePayload> pledgesForSession(String tbmSessionId) {
        return jdbc.sql("""
                select id, worker_id, site_id, pledge_content_hash, nfc_uid, approved_at, hash_chain_event_id, created_at, signature_file_id, signature_sha256
                from claim13_pledges
                where tbm_session_id = :tbmSessionId
                order by created_at desc
            """)
            .param("tbmSessionId", tbmSessionId)
            .query((rs, rowNum) -> new PledgePayload(
                String.valueOf(rs.getLong("id")),
                String.valueOf(rs.getLong("worker_id")),
                String.valueOf(rs.getLong("site_id")),
                rs.getString("pledge_content_hash"),
                rs.getString("nfc_uid"),
                rs.getObject("approved_at", OffsetDateTime.class) == null ? null : rs.getObject("approved_at", OffsetDateTime.class).toString(),
                rs.getObject("hash_chain_event_id") == null ? null : String.valueOf(rs.getLong("hash_chain_event_id")),
                rs.getObject("created_at", OffsetDateTime.class).toString(),
                rs.getObject("signature_file_id") == null ? null : String.valueOf(rs.getLong("signature_file_id")),
                rs.getString("signature_sha256")
            ))
            .list();
    }

    private PledgeRow pledge(Long id) {
        return jdbc.sql("""
                select id, tbm_session_id, worker_id, site_id, pledge_content_hash, approved_at
                from claim13_pledges
                where id = :id
                for update
            """)
            .param("id", id)
            .query((rs, rowNum) -> new PledgeRow(
                rs.getLong("id"),
                rs.getString("tbm_session_id"),
                rs.getLong("worker_id"),
                rs.getLong("site_id"),
                rs.getString("pledge_content_hash"),
                rs.getObject("approved_at", OffsetDateTime.class)
            ))
            .optional()
            .orElseThrow(() -> new IllegalArgumentException("pledge_not_found"));
    }

    private Long sessionSiteId(String tbmSessionId) {
        return jdbc.sql("select site_id from tbm_sessions where id = :sessionId")
            .param("sessionId", parseLong(tbmSessionId, "tbmSessionId_invalid"))
            .query(Long.class)
            .optional()
            .orElseThrow(() -> new IllegalArgumentException("session_not_found"));
    }

    private StoredSignature storeSignatureIfPresent(Long siteId, Long workerId, String signatureData, String folder) {
        if (signatureData == null || signatureData.isBlank()) {
            return null;
        }
        DecodedSignature signature = decodeSignature(signatureData);
        String sha256 = sha256(signature.bytes());
        String objectKey = "sites/%d/%s/%d/%s-%s.%s".formatted(
            siteId,
            folder,
            workerId,
            UUID.randomUUID(),
            sha256,
            extensionFor(signature.mimeType())
        );
        storage.putObject(objectKey, signature.mimeType(), signature.bytes());
        Long fileObjectId = files.createReady(siteId, workerId, objectKey, sha256, signature.mimeType(), (long) signature.bytes().length, "PLEDGE_SIGNATURE");
        return new StoredSignature(fileObjectId, sha256);
    }

    private String toJson(Map<String, ?> payload) {
        try {
            return objectMapper.writeValueAsString(payload == null ? Map.of() : payload);
        } catch (Exception e) {
            throw new IllegalArgumentException("payload_invalid");
        }
    }

    private String canonicalJson(String payloadJson) {
        return jdbc.sql("select cast(cast(:payload as jsonb) as text)")
            .param("payload", payloadJson)
            .query(String.class)
            .single();
    }

    private static void requireWorker(SessionPrincipal actor) {
        if (actor == null) throw new AccessDeniedException("authentication_required");
        if (!actor.hasRole(Role.WORKER)) throw new AccessDeniedException("worker_required");
    }

    private static void requireAdmin(SessionPrincipal actor) {
        if (actor == null) throw new AccessDeniedException("authentication_required");
        boolean allowed = actor.roles().stream().anyMatch(role -> role.hasGlobalSiteScope() || role.canManageSiteUsers());
        if (!allowed) throw new AccessDeniedException("admin_required");
    }

    private static String cleanRequired(String value, String error) {
        String cleaned = value == null ? "" : value.trim();
        if (cleaned.isBlank()) throw new IllegalArgumentException(error);
        return cleaned;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String safeString(String value) {
        return value == null ? "" : value;
    }

    private static Long parseLong(String value, String error) {
        try {
            return Long.valueOf(value == null ? "" : value.trim());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(error);
        }
    }

    private static DecodedSignature decodeSignature(String signatureData) {
        String raw = cleanRequired(signatureData, "signatureData_required");
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
        if (bytes.length == 0) throw new IllegalArgumentException("signatureData_required");
        if (bytes.length > MAX_SIGNATURE_BYTES) throw new IllegalArgumentException("signature_too_large");
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

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        return realIp == null || realIp.isBlank() ? request.getRemoteAddr() : realIp;
    }

    public record PledgeCreateRequest(@JsonProperty("tbmSessionId") String tbmSessionId, @JsonProperty("siteId") String siteId, @JsonProperty("pledgeContent") String pledgeContent, @JsonProperty("nfcUid") String nfcUid, @JsonProperty("signatureData") String signatureData) {}
    public record PledgeCreateResponse(String pledgeId, String pledgeContentHash, String signatureFileId, String signatureSha256, String hashChainEventId) {}
    public record PledgeSignRequest(@JsonProperty("signatureData") String signatureData) {}
    public record PledgeSignResponse(boolean ok, String approvedAt, String hashChainEventId, String signatureFileId, String signatureSha256) {}
    public record PledgeListResponse(List<PledgePayload> pledges) {}
    public record PledgeReportResponse(Map<String, ?> session, int signedCount, int unsignedCount, List<PledgePayload> pledges, Map<String, ?> legalTbmChecklist, Map<String, ?> report) {}
    public record PledgePayload(String id, @JsonProperty("worker_id") String workerId, @JsonProperty("site_id") String siteId, @JsonProperty("pledge_content_hash") String pledgeContentHash, @JsonProperty("nfc_uid") String nfcUid, @JsonProperty("approved_at") String approved_at, @JsonProperty("hash_chain_event_id") String hashChainEventId, @JsonProperty("created_at") String createdAt, @JsonProperty("signature_file_id") String signatureFileId, @JsonProperty("signature_sha256") String signatureSha256) {}
    public record HashChainVerifyResponse(String siteId, boolean valid, List<Map<String, Object>> breaks) {}
    private record PledgeRow(Long id, String tbmSessionId, Long workerId, Long siteId, String pledgeContentHash, OffsetDateTime approvedAt) {}
    private record StoredSignature(Long fileObjectId, String sha256) {}
    private record DecodedSignature(String mimeType, byte[] bytes) {}
    private record HashChainRow(Long id, String entityType, String entityId, String eventType, String payload, String previousHash, String eventHash) {}
}
