package com.safelink.v3.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.support.ServiceUnavailableException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class AiVendorService {
    private static final Set<String> PAPAGO_LANGS = Set.of("ko", "en", "zh-CN", "vi", "id", "th", "ru", "ja", "fr", "es");

    private final AiProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public AiVendorService(AiProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public VendorResult translateAuto(String text, String sourceLanguage, String targetLanguage) {
        return switch (selectedTranslationProvider()) {
            case "auto" -> translateDefault(text, sourceLanguage, targetLanguage);
            case "papago" -> translatePapago(text, sourceLanguage, targetLanguage);
            case "google" -> translateGoogle(text, sourceLanguage, targetLanguage);
            case "openai" -> generateOpenAi(translationPrompt(text, sourceLanguage, targetLanguage), 1024, 0.2);
            // 실제 API 규격·권한이 도착하기 전에는 기존 엔진으로 조용히 폴백하지 않습니다.
            // 그래야 플리토/DeepL 비교 기간에 다른 공급자를 쓴 결과가 섞이지 않습니다.
            case "flitto", "deepl" -> throw new ServiceUnavailableException(selectedTranslationProvider() + "_translation_adapter_not_configured");
            default -> throw new IllegalArgumentException("unsupported_translation_provider");
        };
    }

    private VendorResult translateDefault(String text, String sourceLanguage, String targetLanguage) {
        if (canUsePapago(sourceLanguage, targetLanguage)) {
            VendorResult papago = tryVendor(() -> translatePapago(text, sourceLanguage, targetLanguage));
            if (hasText(papago)) return papago;
        }

        return translateGoogle(text, sourceLanguage, targetLanguage);
    }

    private String selectedTranslationProvider() {
        String value = properties.getTranslationProvider();
        return value == null || value.isBlank() ? "auto" : value.trim().toLowerCase();
    }

    public VendorResult call(String provider, String text, String sourceLanguage, String targetLanguage, String prompt, Integer maxOutputTokens, Double temperature) {
        String normalized = provider == null ? "" : provider.trim().toLowerCase();
        return switch (normalized) {
            case "papago" -> translatePapago(text, sourceLanguage, targetLanguage);
            case "google" -> translateGoogle(text, sourceLanguage, targetLanguage);
            case "openai", "openai-prompt" -> generateOpenAi(prompt == null || prompt.isBlank()
                ? translationPrompt(text, sourceLanguage, targetLanguage)
                : prompt, maxOutputTokens == null ? 1024 : maxOutputTokens, temperature == null ? 0.2 : temperature);
            default -> throw new IllegalArgumentException("unsupported_ai_vendor");
        };
    }

    public boolean canUsePapago(String sourceLanguage, String targetLanguage) {
        return configured(properties.getNaverClientId())
            && configured(properties.getNaverClientSecret())
            && PAPAGO_LANGS.contains(sourceLanguage)
            && PAPAGO_LANGS.contains(targetLanguage);
    }

    public VendorResult analyzeImage(String prompt, String base64Image, String mimeType, String targetLanguage, int maxOutputTokens) {
        if (configured(properties.getOpenAiApiKey())) {
            VendorResult openAi = tryVendor(() -> analyzeOpenAiImage(prompt, base64Image, mimeType, maxOutputTokens));
            if (hasText(openAi)) return openAi;
        }
        return analyzeGoogleVision(base64Image, targetLanguage);
    }

    private VendorResult analyzeOpenAiImage(String prompt, String base64Image, String mimeType, int maxOutputTokens) {
        requireConfigured(properties.getOpenAiApiKey(), "openai_not_configured");
        String model = properties.getOpenAiVisionModel() == null || properties.getOpenAiVisionModel().isBlank()
            ? "gpt-4o-mini"
            : properties.getOpenAiVisionModel().trim();
        String safeMimeType = mimeType == null || !mimeType.matches("^image/[a-zA-Z0-9.+-]+$")
            ? "image/jpeg"
            : mimeType;
        String body = writeJson(Map.of(
            "model", model,
            "input", new Object[] {
                Map.of(
                    "role", "user",
                    "content", new Object[] {
                        Map.of("type", "input_text", "text", prompt),
                        Map.of("type", "input_image", "image_url", "data:" + safeMimeType + ";base64," + base64Image, "detail", "high")
                    }
                )
            },
            "max_output_tokens", Math.max(1, Math.min(maxOutputTokens, 4096))
        ));
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.openai.com/v1/responses"))
            .timeout(Duration.ofMillis(Math.max(500, properties.getOpenAiTimeoutMs())))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + properties.getOpenAiApiKey().trim())
            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
            .build();
        String text = extractOpenAiText(sendJson(request, "openai_vision_failed"));
        return new VendorResult(text, "openai", model);
    }

    private VendorResult analyzeGoogleVision(String base64Image, String targetLanguage) {
        requireConfigured(properties.getGoogleCloudApiKey(), "google_vision_not_configured");
        String body = writeJson(Map.of(
            "requests", List.of(Map.of(
                "image", Map.of("content", base64Image),
                "features", List.of(
                    Map.of("type", "OBJECT_LOCALIZATION", "maxResults", 12),
                    Map.of("type", "LABEL_DETECTION", "maxResults", 12)
                )
            ))
        ));
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://vision.googleapis.com/v1/images:annotate?key=" + encode(properties.getGoogleCloudApiKey().trim())))
            .timeout(Duration.ofMillis(Math.max(500, properties.getOpenAiTimeoutMs())))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
            .build();
        JsonNode root = sendJson(request, "google_vision_failed");
        JsonNode response = root.path("responses").isArray() && !root.path("responses").isEmpty()
            ? root.path("responses").get(0)
            : null;
        if (response == null) return new VendorResult("[]", "google", "cloud-vision-v1");

        List<String> labels = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (JsonNode item : response.path("localizedObjectAnnotations")) {
            addLabel(labels, seen, item.path("name").asText(""));
        }
        for (JsonNode item : response.path("labelAnnotations")) {
            addLabel(labels, seen, item.path("description").asText(""));
        }

        String target = targetLanguage == null || targetLanguage.isBlank() ? "ko" : targetLanguage;
        List<Map<String, String>> items = new ArrayList<>();
        for (String label : labels.stream().limit(8).toList()) {
            String risk = riskLevel(label);
            String category = category(label);
            String nameKo = translatedOr(label, "en", "ko", label);
            String nameLocal = "ko".equals(target) ? nameKo : translatedOr(label, "en", target, label);
            String noteKo = "danger".equals(risk)
                ? "즉시 작업을 멈추고 위험 요소를 확인하세요."
                : "caution".equals(risk)
                    ? "작업 전 안전 상태와 보호구를 확인하세요."
                    : "안전 기준에 맞게 사용하고 상태를 점검하세요.";
            String noteLocal = "ko".equals(target) ? noteKo : translatedOr(noteKo, "ko", target, noteKo);
            Map<String, String> item = new LinkedHashMap<>();
            item.put("name_ko", nameKo);
            item.put("name_local", nameLocal);
            item.put("category", category);
            item.put("risk_level", risk);
            item.put("safety_note_ko", noteKo);
            item.put("safety_note_local", noteLocal);
            items.add(item);
        }
        return new VendorResult(writeJson(items), "google", "cloud-vision-v1");
    }

    private String translatedOr(String text, String source, String target, String fallback) {
        VendorResult result = tryVendor(() -> translateGoogle(text, source, target));
        return hasText(result) ? result.text() : fallback;
    }

    private static void addLabel(List<String> labels, Set<String> seen, String label) {
        String cleaned = label == null ? "" : label.trim();
        if (!cleaned.isBlank() && seen.add(cleaned.toLowerCase())) labels.add(cleaned);
    }

    private static String category(String label) {
        String value = label.toLowerCase();
        if (containsAny(value, "helmet", "hard hat", "glove", "vest", "mask", "goggles")) return "ppe";
        if (containsAny(value, "scaffold", "building", "structure", "wall", "roof", "stairs")) return "structure";
        if (containsAny(value, "wood", "steel", "metal", "concrete", "brick", "pipe")) return "material";
        if (containsAny(value, "tool", "drill", "hammer", "saw", "wrench")) return "tool";
        if (containsAny(value, "fire", "smoke", "electric", "hazard")) return "hazard";
        return "equipment";
    }

    private static String riskLevel(String label) {
        String value = label.toLowerCase();
        if (containsAny(value, "fire", "flame", "smoke", "explosion")) return "danger";
        if (containsAny(value, "scaffold", "ladder", "crane", "truck", "electric", "machine", "heavy equipment")) return "caution";
        return "safe";
    }

    private static boolean containsAny(String value, String... terms) {
        for (String term : terms) if (value.contains(term)) return true;
        return false;
    }

    private VendorResult translatePapago(String text, String sourceLanguage, String targetLanguage) {
        requireConfigured(properties.getNaverClientId(), "papago_not_configured");
        requireConfigured(properties.getNaverClientSecret(), "papago_not_configured");
        String body = "source=%s&target=%s&text=%s".formatted(
            encode(sourceLanguage),
            encode(targetLanguage),
            encode(text)
        );
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://papago.apigw.ntruss.com/nmt/v1/translation"))
            .timeout(Duration.ofMillis(Math.max(500, properties.getPapagoTimeoutMs())))
            .header("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
            .header("X-NCP-APIGW-API-KEY-ID", properties.getNaverClientId().trim())
            .header("X-NCP-APIGW-API-KEY", properties.getNaverClientSecret().trim())
            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
            .build();
        JsonNode root = sendJson(request, "papago_failed");
        String translated = root.path("message").path("result").path("translatedText").asText("");
        return new VendorResult(translated, "papago", "nmt");
    }

    private VendorResult translateGoogle(String text, String sourceLanguage, String targetLanguage) {
        requireConfigured(properties.getGoogleCloudApiKey(), "google_translate_not_configured");
        String body = writeJson(Map.of(
            "q", text,
            "source", sourceLanguage,
            "target", targetLanguage,
            "format", "text"
        ));
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://translation.googleapis.com/language/translate/v2?key=" + encode(properties.getGoogleCloudApiKey().trim())))
            .timeout(Duration.ofMillis(Math.max(500, properties.getGoogleTimeoutMs())))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
            .build();
        JsonNode root = sendJson(request, "google_translate_failed");
        JsonNode first = root.path("data").path("translations").isArray() && !root.path("data").path("translations").isEmpty()
            ? root.path("data").path("translations").get(0)
            : null;
        String translated = first == null ? "" : first.path("translatedText").asText("");
        return new VendorResult(translated, "google", "cloud-translate-v2");
    }

    private VendorResult generateOpenAi(String prompt, int maxOutputTokens, double temperature) {
        requireConfigured(properties.getOpenAiApiKey(), "openai_not_configured");
        String model = properties.getOpenAiTextModel() == null || properties.getOpenAiTextModel().isBlank()
            ? "gpt-4o-mini"
            : properties.getOpenAiTextModel().trim();
        String body = writeJson(Map.of(
            "model", model,
            "input", prompt,
            "temperature", temperature,
            "max_output_tokens", Math.max(1, Math.min(maxOutputTokens, 4096))
        ));
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.openai.com/v1/responses"))
            .timeout(Duration.ofMillis(Math.max(500, properties.getOpenAiTimeoutMs())))
            .header("Content-Type", "application/json")
            .header("Authorization", "Bearer " + properties.getOpenAiApiKey().trim())
            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
            .build();
        JsonNode root = sendJson(request, "openai_failed");
        String text = extractOpenAiText(root);
        return new VendorResult(text, "openai", model);
    }

    private static String extractOpenAiText(JsonNode root) {
        String text = root.path("output_text").asText("");
        if (text.isBlank()) {
            for (JsonNode output : root.path("output")) {
                for (JsonNode content : output.path("content")) {
                    if ("output_text".equals(content.path("type").asText())) {
                        text = content.path("text").asText("");
                        if (!text.isBlank()) break;
                    }
                }
                if (!text.isBlank()) break;
            }
        }
        return text == null ? "" : text.trim();
    }

    private JsonNode sendJson(HttpRequest request, String errorCode) {
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ServiceUnavailableException(errorCode);
            }
            return objectMapper.readTree(response.body());
        } catch (ServiceUnavailableException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ServiceUnavailableException(errorCode);
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new IllegalArgumentException("invalid_ai_vendor_payload");
        }
    }

    private static VendorResult tryVendor(VendorCall call) {
        try {
            return call.run();
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static boolean hasText(VendorResult result) {
        return result != null && result.text() != null && !result.text().isBlank();
    }

    private static String translationPrompt(String text, String sourceLanguage, String targetLanguage) {
        return """
            You are a construction-site safety interpreter.
            Translate from %s to %s.
            Preserve numbers, names, equipment names, floor names, measurements, and safety warnings.
            Return only the translated text.

            Text: %s
            """.formatted(sourceLanguage, targetLanguage, text);
    }

    private static void requireConfigured(String value, String errorCode) {
        if (!configured(value)) {
            throw new ServiceUnavailableException(errorCode);
        }
    }

    private static boolean configured(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    @FunctionalInterface
    private interface VendorCall {
        VendorResult run();
    }

    public record VendorResult(String text, String vendor, String model) {}
}
