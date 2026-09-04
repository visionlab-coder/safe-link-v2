package com.safelink.v3.ai;

import com.safelink.v3.audit.AuditService;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.security.SiteGuard;
import com.safelink.v3.support.ServiceUnavailableException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/ai")
public class AiGatewayController {
    private static final Set<String> SUPPORTED_FEATURES = Set.of(
        "translate",
        "stt",
        "tts",
        "realtime",
        "quiz",
        "vision",
        "romanize"
    );
    private final AiQuotaService quota;
    private final AiUsageRepository usage;
    private final AiProperties properties;
    private final SiteGuard siteGuard;
    private final AuditService audit;
    private final AiVendorService vendor;
    private final AiMediaService media;
    private final AiTranslationCacheService translationCache;

    public AiGatewayController(AiQuotaService quota, AiUsageRepository usage, AiProperties properties, SiteGuard siteGuard, AuditService audit, AiVendorService vendor, AiMediaService media, AiTranslationCacheService translationCache) {
        this.quota = quota;
        this.usage = usage;
        this.properties = properties;
        this.siteGuard = siteGuard;
        this.audit = audit;
        this.vendor = vendor;
        this.media = media;
        this.translationCache = translationCache;
    }

    @PostMapping("/translate")
    public ResponseEntity<TranslateResponse> translate(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody TranslateRequest request) {
        siteGuard.requireSiteAccess(actor, request.siteId(), "ai.translate", "site", String.valueOf(request.siteId()));
        if (actor.roles().stream().noneMatch(role -> role.canUseAi())) {
            throw new AccessDeniedException("ai_role_denied");
        }

        var decision = quota.checkAndIncrement("translate", request.siteId(), actor.userId());
        if (!decision.allowed()) {
            audit.record(actor.userId(), request.siteId(), "ai.translate", "ai_quota", decision.key(), "DENIED", "quota_exceeded", Map.of("used", decision.used(), "limit", decision.limit()));
            usage.log(actor.userId(), request.siteId(), "translate", "QUOTA", "redis", request.text().length(), 0, 0, "0");
            throw new AccessDeniedException("ai_quota_exceeded");
        }

        var cached = translationCache.get(
            request.siteId(),
            request.sourceLanguage(),
            request.targetLanguage(),
            request.text()
        );
        if (cached.isPresent()) {
            usage.log(
                actor.userId(),
                request.siteId(),
                "translate",
                "cache",
                "translation-v1",
                request.text().length(),
                cached.get().length(),
                0,
                "0"
            );
            return ResponseEntity.ok(new TranslateResponse(cached.get(), "cache", "translation-v1"));
        }

        if (!properties.isVendorEnabled()) {
            audit.record(actor.userId(), request.siteId(), "ai.translate", "ai_vendor", "disabled", "DENIED", "vendor_disabled", Map.of("feature", "translate"));
            usage.log(actor.userId(), request.siteId(), "translate", "DISABLED", "none", request.text().length(), 0, 0, "0");
            throw new ServiceUnavailableException("ai_vendor_not_configured");
        }

        Instant started = Instant.now();
        var result = vendor.translateAuto(request.text(), request.sourceLanguage(), request.targetLanguage());
        long durationMs = Duration.between(started, Instant.now()).toMillis();
        translationCache.put(request.siteId(), request.sourceLanguage(), request.targetLanguage(), request.text(), result.text());
        usage.log(actor.userId(), request.siteId(), "translate", result.vendor(), result.model(), request.text().length(), result.text().length(), durationMs, AiCostEstimator.estimate("translate", result.vendor(), request.text().length(), result.text().length()));
        audit.record(actor.userId(), request.siteId(), "ai.translate", "ai_vendor", result.vendor(), "ALLOWED", "translated", Map.of("sourceLanguage", request.sourceLanguage(), "targetLanguage", request.targetLanguage()));
        return ResponseEntity.ok(new TranslateResponse(result.text(), result.vendor(), result.model()));
    }

    @PostMapping("/internal/translate")
    public TranslateResponse internalTranslate(
        @RequestHeader(value = "X-Safe-Link-Internal-Secret", required = false) String secret,
        @Valid @RequestBody InternalTranslateRequest request
    ) {
        requireInternalSecret(secret);
        if (!properties.isVendorEnabled()) throw new ServiceUnavailableException("ai_vendor_not_configured");
        var result = switch (cleanOptional(request.provider(), "auto").toLowerCase()) {
            case "auto" -> vendor.translateAuto(request.text(), request.sourceLanguage(), request.targetLanguage());
            case "papago", "google", "openai" -> vendor.call(request.provider(), request.text(), request.sourceLanguage(), request.targetLanguage(), null, null, null);
            default -> throw new IllegalArgumentException("unsupported_ai_vendor");
        };
        return new TranslateResponse(result.text(), result.vendor(), result.model());
    }

    @PostMapping("/vendor")
    public VendorResponse vendor(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody VendorRequest request) {
        if (actor == null) {
            throw new AccessDeniedException("authentication_required");
        }
        if (actor.roles().stream().noneMatch(role -> role.canUseAi())) {
            throw new AccessDeniedException("ai_role_denied");
        }

        String feature = cleanFeature(request.feature() == null || request.feature().isBlank() ? "translate" : request.feature());
        siteGuard.requireSiteAccess(actor, request.siteId(), "ai.%s.vendor".formatted(feature), "site", String.valueOf(request.siteId()));
        var decision = quota.checkAndIncrement(feature, request.siteId(), actor.userId());
        if (!decision.allowed()) {
            audit.record(actor.userId(), request.siteId(), "ai.%s.vendor".formatted(feature), "ai_quota", decision.key(), "DENIED", "quota_exceeded", Map.of("used", decision.used(), "limit", decision.limit()));
            usage.log(actor.userId(), request.siteId(), feature, "QUOTA", "redis", safeSize((long) request.text().length()), 0, 0, "0");
            throw new AccessDeniedException("ai_quota_exceeded");
        }
        if (!properties.isVendorEnabled()) {
            audit.record(actor.userId(), request.siteId(), "ai.%s.vendor".formatted(feature), "ai_vendor", "disabled", "DENIED", "vendor_disabled", Map.of("provider", request.provider()));
            usage.log(actor.userId(), request.siteId(), feature, "DISABLED", "none", safeSize((long) request.text().length()), 0, 0, "0");
            throw new ServiceUnavailableException("ai_vendor_not_configured");
        }

        Instant started = Instant.now();
        var result = vendor.call(request.provider(), request.text(), request.sourceLanguage(), request.targetLanguage(), request.prompt(), request.maxOutputTokens(), request.temperature());
        long durationMs = Duration.between(started, Instant.now()).toMillis();
        usage.log(actor.userId(), request.siteId(), feature, result.vendor(), result.model(), request.text().length(), result.text().length(), durationMs, AiCostEstimator.estimate(feature, result.vendor(), request.text().length(), result.text().length()));
        audit.record(actor.userId(), request.siteId(), "ai.%s.vendor".formatted(feature), "ai_vendor", result.vendor(), "ALLOWED", "vendor_call", Map.of("provider", request.provider(), "model", result.model()));
        return new VendorResponse(result.text(), result.vendor(), result.model());
    }

    @PostMapping("/vision")
    public VisionResponse vision(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody VisionRequest request) {
        if (actor == null) throw new AccessDeniedException("authentication_required");
        if (actor.roles().stream().noneMatch(role -> role.canUseAi())) {
            throw new AccessDeniedException("ai_role_denied");
        }
        siteGuard.requireSiteAccess(actor, request.siteId(), "ai.vision", "site", String.valueOf(request.siteId()));
        validateImagePayload(request.image(), request.mimeType());
        if (request.image().length() > 7_000_000) {
            throw new IllegalArgumentException("vision_image_too_large");
        }
        var decision = quota.checkAndIncrement("vision", request.siteId(), actor.userId());
        if (!decision.allowed()) {
            audit.record(actor.userId(), request.siteId(), "ai.vision", "ai_quota", decision.key(), "DENIED", "quota_exceeded", Map.of("used", decision.used(), "limit", decision.limit()));
            throw new AccessDeniedException("ai_quota_exceeded");
        }
        if (!properties.isVendorEnabled()) {
            throw new ServiceUnavailableException("ai_vendor_not_configured");
        }

        Instant started = Instant.now();
        var result = vendor.analyzeImage(request.prompt(), request.image(), request.mimeType(), request.targetLanguage(), 2048);
        long durationMs = Duration.between(started, Instant.now()).toMillis();
        usage.log(actor.userId(), request.siteId(), "vision", result.vendor(), result.model(), request.image().length(), result.text().length(), durationMs, AiCostEstimator.estimate("vision", result.vendor(), request.image().length(), result.text().length()));
        audit.record(actor.userId(), request.siteId(), "ai.vision", "ai_vendor", result.vendor(), "ALLOWED", "image_analyzed", Map.of("model", result.model()));
        return new VisionResponse(result.text(), result.vendor(), result.model());
    }

    @PostMapping("/stt")
    public SttResponse stt(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody SttRequest request) {
        requireAiAccess(actor, request.siteId(), "stt");
        if (request.audio().length() > 14_000_000) throw new IllegalArgumentException("stt_audio_too_large");
        var decision = requireQuota(actor, request.siteId(), "stt", request.audio().length());
        Instant started = Instant.now();
        var result = media.transcribe(
            request.audio(),
            request.mimeType(),
            cleanOptional(request.languageCode(), "ko-KR"),
            normalizeSampleRate(request.sampleRateHertz()),
            request.live(),
            request.speechHints() == null ? List.of() : request.speechHints(),
            request.prompt(),
            request.targetLanguages() == null ? List.of() : request.targetLanguages()
        );
        long durationMs = Duration.between(started, Instant.now()).toMillis();
        usage.log(actor.userId(), request.siteId(), "stt", result.vendor(), result.model(), request.audio().length(), result.transcript().length(), durationMs, AiCostEstimator.estimate("stt", result.vendor(), request.audio().length(), result.transcript().length()));
        audit.record(actor.userId(), request.siteId(), "ai.stt", "ai_vendor", result.vendor(), "ALLOWED", "transcribed", Map.of("model", result.model(), "quotaUsed", decision.used()));
        return new SttResponse(result.transcript(), result.vendor(), result.model(), result.translations());
    }

    @PostMapping("/tts")
    public TtsResponse tts(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody TtsRequest request) {
        requireAiAccess(actor, request.siteId(), "tts");
        if (request.text().length() > 1000) throw new IllegalArgumentException("tts_text_too_long");
        var decision = requireQuota(actor, request.siteId(), "tts", request.text().length());
        Instant started = Instant.now();
        var result = media.synthesize(
            request.siteId(),
            request.text(),
            cleanOptional(request.voiceLanguageCode(), "ko-KR"),
            cleanOptional(request.voiceName(), "ko-KR-Neural2-A"),
            cleanOptional(request.gender(), "female"),
            request.preferOpenAi(),
            request.strictProvider(),
            cleanOptional(request.audioEncoding(), "MP3")
        );
        long durationMs = Duration.between(started, Instant.now()).toMillis();
        usage.log(actor.userId(), request.siteId(), "tts", result.vendor(), result.model(), request.text().length(), result.audioBase64().length(), durationMs, AiCostEstimator.estimate("tts", result.vendor(), request.text().length(), result.audioBase64().length()));
        audit.record(actor.userId(), request.siteId(), "ai.tts", "ai_vendor", result.vendor(), "ALLOWED", "synthesized", Map.of("model", result.model(), "quotaUsed", decision.used()));
        return new TtsResponse(result.audioBase64(), result.contentType(), result.vendor(), result.model());
    }

    @PostMapping("/reserve")
    public ReserveResponse reserve(@AuthenticationPrincipal SessionPrincipal actor, @Valid @RequestBody ReserveRequest request) {
        if (actor == null) {
            throw new AccessDeniedException("authentication_required");
        }
        if (actor.roles().stream().noneMatch(role -> role.canUseAi())) {
            throw new AccessDeniedException("ai_role_denied");
        }

        String feature = cleanFeature(request.feature());
        Long siteId = request.siteId() == null ? firstSiteId(actor) : request.siteId();
        if (siteId != null) {
            siteGuard.requireSiteAccess(actor, siteId, "ai.%s.reserve".formatted(feature), "site", String.valueOf(siteId));
        }

        var decision = quota.checkAndIncrement(feature, siteId, actor.userId());
        if (!decision.allowed()) {
            audit.record(actor.userId(), siteId, "ai.%s.reserve".formatted(feature), "ai_quota", decision.key(), "DENIED", "quota_exceeded", Map.of("used", decision.used(), "limit", decision.limit()));
            usage.log(actor.userId(), siteId, feature, "QUOTA", "redis", safeSize(request.inputSize()), 0, 0, "0");
            throw new AccessDeniedException("ai_quota_exceeded");
        }

        String vendor = cleanOptional(request.vendor(), "gateway");
        String model = cleanOptional(request.model(), properties.isVendorEnabled() ? "vendor_enabled" : "mock_or_fallback");
        usage.log(actor.userId(), siteId, feature, vendor, model, safeSize(request.inputSize()), safeSize(request.outputSize()), 0, "0");
        audit.record(actor.userId(), siteId, "ai.%s.reserve".formatted(feature), "ai_gateway", decision.key(), "ALLOWED", "quota_reserved", Map.of("used", decision.used(), "limit", decision.limit(), "vendor", vendor));
        return new ReserveResponse(true, feature, siteId, decision.used(), decision.limit(), properties.isVendorEnabled() ? "VENDOR_ENABLED" : "MOCK_OR_FALLBACK");
    }

    @GetMapping("/status")
    public AiStatusResponse status() {
        return new AiStatusResponse(
            properties.isVendorEnabled() ? "UP" : "MOCK_OR_FALLBACK",
            properties.isVendorEnabled(),
            properties.isFailOpenLocal(),
            properties.getDefaultWindowSeconds(),
            properties.getDefaultLimitCount(),
            List.copyOf(SUPPORTED_FEATURES)
        );
    }

    private static String cleanFeature(String feature) {
        String value = feature == null ? "" : feature.trim().toLowerCase();
        if (!SUPPORTED_FEATURES.contains(value)) {
            throw new IllegalArgumentException("unsupported_ai_feature");
        }
        return value;
    }

    private static String cleanOptional(String value, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        String cleaned = value.trim();
        return cleaned.length() > 64 ? cleaned.substring(0, 64) : cleaned;
    }

    private void requireAiAccess(SessionPrincipal actor, Long siteId, String feature) {
        if (actor == null) throw new AccessDeniedException("authentication_required");
        if (actor.roles().stream().noneMatch(role -> role.canUseAi())) {
            throw new AccessDeniedException("ai_role_denied");
        }
        siteGuard.requireSiteAccess(actor, siteId, "ai.%s".formatted(feature), "site", String.valueOf(siteId));
        if (!properties.isVendorEnabled()) throw new ServiceUnavailableException("ai_vendor_not_configured");
    }

    private AiQuotaService.QuotaDecision requireQuota(SessionPrincipal actor, Long siteId, String feature, long inputSize) {
        var decision = quota.checkAndIncrement(feature, siteId, actor.userId());
        if (!decision.allowed()) {
            audit.record(actor.userId(), siteId, "ai.%s".formatted(feature), "ai_quota", decision.key(), "DENIED", "quota_exceeded", Map.of("used", decision.used(), "limit", decision.limit()));
            usage.log(actor.userId(), siteId, feature, "QUOTA", "redis", inputSize, 0, 0, "0");
            throw new AccessDeniedException("ai_quota_exceeded");
        }
        return decision;
    }

    private static int normalizeSampleRate(Integer value) {
        return value != null && Set.of(8000, 12000, 16000, 24000, 48000).contains(value) ? value : 48000;
    }

    private void requireInternalSecret(String provided) {
        String expected = properties.getInternalGatewaySecret();
        if (expected == null || expected.isBlank() || provided == null) {
            throw new AccessDeniedException("internal_gateway_denied");
        }
        boolean matches = MessageDigest.isEqual(
            expected.getBytes(StandardCharsets.UTF_8),
            provided.getBytes(StandardCharsets.UTF_8)
        );
        if (!matches) throw new AccessDeniedException("internal_gateway_denied");
    }

    private static long safeSize(Long value) {
        return value == null || value < 0 ? 0 : value;
    }

    static void validateImagePayload(String image, String mimeType) {
        String normalizedMimeType = mimeType == null ? "" : mimeType.trim().toLowerCase();
        if (!Set.of("image/jpeg", "image/png", "image/webp").contains(normalizedMimeType)) {
            throw new IllegalArgumentException("vision_image_type_not_allowed");
        }

        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(image);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("vision_image_base64_invalid");
        }
        if (decoded.length == 0) {
            throw new IllegalArgumentException("vision_image_empty");
        }

        boolean signatureMatches = switch (normalizedMimeType) {
            case "image/jpeg" -> decoded.length >= 3
                && (decoded[0] & 0xff) == 0xff
                && (decoded[1] & 0xff) == 0xd8
                && (decoded[2] & 0xff) == 0xff;
            case "image/png" -> decoded.length >= 8
                && (decoded[0] & 0xff) == 0x89
                && decoded[1] == 0x50
                && decoded[2] == 0x4e
                && decoded[3] == 0x47
                && decoded[4] == 0x0d
                && decoded[5] == 0x0a
                && decoded[6] == 0x1a
                && decoded[7] == 0x0a;
            case "image/webp" -> decoded.length >= 12
                && decoded[0] == 'R'
                && decoded[1] == 'I'
                && decoded[2] == 'F'
                && decoded[3] == 'F'
                && decoded[8] == 'W'
                && decoded[9] == 'E'
                && decoded[10] == 'B'
                && decoded[11] == 'P';
            default -> false;
        };
        if (!signatureMatches) {
            throw new IllegalArgumentException("vision_image_signature_mismatch");
        }
    }

    private static Long firstSiteId(SessionPrincipal actor) {
        if (actor.siteIds() == null || actor.siteIds().isEmpty()) {
            return null;
        }
        return actor.siteIds().stream().sorted().findFirst().orElse(null);
    }

    public record TranslateRequest(@NotNull Long siteId, @NotBlank String sourceLanguage, @NotBlank String targetLanguage, @NotBlank String text) {}
    public record TranslateResponse(String translatedText, String vendor, String model) {}
    public record InternalTranslateRequest(@NotBlank String sourceLanguage, @NotBlank String targetLanguage, @NotBlank String text, String provider) {}
    public record VendorRequest(@NotNull Long siteId, String feature, @NotBlank String provider, @NotBlank String sourceLanguage, @NotBlank String targetLanguage, @NotBlank String text, String prompt, Integer maxOutputTokens, Double temperature) {}
    public record VendorResponse(String text, String vendor, String model) {}
    public record VisionRequest(@NotNull Long siteId, @NotBlank String image, String mimeType, String targetLanguage, @NotBlank String prompt) {}
    public record VisionResponse(String text, String vendor, String model) {}
    public record SttRequest(@NotNull Long siteId, @NotBlank String audio, String mimeType, String languageCode, Integer sampleRateHertz, boolean live, List<String> speechHints, String prompt, List<String> targetLanguages) {}
    public record SttResponse(String transcript, String vendor, String model, Map<String, String> translations) {}
    public record TtsRequest(@NotNull Long siteId, @NotBlank String text, String voiceLanguageCode, String voiceName, String gender, boolean preferOpenAi, boolean strictProvider, String audioEncoding) {}
    public record TtsResponse(String audioBase64, String contentType, String vendor, String model) {}
    public record ReserveRequest(@NotBlank String feature, Long siteId, Long inputSize, Long outputSize, String vendor, String model) {}
    public record ReserveResponse(boolean ok, String feature, Long siteId, long used, long limit, String mode) {}
    public record AiStatusResponse(String status, boolean vendorEnabled, boolean failOpenLocal, long defaultWindowSeconds, long defaultLimitCount, List<String> supportedFeatures) {}
}
