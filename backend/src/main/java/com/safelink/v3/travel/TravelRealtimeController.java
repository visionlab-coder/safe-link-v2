package com.safelink.v3.travel;

import com.safelink.v3.ai.AiProperties;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.Set;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/travel/internal")
public class TravelRealtimeController {
    private static final Set<String> EVENTS = Set.of("partner-joined", "new-message", "speaking-start", "speaking-end");
    private final TravelRealtimeEventBus eventBus;
    private final AiProperties properties;

    public TravelRealtimeController(TravelRealtimeEventBus eventBus, AiProperties properties) {
        this.eventBus = eventBus;
        this.properties = properties;
    }

    @GetMapping("/events")
    public SseEmitter events(
        @RequestHeader(value = "X-Safe-Link-Internal-Secret", required = false) String secret,
        @RequestParam String room
    ) {
        requireInternalSecret(secret);
        return eventBus.subscribe(cleanRoom(room));
    }

    @PostMapping("/signal")
    public Map<String, Boolean> signal(
        @RequestHeader(value = "X-Safe-Link-Internal-Secret", required = false) String secret,
        @RequestBody SignalRequest request
    ) {
        requireInternalSecret(secret);
        String event = request.event() == null ? "" : request.event().trim();
        if (!EVENTS.contains(event)) throw new IllegalArgumentException("travel_event_invalid");
        eventBus.publish(cleanRoom(request.room()), event, Map.of(
            "senderId", cleanSender(request.senderId()),
            "payload", request.payload() == null ? Map.of() : request.payload()
        ));
        return Map.of("ok", true);
    }

    private String cleanRoom(String room) {
        if (room == null || !room.matches("^[0-9]{4}$")) throw new IllegalArgumentException("travel_room_invalid");
        return room;
    }

    private String cleanSender(String senderId) {
        if (senderId == null || !senderId.matches("^[a-zA-Z0-9_-]{8,80}$")) {
            throw new IllegalArgumentException("travel_sender_invalid");
        }
        return senderId;
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

    public record SignalRequest(String room, String event, String senderId, Map<String, Object> payload) {}
}
