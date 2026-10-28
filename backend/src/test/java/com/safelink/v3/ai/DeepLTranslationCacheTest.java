package com.safelink.v3.ai;

import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import java.time.Duration;

class DeepLTranslationCacheTest {
    @Test void glossaryEnableChangeAndRollbackUseDistinctNamespaces() {
        var properties = new AiProperties();
        String disabled = properties.translationCacheNamespace();
        properties.setDeeplGlossaryId("52f898a5-98d7-4538-b907-46a645fb5136");
        String enabled = properties.translationCacheNamespace();
        assertNotEquals(disabled, enabled);
        properties.setDeeplGlossaryRevision("reviewed-revision-2");
        assertNotEquals(enabled, properties.translationCacheNamespace());
        properties.setDeeplGlossaryId("");
        assertNotEquals(enabled, properties.translationCacheNamespace());
    }
    @SuppressWarnings("unchecked")
    @Test void differentProvidersAndSitesNeverShareTranslationCache() {
        var redis=mock(StringRedisTemplate.class);
        ValueOperations<String,String> values=mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        var cache=new AiTranslationCacheService(redis);
        var keys=new java.util.HashSet<String>();
        doAnswer(call->{ keys.add(call.getArgument(0));return null; }).when(values).set(anyString(),anyString(),any(Duration.class));
        cache.put("deepl",1L,"ko","en","안녕하세요","Hello");
        cache.put("google",1L,"ko","en","안녕하세요","Hello");
        cache.put("deepl",2L,"ko","en","안녕하세요","Hello");
        assertEquals(3,keys.size());
        assertTrue(keys.stream().allMatch(key->key.startsWith("ai:translation:v2:")));
    }
}
