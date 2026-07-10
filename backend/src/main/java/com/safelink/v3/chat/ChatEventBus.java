package com.safelink.v3.chat;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Component
public class ChatEventBus {
    private final Map<Long, CopyOnWriteArrayList<SseEmitter>> emitters = new ConcurrentHashMap<>();
    private final Map<Long, CopyOnWriteArrayList<SseEmitter>> userEmitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long threadId) {
        var emitter = new SseEmitter(60 * 60 * 1000L);
        emitters.computeIfAbsent(threadId, ignored -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> remove(threadId, emitter));
        emitter.onTimeout(() -> remove(threadId, emitter));
        emitter.onError(error -> remove(threadId, emitter));
        try {
            emitter.send(SseEmitter.event().name("connected").data(Map.of("threadId", threadId)));
        } catch (IOException e) {
            remove(threadId, emitter);
        }
        return emitter;
    }

    public void publish(Long threadId, Object payload) {
        List<SseEmitter> list = emitters.getOrDefault(threadId, new CopyOnWriteArrayList<>());
        for (SseEmitter emitter : list) {
            try {
                emitter.send(SseEmitter.event().name("message").data(payload));
            } catch (IOException e) {
                remove(threadId, emitter);
            }
        }
    }

    public SseEmitter subscribeUser(Long userId) {
        var emitter = new SseEmitter(60 * 60 * 1000L);
        userEmitters.computeIfAbsent(userId, ignored -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> removeUser(userId, emitter));
        emitter.onTimeout(() -> removeUser(userId, emitter));
        emitter.onError(error -> removeUser(userId, emitter));
        try {
            emitter.send(SseEmitter.event().name("connected").data(Map.of("userId", userId)));
        } catch (IOException e) {
            removeUser(userId, emitter);
        }
        return emitter;
    }

    public void publishUser(Long userId, Object payload) {
        List<SseEmitter> subscribers = userEmitters.getOrDefault(userId, new CopyOnWriteArrayList<>());
        for (SseEmitter emitter : subscribers) {
            try {
                emitter.send(SseEmitter.event().name("message").data(payload));
            } catch (IOException e) {
                removeUser(userId, emitter);
            }
        }
    }

    private void remove(Long threadId, SseEmitter emitter) {
        var list = emitters.get(threadId);
        if (list != null) {
            list.remove(emitter);
        }
    }

    private void removeUser(Long userId, SseEmitter emitter) {
        var subscribers = userEmitters.get(userId);
        if (subscribers == null) return;
        subscribers.remove(emitter);
        if (subscribers.isEmpty()) userEmitters.remove(userId, subscribers);
    }
}
