package com.safelink.v3.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.support.ServiceUnavailableException;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class AiMediaService {
    private static final Duration TTS_CACHE_TTL = Duration.ofHours(1);
    private static final int TTS_CACHE_MAX_ENTRIES = 512;

    private final AiProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final FlittoRttClient flitto;
    // OpenAI TTS는 같은 입력도 매 호출마다 음색·억양이 조금 달라질 수 있다.
    // 재생·새로고침 후에는 같은 현장/문장/음성 조합의 MP3를 재사용한다.
    private final Map<String, TtsCacheEntry> ttsCache = new ConcurrentHashMap<>();

    public AiMediaService(AiProperties properties, ObjectMapper objectMapper, FlittoRttClient flitto) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.flitto = flitto;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public SttResult transcribe(
        String audio,
        String mimeType,
        String languageCode,
        int sampleRateHertz,
        boolean live,
        List<String> speechHints,
        String prompt,
        List<String> targetLanguages
    ) {
        return switch (selectedSttProvider()) {
            case "auto" -> transcribeDefault(audio, mimeType, languageCode, sampleRateHertz, live, speechHints, prompt);
            case "google" -> transcribeGoogle(audio, mimeType, languageCode, sampleRateHertz, live, speechHints);
            case "openai" -> transcribeOpenAi(audio, mimeType, languageCode, prompt);
            case "flitto" -> transcribeFlitto(audio, mimeType, languageCode, targetLanguages);
            case "deepl" -> throw new ServiceUnavailableException("deepl_stt_adapter_not_configured");
            default -> throw new IllegalArgumentException("unsupported_stt_provider");
        };
    }

    private SttResult transcribeFlitto(String audio, String mimeType, String languageCode, List<String> targetLanguages) {
        if (mimeType == null || !mimeType.toLowerCase().contains("audio/pcm") || !FlittoRttClient.supports(languageCode)) {
            // RTT 미지원 언어(예: 크메르어)와 기존 WebM 입력은 현행 Google STT로 유지한다.
            return transcribeGoogle(audio, mimeType, languageCode, 48000, true, List.of());
        }
        FlittoRttClient.Result result = flitto.transcribe(audio, languageCode, targetLanguages == null ? List.of() : targetLanguages);
        return new SttResult(result.transcript(), "flitto", "rtt-v2", result.translations());
    }

    private SttResult transcribeDefault(
        String audio,
        String mimeType,
        String languageCode,
        int sampleRateHertz,
        boolean live,
        List<String> speechHints,
        String prompt
    ) {
        if (!live && configured(properties.getOpenAiApiKey())) {
            SttResult openAi = tryCall(() -> transcribeOpenAi(audio, mimeType, languageCode, prompt));
            if (openAi != null && !openAi.transcript().isBlank()) return openAi;
        }
        return transcribeGoogle(audio, mimeType, languageCode, sampleRateHertz, live, speechHints);
    }

    private String selectedSttProvider() {
        String value = properties.getSttProvider();
        return value == null || value.isBlank() ? "auto" : value.trim().toLowerCase();
    }

    public AudioResult synthesize(
        Long siteId,
        String text,
        String voiceLanguageCode,
        String voiceName,
        String gender,
        boolean preferOpenAi,
        boolean strictProvider,
        String audioEncoding
    ) {
        String cacheKey = ttsCacheKey(siteId, text, voiceLanguageCode, voiceName, gender, preferOpenAi, strictProvider, audioEncoding);
        Instant now = Instant.now();
        TtsCacheEntry cached = ttsCache.get(cacheKey);
        if (cached != null && cached.expiresAt().isAfter(now)) return cached.result();
        if (cached != null) ttsCache.remove(cacheKey, cached);

        AudioResult result = synthesizeUncached(text, voiceLanguageCode, voiceName, gender, preferOpenAi, strictProvider, audioEncoding);
        evictExpiredTtsCacheEntries(now);
        if (ttsCache.size() < TTS_CACHE_MAX_ENTRIES) {
            ttsCache.put(cacheKey, new TtsCacheEntry(result, now.plus(TTS_CACHE_TTL)));
        }
        return result;
    }

    private AudioResult synthesizeUncached(
        String text,
        String voiceLanguageCode,
        String voiceName,
        String gender,
        boolean preferOpenAi,
        boolean strictProvider,
        String audioEncoding
    ) {
        String encoding = "OGG_OPUS".equalsIgnoreCase(audioEncoding) ? "OGG_OPUS" : "MP3";
        if (preferOpenAi && "MP3".equals(encoding) && configured(properties.getOpenAiApiKey())) {
            AudioResult openAi = tryCall(() -> synthesizeOpenAi(text, gender, voiceLanguageCode));
            if (openAi != null && !openAi.audioBase64().isBlank()) return openAi;
            if (strictProvider) throw new ServiceUnavailableException("openai_tts_failed");
        }
        try {
            return synthesizeGoogle(text, voiceLanguageCode, voiceName, gender, encoding);
        } catch (ServiceUnavailableException googleFailure) {
            // Google Cloud TTS가 API 비활성화·키 제한·일시 장애로 실패해도
            // 설정된 OpenAI 음성으로 한 번 더 시도한다. 중국어 등 Google 우선 언어도
            // 이 경로를 타므로 앱/웹에서 무음으로 끝나지 않는다.
            if (!strictProvider && "MP3".equals(encoding) && configured(properties.getOpenAiApiKey())) {
                AudioResult openAi = tryCall(() -> synthesizeOpenAi(text, gender, voiceLanguageCode));
                if (openAi != null && !openAi.audioBase64().isBlank()) return openAi;
            }
            throw googleFailure;
        }
    }

    private void evictExpiredTtsCacheEntries(Instant now) {
        ttsCache.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
    }

    private String ttsCacheKey(
        Long siteId,
        String text,
        String voiceLanguageCode,
        String voiceName,
        String gender,
        boolean preferOpenAi,
        boolean strictProvider,
        String audioEncoding
    ) {
        String source = String.join("|", String.valueOf(siteId), text, voiceLanguageCode, voiceName,
            gender == null ? "female" : gender, String.valueOf(preferOpenAi), String.valueOf(strictProvider), audioEncoding);
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                MessageDigest.getInstance("SHA-256").digest(source.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("sha256_not_available", impossible);
        }
    }

    private record TtsCacheEntry(AudioResult result, Instant expiresAt) {}

    private SttResult transcribeOpenAi(String audio, String mimeType, String languageCode, String prompt) {
        requireConfigured(properties.getOpenAiApiKey(), "openai_stt_not_configured");
        byte[] audioBytes = decodeBase64(audio, "invalid_audio_base64");
        String boundary = "----SafeLink" + UUID.randomUUID().toString().replace("-", "");
        byte[] body = multipart(boundary, audioBytes, mimeType, languageCode, prompt);
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.openai.com/v1/audio/transcriptions"))
            .timeout(Duration.ofMillis(Math.max(500, properties.getSpeechTimeoutMs())))
            .header("Authorization", "Bearer " + properties.getOpenAiApiKey().trim())
            .header("Content-Type", "multipart/form-data; boundary=" + boundary)
            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
            .build();
        JsonNode root = sendJson(request, "openai_stt_failed");
        return new SttResult(root.path("text").asText("").trim(), "openai", "gpt-4o-mini-transcribe", Map.of());
    }

    private SttResult transcribeGoogle(String audio, String mimeType, String languageCode, int sampleRateHertz, boolean live, List<String> speechHints) {
        requireConfigured(properties.getGoogleCloudApiKey(), "google_stt_not_configured");
        String encoding = mimeType != null && mimeType.contains("ogg") ? "OGG_OPUS" : "WEBM_OPUS";
        JsonNode enhanced = callGoogleSpeech(audio, encoding, languageCode, sampleRateHertz, true, speechHints);
        String transcript = readGoogleTranscript(enhanced, live ? 0.65 : 0.6);
        if (enhanced.has("error") || transcript.isBlank()) {
            JsonNode fallback = callGoogleSpeech(audio, encoding, languageCode, sampleRateHertz, false, List.of());
            if (fallback.has("error")) throw new ServiceUnavailableException("google_stt_failed");
            transcript = readGoogleTranscript(fallback, live ? 0.65 : 0.6);
        }
        return new SttResult(transcript, "google", "speech-v1", Map.of());
    }

    private JsonNode callGoogleSpeech(String audio, String encoding, String languageCode, int sampleRateHertz, boolean enhanced, List<String> speechHints) {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("encoding", encoding);
        config.put("sampleRateHertz", sampleRateHertz);
        config.put("languageCode", languageCode);
        config.put("enableAutomaticPunctuation", true);
        config.put("model", enhanced ? "latest_long" : "default");
        if (enhanced) config.put("useEnhanced", true);
        if (enhanced && speechHints != null && !speechHints.isEmpty()) {
            config.put("speechContexts", List.of(Map.of("phrases", speechHints.stream().limit(500).toList(), "boost", 15)));
        }
        String body = writeJson(Map.of("config", config, "audio", Map.of("content", audio)));
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://speech.googleapis.com/v1/speech:recognize?key=" + encode(properties.getGoogleCloudApiKey().trim())))
            .timeout(Duration.ofMillis(Math.max(500, properties.getSpeechTimeoutMs())))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
            .build();
        return sendJson(request, "google_stt_failed");
    }

    private AudioResult synthesizeOpenAi(String text, String gender, String voiceLanguageCode) {
        requireConfigured(properties.getOpenAiApiKey(), "openai_tts_not_configured");
        String voice = "male".equalsIgnoreCase(gender) ? "onyx" : "nova";
        boolean khmer = voiceLanguageCode != null && voiceLanguageCode.toLowerCase().startsWith("km-");
        boolean simplifiedChinese = voiceLanguageCode != null && voiceLanguageCode.toLowerCase().startsWith("zh-cn");
        String model = khmer || simplifiedChinese ? "gpt-4o-mini-tts" : "tts-1-hd";
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("input", text);
        payload.put("voice", voice);
        payload.put("response_format", "mp3");
        if (khmer) {
            // GPT-4o Mini TTS에 원문 언어를 명확히 지정한다. 번역·한글 발음 표기를
            // 읽지 않고 전달된 크메르어 텍스트만 자연스럽게 발화하도록 한다.
            payload.put("instructions", "Speak the supplied Khmer (Cambodian) text naturally in Khmer. Do not translate, summarize, or add words.");
        } else if (simplifiedChinese) {
            // 보조 TTS도 중국어 UI 기준인 간체자·보통화로만 발화한다. 광둥어(yue/zh-HK)
            // 사용을 명시적으로 금지해 제공자 전환 시에도 음성 언어가 바뀌지 않게 한다.
            payload.put("instructions", "Speak the supplied Simplified Chinese text naturally in Mandarin Chinese (Putonghua). Do not use Cantonese. Do not translate, summarize, or add words.");
        }
        String body = writeJson(payload);
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.openai.com/v1/audio/speech"))
            .timeout(Duration.ofMillis(Math.max(500, properties.getTtsTimeoutMs())))
            .header("Authorization", "Bearer " + properties.getOpenAiApiKey().trim())
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
            .build();
        byte[] audio = sendBytes(request, "openai_tts_failed");
        return new AudioResult(Base64.getEncoder().encodeToString(audio), "audio/mpeg", "openai", model);
    }

    private AudioResult synthesizeGoogle(String text, String voiceLanguageCode, String voiceName, String gender, String audioEncoding) {
        requireConfigured(properties.getGoogleCloudApiKey(), "google_tts_not_configured");
        String body = writeJson(Map.of(
            "input", Map.of("text", text),
            "voice", Map.of(
                "languageCode", voiceLanguageCode,
                "name", voiceName,
                "ssmlGender", gender == null ? "FEMALE" : gender.toUpperCase()
            ),
            "audioConfig", Map.of("audioEncoding", audioEncoding, "speakingRate", 1.0, "pitch", 0)
        ));
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://texttospeech.googleapis.com/v1/text:synthesize?key=" + encode(properties.getGoogleCloudApiKey().trim())))
            .timeout(Duration.ofMillis(Math.max(500, properties.getTtsTimeoutMs())))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
            .build();
        JsonNode root = sendJson(request, "google_tts_failed");
        String audio = root.path("audioContent").asText("");
        if (audio.isBlank()) throw new ServiceUnavailableException("google_tts_empty");
        return new AudioResult(audio, "OGG_OPUS".equals(audioEncoding) ? "audio/ogg" : "audio/mpeg", "google", voiceName);
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

    private byte[] sendBytes(HttpRequest request, String errorCode) {
        try {
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ServiceUnavailableException(errorCode);
            }
            return response.body();
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
            throw new IllegalArgumentException("invalid_ai_media_payload");
        }
    }

    private static String readGoogleTranscript(JsonNode root, double confidenceThreshold) {
        List<String> segments = new ArrayList<>();
        for (JsonNode result : root.path("results")) {
            JsonNode alternative = result.path("alternatives").isArray() && !result.path("alternatives").isEmpty()
                ? result.path("alternatives").get(0)
                : null;
            if (alternative == null) continue;
            double confidence = alternative.has("confidence") ? alternative.path("confidence").asDouble() : 1.0;
            String transcript = alternative.path("transcript").asText("").trim();
            if (!transcript.isBlank() && confidence >= confidenceThreshold) segments.add(transcript);
        }
        return String.join(" ", segments).trim();
    }

    private static byte[] multipart(String boundary, byte[] audio, String mimeType, String languageCode, String prompt) {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            writeField(output, boundary, "model", "gpt-4o-mini-transcribe");
            writeField(output, boundary, "language", languageCode == null ? "ko" : languageCode.split("-")[0]);
            if (prompt != null && !prompt.isBlank()) writeField(output, boundary, "prompt", prompt);
            writeField(output, boundary, "temperature", "0");
            writeField(output, boundary, "response_format", "json");
            output.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            output.write("Content-Disposition: form-data; name=\"file\"; filename=\"audio.webm\"\r\n".getBytes(StandardCharsets.UTF_8));
            output.write(("Content-Type: " + (mimeType == null ? "audio/webm" : mimeType) + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            output.write(audio);
            output.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            return output.toByteArray();
        } catch (Exception ex) {
            throw new IllegalArgumentException("multipart_build_failed");
        }
    }

    private static void writeField(ByteArrayOutputStream output, String boundary, String name, String value) throws Exception {
        output.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(value.getBytes(StandardCharsets.UTF_8));
        output.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] decodeBase64(String value, String errorCode) {
        try {
            return Base64.getDecoder().decode(value);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(errorCode);
        }
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static void requireConfigured(String value, String errorCode) {
        if (!configured(value)) throw new ServiceUnavailableException(errorCode);
    }

    private static boolean configured(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static <T> T tryCall(MediaCall<T> call) {
        try {
            return call.run();
        } catch (RuntimeException ex) {
            return null;
        }
    }

    @FunctionalInterface
    private interface MediaCall<T> {
        T run();
    }

    public record SttResult(String transcript, String vendor, String model, Map<String, String> translations) {}
    public record AudioResult(String audioBase64, String contentType, String vendor, String model) {}
}
