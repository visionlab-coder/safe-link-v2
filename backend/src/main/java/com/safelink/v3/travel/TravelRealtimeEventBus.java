package com.safelink.v3.travel;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class TravelRealtimeEventBus {
    private static final long EMITTER_TIMEOUT_MS = 60 * 60 * 1000L;
    private final Map<String, CopyOnWriteArrayList<SseEmitter>> rooms = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String room) {
        var emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        rooms.computeIfAbsent(room, ignored -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> remove(room, emitter));
        emitter.onTimeout(() -> remove(room, emitter));
        emitter.onError(error -> remove(room, emitter));
        try {
            emitter.send(SseEmitter.event().name("connected").data(Map.of("room", room)));
        } catch (IOException e) {
            remove(room, emitter);
        }
        return emitter;
    }

    public void publish(String room, String eventName, Object payload) {
        List<SseEmitter> subscribers = rooms.getOrDefault(room, new CopyOnWriteArrayList<>());
        for (SseEmitter emitter : subscribers) {
            try {
                emitter.send(SseEmitter.event().name(eventName).data(payload));
            } catch (IOException e) {
                remove(room, emitter);
            }
        }
    }

    private void remove(String room, SseEmitter emitter) {
        var subscribers = rooms.get(room);
        if (subscribers == null) return;
        subscribers.remove(emitter);
        if (subscribers.isEmpty()) rooms.remove(room, subscribers);
    }
}
