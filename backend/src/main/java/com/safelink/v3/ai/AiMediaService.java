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
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class AiMediaService {
    private final AiProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public AiMediaService(AiProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public SttResult transcribe(
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

    public AudioResult synthesize(
        String text,
        String voiceLanguageCode,
        String voiceName,
        String gender,
        boolean preferOpenAi,
        String audioEncoding
    ) {
        String encoding = "OGG_OPUS".equalsIgnoreCase(audioEncoding) ? "OGG_OPUS" : "MP3";
        if (preferOpenAi && "MP3".equals(encoding) && configured(properties.getOpenAiApiKey())) {
            AudioResult openAi = tryCall(() -> synthesizeOpenAi(text, gender));
            if (openAi != null && !openAi.audioBase64().isBlank()) return openAi;
        }
        try {
            return synthesizeGoogle(text, voiceLanguageCode, voiceName, gender, encoding);
        } catch (ServiceUnavailableException googleFailure) {
            // Google Cloud TTS가 API 비활성화·키 제한·일시 장애로 실패해도
            // 설정된 OpenAI 음성으로 한 번 더 시도한다. 중국어 등 Google 우선 언어도
            // 이 경로를 타므로 앱/웹에서 무음으로 끝나지 않는다.
            if ("MP3".equals(encoding) && configured(properties.getOpenAiApiKey())) {
                AudioResult openAi = tryCall(() -> synthesizeOpenAi(text, gender));
                if (openAi != null && !openAi.audioBase64().isBlank()) return openAi;
            }
            throw googleFailure;
        }
    }

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
        return new SttResult(root.path("text").asText("").trim(), "openai", "gpt-4o-mini-transcribe");
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
        return new SttResult(transcript, "google", "speech-v1");
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

    private AudioResult synthesizeOpenAi(String text, String gender) {
        requireConfigured(properties.getOpenAiApiKey(), "openai_tts_not_configured");
        String voice = "male".equalsIgnoreCase(gender) ? "onyx" : "nova";
        String body = writeJson(Map.of(
            "model", "tts-1-hd",
            "input", text,
            "voice", voice,
            "response_format", "mp3"
        ));
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("https://api.openai.com/v1/audio/speech"))
            .timeout(Duration.ofMillis(Math.max(500, properties.getTtsTimeoutMs())))
            .header("Authorization", "Bearer " + properties.getOpenAiApiKey().trim())
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
            .build();
        byte[] audio = sendBytes(request, "openai_tts_failed");
        return new AudioResult(Base64.getEncoder().encodeToString(audio), "audio/mpeg", "openai", "tts-1-hd");
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

    public record SttResult(String transcript, String vendor, String model) {}
    public record AudioResult(String audioBase64, String contentType, String vendor, String model) {}
}
