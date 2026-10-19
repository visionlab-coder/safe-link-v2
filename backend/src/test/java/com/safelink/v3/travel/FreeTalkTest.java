package com.safelink.v3.travel;

import com.safelink.v3.ai.*;
import java.time.Duration;
import java.util.Map;
import java.util.List;
import org.junit.jupiter.api.*;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@Testcontainers(disabledWithoutDocker=true)
class FreeTalkTest {
    @Container static GenericContainer<?> container=new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);
    LettuceConnectionFactory factory;
    StringRedisTemplate redis;
    FreeTalkAccess access;
    FreeTalkController controller;
    AiProperties properties;
    AiVendorService vendor;
    AiMediaService media;
    TravelRealtimeEventBus events;
    @BeforeEach void setup() {
        factory=new LettuceConnectionFactory(container.getHost(),container.getMappedPort(6379)); factory.afterPropertiesSet(); factory.start();
        redis=new StringRedisTemplate(factory);
        try(var connection=factory.getConnection()) { connection.serverCommands().flushDb(); }
        properties=new AiProperties(); properties.setInternalGatewaySecret("fixture-secret"); properties.setVendorEnabled(true);
        access=new FreeTalkAccess(redis,properties,10000);
        vendor=mock(AiVendorService.class); media=mock(AiMediaService.class); events=mock(TravelRealtimeEventBus.class);
        controller=new FreeTalkController(access,redis,events,vendor,media,mock(AiUsageRepository.class),mock(JdbcClient.class));
    }
    @AfterEach void close() { factory.destroy(); }
    MockHttpServletRequest request() {
        var request=new MockHttpServletRequest(); request.addHeader("X-Safe-Link-Internal-Secret","fixture-secret"); return request;
    }
    MockHttpServletRequest guest() {
        var r=request(); r.addHeader("X-Free-Talk-Session",controller.session(r).get("handle")); return r;
    }
    @Test void capabilityCannotBeForgedAndExpiresWithoutBecomingAccountAuthentication() {
        var r=guest(); assertEquals(r.getHeader("X-Free-Talk-Session"),access.require(r));
        assertNull(r.getSession(false));
        assertEquals(401,assertThrows(ResponseStatusException.class,()->access.require(request())).getStatusCode().value());
        var bad=new MockHttpServletRequest(); assertEquals(403,assertThrows(ResponseStatusException.class,()->controller.session(bad)).getStatusCode().value());
        redis.delete("free-talk:session:"+r.getHeader("X-Free-Talk-Session"));
        assertEquals(401,assertThrows(ResponseStatusException.class,()->access.require(r)).getStatusCode().value());
    }
    @Test void roomsOnlyAllowHostAndOneJoinedGuestAndIdentityIsServerOwned() {
        var host=guest(); var partner=guest(); var stranger=guest();
        String code=controller.room(host,new FreeTalkController.RoomRequest(null,"ko")).get("room");
        assertTrue(code.matches("[0-9]{8}"));
        assertThrows(ResponseStatusException.class,()->controller.signal(stranger,new FreeTalkController.SignalRequest(code,"speaking-start",Map.of())));
        var joined=controller.join(partner,new FreeTalkController.RoomRequest(code,"en"));
        assertEquals("ko",joined.get("partnerLang")); assertEquals("guest",joined.get("senderId"));
        assertEquals(409,assertThrows(ResponseStatusException.class,()->controller.join(stranger,new FreeTalkController.RoomRequest(code,"ja"))).getStatusCode().value());
        controller.signal(host,new FreeTalkController.SignalRequest(code,"speaking-start",Map.of()));
        verify(events).publish("free-talk:"+code,"speaking-start",Map.of("senderId","host","payload",Map.of()));
        assertThrows(IllegalArgumentException.class,()->controller.signal(host,new FreeTalkController.SignalRequest(code,"admin",Map.of())));
        redis.delete("free-talk:room:"+code);
        assertThrows(ResponseStatusException.class,()->controller.events(host,code));
    }
    @Test void paidQuotaLimitsCannotBeBypassedWithAnotherFeature() {
        var r=guest(); String token=access.require(r);
        redis.opsForValue().set("free-talk:limit:paid-minute:"+token,"240",Duration.ofSeconds(60));
        assertEquals(429,assertThrows(ResponseStatusException.class,()->controller.translate(r,new FreeTalkController.TranslateRequest("hello","en","ko"))).getStatusCode().value());
        verifyNoInteractions(vendor);
        assertEquals(429,assertThrows(ResponseStatusException.class,()->controller.tts(r,new FreeTalkController.VoiceRequest("hello","en","female"))).getStatusCode().value());
        verifyNoInteractions(media);
    }
    @Test void guestCanTranslateAndSpeakWithoutSiteButOnlyAllowedLanguagesAndPayloads() {
        var r=guest();
        when(vendor.translateAuto("평탄화 하지 마세요.","ko","en")).thenReturn(new AiVendorService.VendorResult("Do not level it.","fixture","test"));
        assertEquals("Do not level it.",controller.translate(r,new FreeTalkController.TranslateRequest("평탄화 하지 마세요.","ko","en")).get("translated"));
        when(media.transcribe(anyString(),anyString(),eq("en-US"),eq(16000),eq(true),eq(List.of()),isNull(),eq(List.of())))
            .thenReturn(new AiMediaService.SttResult("hello","fixture","test",Map.of()));
        assertEquals("hello",controller.stt(r,new FreeTalkController.SpeechRequest("YWJj","en-US","audio/pcm;encoding=s16le;rate=16000",16000)).get("originalTranscript"));
        assertThrows(IllegalArgumentException.class,()->controller.translate(r,new FreeTalkController.TranslateRequest("hi","xx","ko")));
        assertThrows(IllegalArgumentException.class,()->controller.translate(r,new FreeTalkController.TranslateRequest("a".repeat(2001),"en","ko")));
        assertThrows(IllegalArgumentException.class,()->controller.stt(r,new FreeTalkController.SpeechRequest("YWJj","en","text/html",16000)));
    }
    @Test void sessionAndGlobalCostLimitsAreEnforcedAndRedisFailureFailsClosed() {
        for (int i=0;i<10;i++) controller.session(request());
        assertEquals(429,assertThrows(ResponseStatusException.class,()->controller.session(request())).getStatusCode().value());
        var r=request(); redis.delete("free-talk:limit:session-ip:unknown");
        r.addHeader("X-Free-Talk-Session",controller.session(r).get("handle"));
        redis.opsForValue().set("free-talk:limit:paid-global","10000",Duration.ofHours(1));
        assertEquals(429,assertThrows(ResponseStatusException.class,()->access.paid(r,access.require(r))).getStatusCode().value());
        var broken=mock(StringRedisTemplate.class); when(broken.hasKey(anyString())).thenThrow(new IllegalStateException("offline"));
        assertThrows(IllegalStateException.class,()->new FreeTalkAccess(broken,properties,10).require(r));
    }
}
