package com.safelink.v3.ai;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class AiTranslationCacheService {
    private static final Duration TTL = Duration.ofMinutes(30);
    private final StringRedisTemplate redis;

    public AiTranslationCacheService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public Optional<String> get(Long siteId, String sourceLanguage, String targetLanguage, String text) {
        try {
            return Optional.ofNullable(redis.opsForValue().get(key(siteId, sourceLanguage, targetLanguage, text)));
        } catch (RuntimeException ignored) {
            return Optional.empty();
        }
    }

    public void put(Long siteId, String sourceLanguage, String targetLanguage, String text, String translatedText) {
        try {
            redis.opsForValue().set(
                key(siteId, sourceLanguage, targetLanguage, text),
                translatedText,
                TTL
            );
        } catch (RuntimeException ignored) {
            // Translation must remain available when the optional cache is temporarily unavailable.
        }
    }

    private static String key(Long siteId, String sourceLanguage, String targetLanguage, String text) {
        String input = "%s|%s|%s|%s".formatted(siteId, sourceLanguage, targetLanguage, text);
        try {
            String digest = HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8))
            );
            return "ai:translation:v1:" + digest;
        } catch (Exception ex) {
            throw new IllegalStateException("translation_cache_key_failed", ex);
        }
    }
}
