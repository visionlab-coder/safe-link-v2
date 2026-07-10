package com.safelink.v3.live;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class LiveInterpreterEventBus {
    private static final long EMITTER_TIMEOUT_MS = 60 * 60 * 1000L;
    private final Map<String, CopyOnWriteArrayList<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String channel) {
        var emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        emitters.computeIfAbsent(channel, ignored -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> remove(channel, emitter));
        emitter.onTimeout(() -> remove(channel, emitter));
        emitter.onError(error -> remove(channel, emitter));
        try {
            emitter.send(SseEmitter.event().name("connected").data(Map.of("channel", channel)));
        } catch (IOException e) {
            remove(channel, emitter);
        }
        return emitter;
    }

    public void publish(String channel, String eventName, Object payload) {
        List<SseEmitter> subscribers = emitters.getOrDefault(channel, new CopyOnWriteArrayList<>());
        for (SseEmitter emitter : subscribers) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(payload));
            } catch (IOException e) {
                remove(channel, emitter);
            }
        }
    }

    public static String translationsChannel(Long siteId) {
        return "translations:" + siteId;
    }

    public static String workerResponsesChannel(Long adminId, Long siteId) {
        return "worker-responses:" + adminId + ":" + (siteId == null ? "all" : siteId);
    }

    private void remove(String channel, SseEmitter emitter) {
        var subscribers = emitters.get(channel);
        if (subscribers == null) return;
        subscribers.remove(emitter);
        if (subscribers.isEmpty()) emitters.remove(channel, subscribers);
    }
}
