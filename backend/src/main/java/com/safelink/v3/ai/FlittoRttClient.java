package com.safelink.v3.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.support.ServiceUnavailableException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

/** Server-only Flitto RTT bridge; the client token is never exposed to the browser. */
@Component
public class FlittoRttClient {
    private final AiProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public FlittoRttClient(AiProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public boolean isConfigured() { return properties.getFlittoApiKey() != null && !properties.getFlittoApiKey().isBlank(); }

    public Result transcribe(String base64Pcm, String sourceLanguage, List<String> requestedTargets) {
        if (!isConfigured()) throw new ServiceUnavailableException("flitto_rtt_not_configured");
        try {
            byte[] pcm = Base64.getDecoder().decode(base64Pcm);
            List<Target> targets = requestedTargets.stream().map(Target::fromRequested).filter(t -> t.flittoCode() != null).distinct().toList();
            SessionListener listener = new SessionListener(objectMapper, targets);
            String endpoint = properties.getFlittoApiBaseUrl();
            if (endpoint == null || endpoint.isBlank()) endpoint = "wss://ai-realtime-dev.flit.to/v1/realtime/speech-session";
            URI uri = URI.create(endpoint + "?token=" + URLEncoder.encode(properties.getFlittoApiKey().trim(), StandardCharsets.UTF_8));
            WebSocket socket = httpClient.newWebSocketBuilder().buildAsync(uri, listener).get(8, TimeUnit.SECONDS);
            socket.sendText(writeJson(Map.of("event", "connect", "data", Map.of("hint_lang_code_list", List.of(toFlittoLanguage(sourceLanguage)), "tgt_lang_code_list", targets.stream().map(Target::flittoCode).toList()))), true).join();
            listener.ready.get(8, TimeUnit.SECONDS);
            socket.sendText("{\"event\":\"start\"}", true).join();
            listener.started.get(8, TimeUnit.SECONDS);
            socket.sendBinary(ByteBuffer.wrap(pcm), true).join();
            socket.sendText("{\"event\":\"stop\"}", true).join();
            Result result = listener.result.get(Math.max(8, properties.getSpeechTimeoutMs() / 1000 + 3), TimeUnit.SECONDS);
            socket.sendClose(WebSocket.NORMAL_CLOSURE, "complete");
            return result;
        } catch (ServiceUnavailableException ex) { throw ex;
        } catch (Exception ex) { throw new ServiceUnavailableException("flitto_rtt_failed"); }
    }

    public static boolean supports(String language) { return toFlittoLanguage(language) != null; }
    private static String toFlittoLanguage(String language) {
        String code = language == null ? "" : language.trim().toLowerCase();
        if (code.startsWith("zh")) return "zh-CN";
        if (code.startsWith("ko")) return "ko";
        if (code.startsWith("en")) return "en";
        if (code.startsWith("ja") || code.startsWith("jp")) return "ja";
        if (code.startsWith("ru")) return "ru";
        if (code.startsWith("vi")) return "vi";
        if (code.startsWith("fr")) return "fr";
        if (code.startsWith("it")) return "it";
        if (code.startsWith("ar")) return "ar";
        if (code.startsWith("es")) return "es";
        return null;
    }
    private String writeJson(Object value) throws Exception { return objectMapper.writeValueAsString(value); }
    private record Target(String requestedCode, String flittoCode) { static Target fromRequested(String code) { return new Target(code, toFlittoLanguage(code)); } }
    public record Result(String transcript, Map<String, String> translations) {}

    private static final class SessionListener implements WebSocket.Listener {
        private final ObjectMapper mapper; private final List<Target> targets; private final StringBuilder buffer = new StringBuilder();
        private final CompletableFuture<Void> ready = new CompletableFuture<>(); private final CompletableFuture<Void> started = new CompletableFuture<>();
        private final CompletableFuture<Result> result = new CompletableFuture<>(); private String transcript = "";
        private SessionListener(ObjectMapper mapper, List<Target> targets) { this.mapper = mapper; this.targets = targets; }
        @Override public void onOpen(WebSocket socket) { socket.request(1); }
        @Override public CompletionStage<?> onText(WebSocket socket, CharSequence data, boolean last) {
            buffer.append(data); if (!last) { socket.request(1); return CompletableFuture.completedFuture(null); }
            try {
                JsonNode message = mapper.readTree(buffer.toString()); String event = message.path("event").asText(); JsonNode payload = message.path("data");
                if ("ready_for_transcript".equals(event)) ready.complete(null);
                if ("start".equals(event)) started.complete(null);
                if ("transcript_end".equals(event)) transcript = text(payload, "transcript", "text", "source_text");
                if ("finish".equals(event)) { String done = text(payload, "transcript", "text", "source_text"); if (!done.isBlank()) transcript = done; result.complete(new Result(transcript, translations(payload, targets))); }
                if ("error".equals(event)) result.completeExceptionally(new IllegalStateException("flitto_rtt_error"));
            } catch (Exception ex) { result.completeExceptionally(ex); }
            finally { buffer.setLength(0); socket.request(1); }
            return CompletableFuture.completedFuture(null);
        }
        @Override public void onError(WebSocket socket, Throwable error) { result.completeExceptionally(error); }
        private static String text(JsonNode payload, String... keys) { for (String key : keys) { String value = payload.path(key).asText("").trim(); if (!value.isBlank()) return value; } return ""; }
        private static Map<String, String> translations(JsonNode payload, List<Target> targets) {
            Map<String, String> flitto = new LinkedHashMap<>(); JsonNode list = payload.path("translation_list"); if (!list.isArray()) list = payload.path("translations");
            for (JsonNode item : list) { String code = text(item, "tgt_lang_code", "target_lang_code", "language_code", "lang_code"); String value = text(item, "translation", "translated_text", "text"); if (!code.isBlank() && !value.isBlank()) flitto.put(code, value); }
            Map<String, String> output = new LinkedHashMap<>(); for (Target target : targets) { String translated = flitto.get(target.flittoCode()); if (translated != null && !translated.isBlank()) output.put(target.requestedCode(), translated); } return output;
        }
    }
}
