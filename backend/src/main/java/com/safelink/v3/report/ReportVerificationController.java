package com.safelink.v3.report;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.ai.AiProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/reports")
public class ReportVerificationController {
    private static final Set<String> REPORT_TYPES = Set.of("tbm", "safety_edu", "pledge", "incident", "esg");
    private final JdbcClient jdbc;
    private final ObjectMapper objectMapper;
    private final AiProperties properties;

    public ReportVerificationController(JdbcClient jdbc, ObjectMapper objectMapper, AiProperties properties) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    @PostMapping("/internal/verification-code")
    @Transactional
    public Map<String, Object> issue(
        @RequestHeader(value = "X-Safe-Link-Internal-Secret", required = false) String secret,
        @RequestBody IssueRequest request
    ) {
        requireInternalSecret(secret);
        validateReport(request.reportId(), request.reportHash(), request.reportType());
        Long siteId = parseSiteId(request.siteId());
        String payloadJson = writeJson(request.payload());
        String perceptualHash = perceptualHash(request.payload());
        jdbc.sql("""
                insert into legal_report_exports(report_id, report_type, site_id, payload, report_hash_alg, report_hash)
                values (:reportId, :reportType, :siteId, cast(:payload as jsonb), 'SHA-256', :reportHash)
                on conflict (report_id) do update set
                    report_type = excluded.report_type,
                    site_id = excluded.site_id,
                    payload = excluded.payload,
                    report_hash = excluded.report_hash
            """)
            .param("reportId", request.reportId())
            .param("reportType", request.reportType())
            .param("siteId", siteId)
            .param("payload", payloadJson)
            .param("reportHash", request.reportHash())
            .update();
        jdbc.sql("""
                insert into report_verification_codes(report_id, verification_url, qr_code_svg, perceptual_hash, report_type, site_id)
                values (:reportId, :verificationUrl, :qrCodeSvg, :perceptualHash, :reportType, :siteId)
                on conflict (report_id) do update set
                    verification_url = excluded.verification_url,
                    qr_code_svg = excluded.qr_code_svg,
                    perceptual_hash = excluded.perceptual_hash,
                    report_type = excluded.report_type,
                    site_id = excluded.site_id
            """)
            .param("reportId", request.reportId())
            .param("verificationUrl", request.verificationUrl())
            .param("qrCodeSvg", request.qrCodeSvg())
            .param("perceptualHash", perceptualHash)
            .param("reportType", request.reportType())
            .param("siteId", siteId)
            .update();
        return Map.of("ok", true, "perceptualHash", perceptualHash);
    }

    @GetMapping("/public/{reportId}/verify")
    @Transactional
    public ResponseEntity<Map<String, Object>> verify(
        @PathVariable String reportId,
        @RequestParam(required = false, name = "h") String providedHash
    ) {
        if (!validReportId(reportId)) {
            return ResponseEntity.badRequest().body(Map.of("ok", false, "error", "invalid_report_id"));
        }
        var row = jdbc.sql("""
                select l.report_id, l.report_type, l.site_id, l.payload::text as payload,
                       l.report_hash, l.created_at, l.retention_until, v.perceptual_hash
                from legal_report_exports l
                left join report_verification_codes v on v.report_id = l.report_id
                where l.report_id = :reportId
            """)
            .param("reportId", reportId)
            .query((rs, rowNum) -> new VerificationRow(
                rs.getString("report_id"),
                rs.getString("report_type"),
                rs.getObject("site_id", Long.class),
                rs.getString("payload"),
                rs.getString("report_hash"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("retention_until") == null ? null : rs.getTimestamp("retention_until").toInstant(),
                rs.getString("perceptual_hash")
            ))
            .optional();
        if (row.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("ok", false, "error", "report_not_found"));
        }
        VerificationRow value = row.get();
        jdbc.sql("""
                update report_verification_codes
                set last_verified_at = now(), verify_count = verify_count + 1
                where report_id = :reportId
            """)
            .param("reportId", reportId)
            .update();
        String currentPerceptual = perceptualHash(readJson(value.payload()));

        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("report_id", value.reportId());
        envelope.put("report_type", value.reportType());
        envelope.put("site_id", value.siteId() == null ? null : String.valueOf(value.siteId()));
        envelope.put("created_at", value.createdAt().toString());
        envelope.put("retention_until", value.retentionUntil() == null ? null : value.retentionUntil().toString());

        Map<String, Object> integrity = new LinkedHashMap<>();
        integrity.put("sha256_hash_match", providedHash == null ? null : providedHash.equals(value.reportHash()));
        integrity.put("perceptual_hash_match", value.perceptualHash() == null ? null : currentPerceptual.equals(value.perceptualHash()));
        integrity.put("current_perceptual_hash", currentPerceptual);
        integrity.put("original_perceptual_hash", value.perceptualHash());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", true);
        body.put("status", 200);
        body.put("envelope", envelope);
        body.put("integrity", integrity);
        return ResponseEntity.ok(body);
    }

    private String perceptualHash(Object payload) {
        try {
            String canonical = objectMapper.writeValueAsString(canonicalize(objectMapper.valueToTree(payload)));
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte value : digest) hex.append("%02x".formatted(value));
            return hex.substring(0, 16);
        } catch (Exception ex) {
            throw new IllegalArgumentException("report_hash_failed");
        }
    }

    private Object canonicalize(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (node.isArray()) {
            List<Object> values = new ArrayList<>();
            node.forEach(item -> values.add(canonicalize(item)));
            return values;
        }
        if (node.isObject()) {
            Map<String, Object> values = new LinkedHashMap<>();
            List<String> names = new ArrayList<>();
            node.fieldNames().forEachRemaining(names::add);
            names.sort(Comparator.naturalOrder());
            for (String name : names) values.put(name, canonicalize(node.get(name)));
            return values;
        }
        if (node.isNumber()) return node.numberValue();
        if (node.isBoolean()) return node.booleanValue();
        return node.asText();
    }

    private JsonNode readJson(String value) {
        try {
            return objectMapper.readTree(value == null ? "{}" : value);
        } catch (Exception ex) {
            return objectMapper.createObjectNode();
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (Exception ex) {
            throw new IllegalArgumentException("report_payload_invalid");
        }
    }

    private void validateReport(String reportId, String reportHash, String reportType) {
        if (!validReportId(reportId)) throw new IllegalArgumentException("invalid_report_id");
        if (reportHash == null || !reportHash.matches("^[0-9a-f]{64}$")) throw new IllegalArgumentException("invalid_report_hash");
        if (!REPORT_TYPES.contains(reportType)) throw new IllegalArgumentException("invalid_report_type");
    }

    private static boolean validReportId(String reportId) {
        return reportId != null && reportId.matches("^[a-zA-Z0-9_-]{1,120}$");
    }

    private static Long parseSiteId(String siteId) {
        if (siteId == null || siteId.isBlank()) return null;
        try {
            return Long.valueOf(siteId.trim());
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("invalid_site_id");
        }
    }

    private void requireInternalSecret(String provided) {
        String expected = properties.getInternalGatewaySecret();
        if (expected == null || expected.isBlank() || provided == null || !MessageDigest.isEqual(
            expected.getBytes(StandardCharsets.UTF_8),
            provided.getBytes(StandardCharsets.UTF_8)
        )) {
            throw new AccessDeniedException("internal_gateway_denied");
        }
    }

    public record IssueRequest(String reportId, String reportHash, String reportType, String siteId, Object payload, String verificationUrl, String qrCodeSvg) {}
    private record VerificationRow(String reportId, String reportType, Long siteId, String payload, String reportHash, Instant createdAt, Instant retentionUntil, String perceptualHash) {}
}
