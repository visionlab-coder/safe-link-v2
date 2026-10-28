package com.safelink.v3.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.support.ServiceUnavailableException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Server-only credentials and bounded, one-clip Voice sessions. No vendor tokens reach the browser. */
@Component
public class DeepLClient {
    // Application languages verified against DeepL /v3/languages on 2026-10-13.
    private static final Set<String> TEXT_LANGUAGES = Set.of("ko", "en", "zh", "vi", "th", "uz", "tl", "id", "mn", "my", "ne", "bn", "kk", "ru", "ja", "fr", "es", "ar", "hi");
    private static final Set<String> VOICE_LANGUAGES = Set.of("ko", "en", "zh", "vi", "th", "tl", "id", "bn", "ru", "ja", "fr", "es", "ar", "hi", "it");
    private final AiProperties properties;
    private final ObjectMapper mapper;
    private final HttpClient http;

    @Autowired
    public DeepLClient(AiProperties properties, ObjectMapper mapper) {
        this(properties, mapper, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
    }

    DeepLClient(AiProperties properties, ObjectMapper mapper, HttpClient http) {
        this.properties = properties;
        this.mapper = mapper;
        this.http = http;
    }

    static String language(String input) {
        String code = input == null ? "" : input.trim().toLowerCase(Locale.ROOT).split("[-_]")[0];
        return switch (code) { case "jp" -> "ja"; case "ph", "fil" -> "tl"; default -> code; };
    }

    public static boolean supportsVoice(String language) { return VOICE_LANGUAGES.contains(language(language)); }

    static String textLanguage(String input, boolean target) {
        String code = language(input);
        if (!TEXT_LANGUAGES.contains(code)) throw new IllegalArgumentException("deepl_language_unsupported");
        if (target && code.equals("zh")) return "ZH-HANS"; // Mandarin/simplified, never Cantonese.
        return code.toUpperCase(Locale.ROOT);
    }

    public AiVendorService.VendorResult translate(String text, String source, String target) {
        String sourceCode = textLanguage(source, false), targetCode = textLanguage(target, true);
        if (text == null || text.isBlank() || text.length() > 12000) throw new IllegalArgumentException("invalid_translation_text");
        if (language(source).equals(language(target))) return new AiVendorService.VendorResult(text, "identity", "same-language");
        Map<String, Object> payload = new LinkedHashMap<>(Map.of(
            "text", List.of(text), "source_lang", sourceCode, "target_lang", targetCode,
            "preserve_formatting", true, "model_type", "quality_optimized"
        ));
        String glossaryId = properties.getDeeplGlossaryId();
        boolean useGlossary = "ko".equals(language(source)) && Set.of("en", "ja", "vi", "zh").contains(language(target))
            && glossaryId != null && !glossaryId.isBlank();
        if (useGlossary) {
            if (!glossaryId.trim().matches("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")) {
                throw new ServiceUnavailableException("deepl_glossary_invalid_configuration");
            }
            payload.put("glossary_id", glossaryId.trim());
        }
        JsonNode response = post("/v2/translate", payload, "deepl_translation");
        String translated = response.path("translations").path(0).path("text").asText("");
        if (translated.isBlank()) throw new ServiceUnavailableException("deepl_translation_empty");
        return new AiVendorService.VendorResult(translated, "deepl", useGlossary ? "translate-v2-glossary" : "translate-v2");
    }

    public String transcribe(String audio, String mimeType, String source, int sampleRate) {
        if (!supportsVoice(source)) throw new IllegalArgumentException("deepl_voice_language_unsupported");
        if (mimeType == null || !mimeType.toLowerCase(Locale.ROOT).startsWith("audio/pcm") || sampleRate != 16000) {
            throw new IllegalArgumentException("deepl_pcm16_16000_required");
        }
        byte[] pcm;
        try { pcm = Base64.getDecoder().decode(audio); }
        catch (RuntimeException ex) { throw new IllegalArgumentException("invalid_audio_base64"); }
        // 30s mono PCM16; the existing recorder normally submits 2–10s clips.
        if (pcm.length == 0 || pcm.length % 2 != 0 || pcm.length > 960000) throw new IllegalArgumentException("invalid_audio_length");
        JsonNode session = post("/v3/voice/realtime", Map.of(
            "source_media_content_type", "audio/pcm;encoding=s16le;rate=16000",
            "source_language", language(source), "source_language_mode", "fixed", "message_format", "json"
        ), "deepl_voice");
        // Translation follows local glossary normalization; raw Voice translations would bypass it.
        URI uri = streamUri(session.path("streaming_url").asText(""), session.path("token").asText(""));
        VoiceListener listener = new VoiceListener(mapper);
        WebSocket socket = null;
        try {
            socket = http.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(5)).buildAsync(uri, listener).get(6, TimeUnit.SECONDS);
            for (int offset = 0; offset < pcm.length; offset += 6400) {
                if (listener.result.isCompletedExceptionally()) listener.result.get();
                byte[] chunk = Arrays.copyOfRange(pcm, offset, Math.min(pcm.length, offset + 6400));
                socket.sendText(json(Map.of("source_media_chunk", Map.of("data", Base64.getEncoder().encodeToString(chunk)))), true).get(5, TimeUnit.SECONDS);
                // DeepL permits at most 2x realtime. 200ms PCM chunks require >=100ms spacing.
                TimeUnit.MILLISECONDS.sleep((chunk.length + 63L) / 64L);
            }
            socket.sendText("{\"end_of_source_media\":{}}", true).get(5, TimeUnit.SECONDS);
            return listener.result.get(Math.max(8000, properties.getSpeechTimeoutMs()), TimeUnit.MILLISECONDS);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ServiceUnavailableException("deepl_stt_interrupted");
        } catch (Exception ex) {
            // Exceptions can contain ephemeral tokens/URLs; do not expose or log them.
            throw new ServiceUnavailableException("deepl_stt_failed");
        } finally {
            if (socket != null) socket.abort();
        }
    }

    static URI streamUri(String url, String token) {
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if (!"wss".equals(uri.getScheme()) || host == null ||
                !(host.equals("api.deepl.com") || host.endsWith(".api.deepl.com")) ||
                uri.getUserInfo() != null || uri.getPort() != -1 || uri.getFragment() != null ||
                uri.getRawQuery() != null || token.isBlank()) throw new IllegalArgumentException();
            return URI.create(url + "?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8));
        } catch (RuntimeException ex) { throw new ServiceUnavailableException("deepl_voice_invalid_session"); }
    }

    private JsonNode post(String path, Object body, String feature) {
        String key = properties.getDeeplApiKey();
        if (key == null || key.isBlank()) throw new ServiceUnavailableException("deepl_not_configured");
        String base = properties.getDeeplApiBaseUrl();
        if (!Set.of("https://api.deepl.com", "https://api-free.deepl.com").contains(base)) {
            throw new ServiceUnavailableException("deepl_invalid_endpoint");
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(base + path))
                .timeout(Duration.ofSeconds(15)).header("Authorization", "DeepL-Auth-Key " + key.trim())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json(body), StandardCharsets.UTF_8)).build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                String suffix = switch (response.statusCode()) {
                    case 401, 403 -> "authentication_failed";
                    case 429 -> "rate_limited";
                    case 456 -> "quota_exceeded";
                    default -> "failed";
                };
                throw new ServiceUnavailableException(feature + "_" + suffix);
            }
            JsonNode parsed = mapper.readTree(response.body());
            if (parsed == null || !parsed.isObject()) throw new ServiceUnavailableException(feature + "_invalid_response");
            return parsed;
        } catch (ServiceUnavailableException ex) { throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ServiceUnavailableException(feature + "_interrupted");
        } catch (Exception ex) { throw new ServiceUnavailableException(feature + "_failed"); }
    }

    private String json(Object body) {
        try { return mapper.writeValueAsString(body); }
        catch (Exception ex) { throw new IllegalArgumentException("invalid_deepl_payload"); }
    }

    static final class VoiceListener implements WebSocket.Listener {
        private final ObjectMapper mapper;
        private final StringBuilder buffer = new StringBuilder(), transcript = new StringBuilder();
        final CompletableFuture<String> result = new CompletableFuture<>();
        VoiceListener(ObjectMapper mapper) { this.mapper = mapper; }
        @Override public void onOpen(WebSocket socket) { socket.request(1); }
        @Override public CompletionStage<?> onText(WebSocket socket, CharSequence text, boolean last) {
            buffer.append(text);
            if (buffer.length() > 1024 * 1024) {
                result.completeExceptionally(new IllegalStateException("deepl_message_too_large"));
                socket.abort();
            } else if (last) {
                try {
                    JsonNode message = mapper.readTree(buffer.toString());
                    if (message.has("error")) result.completeExceptionally(new IllegalStateException("deepl_voice_error"));
                    // Tentative segments can be revised. Only concluded segments enter the final record.
                    for (JsonNode segment : message.path("source_transcript_update").path("concluded")) {
                        transcript.append(segment.path("text").asText(""));
                    }
                    if (message.has("end_of_stream")) result.complete(transcript.toString().trim());
                } catch (Exception ex) { result.completeExceptionally(new IllegalStateException("deepl_invalid_message")); }
                finally { buffer.setLength(0); }
            }
            socket.request(1);
            return CompletableFuture.completedFuture(null);
        }
        @Override public CompletionStage<?> onClose(WebSocket socket, int code, String reason) {
            if (!result.isDone()) result.completeExceptionally(new IllegalStateException("deepl_stream_incomplete"));
            return CompletableFuture.completedFuture(null);
        }
        @Override public void onError(WebSocket socket, Throwable error) {
            result.completeExceptionally(new IllegalStateException("deepl_stream_failed"));
        }
    }
}
