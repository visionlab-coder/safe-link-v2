package com.safelink.v3.auth;

import com.safelink.v3.support.ServiceUnavailableException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/** Redis-backed limit for password login guesses. Keys use a digest so an email address is not stored in Redis key names. */
@Service
public class LoginAttemptRateLimiter {
    private static final long MAX_FAILURES = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);

    private final StringRedisTemplate redis;

    public LoginAttemptRateLimiter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void checkAllowed(String email, String ipAddress) {
        try {
            String value = redis.opsForValue().get(key(email, ipAddress));
            if (value != null && Long.parseLong(value) >= MAX_FAILURES) {
                throw new LoginRateLimitExceededException("login_rate_limited");
            }
        } catch (LoginRateLimitExceededException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw new ServiceUnavailableException("redis_login_rate_limit_unavailable");
        }
    }

    public void recordFailure(String email, String ipAddress) {
        try {
            Long count = redis.opsForValue().increment(key(email, ipAddress));
            if (count != null && count == 1L) {
                redis.expire(key(email, ipAddress), WINDOW);
            }
        } catch (RuntimeException ex) {
            throw new ServiceUnavailableException("redis_login_rate_limit_unavailable");
        }
    }

    public void clear(String email, String ipAddress) {
        try {
            redis.delete(key(email, ipAddress));
        } catch (RuntimeException ex) {
            throw new ServiceUnavailableException("redis_login_rate_limit_unavailable");
        }
    }

    /** Separate atomic bucket for a CPU-only public helper; names never become keys. */
    public void consumeNameSuggestion(String ipAddress) {
        var script = new org.springframework.data.redis.core.script.DefaultRedisScript<Long>(
            "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n", Long.class);
        try {
            Long count = redis.execute(script, java.util.List.of("auth:name-suggestion:" + sha256(ipAddress == null ? "" : ipAddress)));
            if (count == null) throw new IllegalStateException("missing_limit");
            if (count > 60) throw new LoginRateLimitExceededException("name_suggestion_rate_limited");
        } catch (LoginRateLimitExceededException ex) { throw ex; }
        catch (RuntimeException ex) { throw new ServiceUnavailableException("redis_name_rate_limit_unavailable"); }
    }

    private static String key(String email, String ipAddress) {
        String subject = (email == null ? "" : email.trim().toLowerCase()) + "|" + (ipAddress == null ? "" : ipAddress);
        return "auth:login:fail:" + sha256(subject);
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("sha256_unavailable", ex);
        }
    }

    public static class LoginRateLimitExceededException extends RuntimeException {
        public LoginRateLimitExceededException(String message) {
            super(message);
        }
    }
}
