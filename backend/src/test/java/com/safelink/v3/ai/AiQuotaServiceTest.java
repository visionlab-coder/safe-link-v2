package com.safelink.v3.ai;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.safelink.v3.support.ServiceUnavailableException;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

class AiQuotaServiceTest {
    @Test
    void enforcesUserAndSiteCountersIndependently() {
        var redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.increment(any(String.class))).thenAnswer(invocation -> {
            String key = invocation.getArgument(0);
            return key.contains(":user:7:") ? 2L : 4L;
        });
        var properties = properties(3, false);

        var decision = new AiQuotaService(redis, properties).checkAndIncrement("translate", 11L, 7L);

        assertFalse(decision.allowed());
        assertTrue(decision.key().contains("translate:user:7"));
        assertTrue(decision.key().contains("translate:site:11"));
    }

    @Test
    void failsClosedWhenRedisIsUnavailableInProductionMode() {
        var redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.increment(any(String.class))).thenThrow(new IllegalStateException("redis down"));

        assertThrows(
            ServiceUnavailableException.class,
            () -> new AiQuotaService(redis, properties(3, false)).checkAndIncrement("stt", 11L, 7L)
        );
    }

    @Test
    void permitsExplicitLocalFailOpenOnly() {
        var redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.increment(any(String.class))).thenThrow(new IllegalStateException("redis down"));

        var decision = new AiQuotaService(redis, properties(3, true)).checkAndIncrement("tts", 11L, 7L);

        assertTrue(decision.allowed());
    }

    private static AiProperties properties(long limit, boolean failOpen) {
        var properties = new AiProperties();
        properties.setDefaultLimitCount(limit);
        properties.setDefaultWindowSeconds(60);
        properties.setFailOpenLocal(failOpen);
        return properties;
    }
}
