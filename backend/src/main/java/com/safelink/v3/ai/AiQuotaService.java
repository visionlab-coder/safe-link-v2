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
        String scope = siteId == null ? "user:" + userId : "site:" + siteId;
        String key = "rate:%s:%s:%s".formatted(feature, scope, WINDOW.format(Instant.now()));
        try {
            Long value = redis.opsForValue().increment(key);
            if (value != null && value == 1L) {
                redis.expire(key, Duration.ofSeconds(properties.getDefaultWindowSeconds()));
            }
            long used = value == null ? 0 : value;
            return new QuotaDecision(used <= properties.getDefaultLimitCount(), used, properties.getDefaultLimitCount(), key);
        } catch (RuntimeException e) {
            if (properties.isFailOpenLocal()) {
                return new QuotaDecision(true, -1, properties.getDefaultLimitCount(), key);
            }
            throw new ServiceUnavailableException("redis_quota_unavailable");
        }
    }

    public record QuotaDecision(boolean allowed, long used, long limit, String key) {}
}
