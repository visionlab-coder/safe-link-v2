package com.safelink.v3.travel;

import com.safelink.v3.ai.AiProperties;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** A guest capability, not a SQ-LINK user/session. Redis failure must fail closed. */
@Service
public class FreeTalkAccess {
    public static final String COOKIE = "SAFE_LINK_FREE_TALK";
    public static final Duration LIFETIME = Duration.ofHours(2);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final DefaultRedisScript<Long> COUNT = new DefaultRedisScript<>(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", Long.class);
    private final StringRedisTemplate redis;
    private final AiProperties ai;
    private final long dailyLimit;

    public FreeTalkAccess(StringRedisTemplate redis, AiProperties ai,
        @Value("${safe-link.free-talk.daily-call-limit:10000}") long dailyLimit) {
        this.redis = redis; this.ai = ai; this.dailyLimit = dailyLimit;
    }

    public void gateway(HttpServletRequest request) {
        String expected = ai.getInternalGatewaySecret();
        String supplied = request.getHeader("X-Safe-Link-Internal-Secret");
        if (expected == null || expected.isBlank() || supplied == null || !MessageDigest.isEqual(
            expected.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "free_talk_gateway_denied");
        }
    }

    public String existing(HttpServletRequest request) {
        String token = request.getHeader("X-Free-Talk-Session");
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) return null;
        return Boolean.TRUE.equals(redis.hasKey("free-talk:session:" + token)) ? token : null;
    }

    public String require(HttpServletRequest request) {
        gateway(request);
        String token = existing(request);
        if (token == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "free_talk_session_expired");
        limit("requests:" + token, 600, 60);
        return token;
    }

    public String start(HttpServletRequest request) {
        gateway(request);
        String existing = existing(request);
        if (existing != null) return existing;
        limit("session-ip:" + peer(request), 10, 3600);
        limit("sessions-global", 1000, 3600);
        byte[] bytes = new byte[32]; RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        redis.opsForValue().set("free-talk:session:" + token, "guest", LIFETIME);
        return token;
    }

    public void paid(HttpServletRequest request, String token) {
        if (!ai.isVendorEnabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "ai_vendor_not_configured");
        limit("paid-minute:" + token, 240, 60);
        limit("paid-hour:" + token, 3600, 3600);
        limit("paid-ip:" + peer(request), 7200, 3600);
        limit("paid-global", dailyLimit, 86400);
    }

    public void limit(String scope, long maximum, int seconds) {
        Long count = redis.execute(COUNT, List.of("free-talk:limit:" + scope), String.valueOf(seconds));
        if (count == null || count > maximum) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "free_talk_rate_limited");
    }

    private String peer(HttpServletRequest request) {
        // BFF sets this; only the secret-authenticated internal route can use it.
        String peer = request.getHeader("X-Free-Talk-Peer");
        return peer == null || !peer.matches("[a-f0-9]{64}") ? "unknown" : peer;
    }
}
