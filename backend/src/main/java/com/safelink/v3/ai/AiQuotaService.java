package com.safelink.v3.ai;

import com.safelink.v3.support.ServiceUnavailableException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class AiQuotaService {
    private static final DateTimeFormatter WINDOW = DateTimeFormatter.ofPattern("yyyyMMddHHmm").withZone(ZoneOffset.UTC);
    private final StringRedisTemplate redis;
    private final AiProperties properties;

    public AiQuotaService(StringRedisTemplate redis, AiProperties properties) {
        this.redis = redis;
        this.properties = properties;
    }

    public QuotaDecision checkAndIncrement(String feature, Long siteId, Long userId) {
        String window = WINDOW.format(Instant.now());
        String userKey = "rate:%s:user:%s:%s".formatted(feature, userId, window);
        String siteKey = siteId == null ? null : "rate:%s:site:%s:%s".formatted(feature, siteId, window);
        try {
            long userUsed = increment(userKey);
            long siteUsed = siteKey == null ? 0 : increment(siteKey);
            long limit = properties.getDefaultLimitCount();
            boolean allowed = userUsed <= limit && (siteKey == null || siteUsed <= limit);
            long used = Math.max(userUsed, siteUsed);
            String decisionKey = siteKey == null ? userKey : userKey + "," + siteKey;
            return new QuotaDecision(allowed, used, limit, decisionKey);
        } catch (RuntimeException e) {
            if (properties.isFailOpenLocal()) {
                return new QuotaDecision(true, -1, properties.getDefaultLimitCount(), userKey);
            }
            throw new ServiceUnavailableException("redis_quota_unavailable");
        }
    }

    private long increment(String key) {
        Long value = redis.opsForValue().increment(key);
        if (value != null && value == 1L) {
            redis.expire(key, Duration.ofSeconds(properties.getDefaultWindowSeconds()));
        }
        return value == null ? 0 : value;
    }

    public record QuotaDecision(boolean allowed, long used, long limit, String key) {}
}
