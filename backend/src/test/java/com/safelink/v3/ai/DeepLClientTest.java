package com.safelink.v3.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.support.ServiceUnavailableException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Flow;
import java.io.ByteArrayOutputStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DeepLClientTest {
    final AiProperties properties = new AiProperties();
    final ObjectMapper mapper = new ObjectMapper();
    final HttpClient http = mock(HttpClient.class);
    final DeepLClient client = new DeepLClient(properties, mapper, http);
    @BeforeEach void setUp() { properties.setDeeplApiKey("fixture-not-a-real-key"); }

    @SuppressWarnings("unchecked")
    void respond(int status, String body) throws Exception {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(body);
        when(http.send(any(), any(HttpResponse.BodyHandler.class))).thenReturn(response);
    }

    @Test void textUsesServerAuthorizationAndSimplifiedChinese() throws Exception {
        respond(200,"{\"translations\":[{\"text\":\"请戴安全帽。\"}]}");
        var translated = client.translate("안전모를 착용하세요.", "ko-KR", "zh-CN");
        assertEquals("deepl", translated.vendor());
        var request = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(request.capture(), any());
        assertEquals("https://api.deepl.com/v2/translate", request.getValue().uri().toString());
        assertEquals("DeepL-Auth-Key fixture-not-a-real-key", request.getValue().headers().firstValue("Authorization").orElseThrow());
        var payload = mapper.readTree(body(request.getValue()));
        assertEquals("KO",payload.path("source_lang").asText());
        assertEquals("ZH-HANS",payload.path("target_lang").asText());
        assertEquals("안전모를 착용하세요.",payload.path("text").path(0).asText());
        assertFalse(payload.has("auth_key"));
    }
    @Test void allApplicationLanguageAliasesAreExplicit() {
        assertEquals("TL", DeepLClient.textLanguage("fil-PH", false));
        assertEquals("JA", DeepLClient.textLanguage("jp", true));
        for (String code : List.of("ko","en","zh","vi","th","uz","ph","id","mn","my","ne","bn","kk","ru","jp","fr","es","ar","hi")) {
            assertNotNull(DeepLClient.textLanguage(code, true));
        }
        assertThrows(IllegalArgumentException.class,()->DeepLClient.textLanguage("km",true));
        for (String code : List.of("km","uz","mn","my","ne","kk")) assertFalse(DeepLClient.supportsVoice(code));
        assertTrue(DeepLClient.supportsVoice("zh-CN"));
        assertTrue(DeepLClient.supportsVoice("fil-PH"));
    }
    @Test void glossaryOnlyAppliesToFourKoreanOutboundPairsAndKeepsTextUnchanged() throws Exception {
        properties.setDeeplGlossaryId("52f898a5-98d7-4538-b907-46a645fb5136");
        for (String target : List.of("en", "en-US", "ja", "jp", "vi-VN", "zh", "zh-CN")) {
            clearInvocations(http);
            respond(200, "{\"translations\":[{\"text\":\"fixture\"}]}");
            String input = "셈을 확인하세요. 거푸집이 없으면 작업하지 마세요. 들어가도 됩니까? 작업 시작합시다.";
            assertEquals("translate-v2-glossary", client.translate(input, "ko-KR", target).model());
            var request = ArgumentCaptor.forClass(HttpRequest.class);
            verify(http).send(request.capture(), any());
            var payload = mapper.readTree(body(request.getValue()));
            assertEquals(properties.getDeeplGlossaryId(), payload.path("glossary_id").asText());
            assertEquals(input, payload.path("text").path(0).asText(), "Never reverse standard Korean into slang");
            assertEquals("KO", payload.path("source_lang").asText());
        }
        for (String[] pair : List.of(new String[]{"en","ko"}, new String[]{"ja","en"}, new String[]{"ko","th"})) {
            clearInvocations(http);
            client.translate("fixture", pair[0], pair[1]);
            var request = ArgumentCaptor.forClass(HttpRequest.class);
            verify(http).send(request.capture(), any());
            assertFalse(mapper.readTree(body(request.getValue())).has("glossary_id"));
        }
    }
    @Test void glossaryConfigurationAndProviderErrorsNeverSilentlyDropTheGlossary() throws Exception {
        properties.setDeeplGlossaryId("not-a-uuid");
        assertThrows(ServiceUnavailableException.class, () -> client.translate("셈", "ko", "en"));
        verifyNoInteractions(http);
        properties.setDeeplGlossaryId("52f898a5-98d7-4538-b907-46a645fb5136");
        respond(404, "{\"message\":\"private glossary details\"}");
        var error = assertThrows(ServiceUnavailableException.class, () -> client.translate("셈", "ko", "en"));
        assertFalse(error.getMessage().contains("private"));
        verify(http, times(1)).send(any(), any());
    }
    @Test void disabledGlossaryPreservesExistingProviderAndIdentityBehavior() throws Exception {
        respond(200, "{\"translations\":[{\"text\":\"fixture\"}]}");
        assertEquals("translate-v2", client.translate("셈", "ko", "en").model());
        var request = ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(request.capture(), any());
        assertFalse(mapper.readTree(body(request.getValue())).has("glossary_id"));
        clearInvocations(http);
        assertEquals("셈", client.translate("셈", "ko", "ko").text());
        verifyNoInteractions(http);
    }
    @Test void missingKeyAndUntrustedEndpointNeverSend() {
        properties.setDeeplApiKey("");
        assertThrows(ServiceUnavailableException.class,()->client.translate("Hello","en","ko"));
        properties.setDeeplApiKey("fixture");
        properties.setDeeplApiBaseUrl("https://untrusted.invalid");
        assertThrows(ServiceUnavailableException.class,()->client.translate("Hello","en","ko"));
        verifyNoInteractions(http);
    }
    @Test void errorsDoNotExposeVendorBodyOrSilentlyFallback() throws Exception {
        for (int status : List.of(400,403,429,456,503)) {
            respond(status,"{\"message\":\"sensitive vendor payload\"}");
            var error = assertThrows(ServiceUnavailableException.class,()->client.translate("Hello","en","ko"));
            assertFalse(error.getMessage().contains("sensitive"));
            assertTrue(error.getMessage().startsWith("deepl_translation_"));
        }
    }
    @Test void emptyTranslationFailsClosed() throws Exception {
        respond(200,"{\"translations\":[]}");
        assertThrows(ServiceUnavailableException.class,()->client.translate("Hello","en","ko"));
    }
    @Test void voiceOnlyPublishesConcludedSegmentsAfterEnd() {
        WebSocket socket=mock(WebSocket.class);
        var listener=new DeepLClient.VoiceListener(mapper);
        listener.onText(socket,"{\"source_transcript_update\":{\"concluded\":[{\"text\":\"Hello\"}],\"tentative\":[{\"text\":\"wrong\"}]}}",true);
        assertFalse(listener.result.isDone());
        listener.onText(socket,"{\"source_transcript_update\":{\"concluded\":[{\"text\":\" world\"}]}}",true);
        listener.onText(socket,"{\"end_of_",false);
        listener.onText(socket,"stream\":{}}",true);
        assertEquals("Hello world",listener.result.join());
    }
    @Test void earlyCloseAndVendorErrorDoNotReturnPartialSuccess() {
        WebSocket socket=mock(WebSocket.class);
        var closed=new DeepLClient.VoiceListener(mapper);
        closed.onClose(socket,1000,"closed");
        assertTrue(closed.result.isCompletedExceptionally());
        var error=new DeepLClient.VoiceListener(mapper);
        error.onText(socket,"{\"error\":{\"error_message\":\"secret\"}}",true);
        assertTrue(error.result.isCompletedExceptionally());
    }
    @Test void ephemeralTokenCannotBeSentToArbitraryHost() {
        for (String url:List.of("ws://api.deepl.com/a","wss://api.deepl.com.evil.invalid/a","wss://evil.invalid/a","wss://user@api.deepl.com/a","wss://api.deepl.com/a?x=1")) {
            assertThrows(ServiceUnavailableException.class,()->DeepLClient.streamUri(url,"fixture"));
        }
        assertEquals("api.deepl.com",DeepLClient.streamUri("wss://api.deepl.com/v3/voice/realtime/connect","fixture").getHost());
    }
    @Test void voiceRequestFixesSelectedLanguageAndClosesSocket() throws Exception {
        respond(200,"{\"streaming_url\":\"wss://api.deepl.com/v3/voice/realtime/connect\",\"token\":\"fixture\"}");
        WebSocket socket=mock(WebSocket.class);
        WebSocket.Builder builder=mock(WebSocket.Builder.class,RETURNS_SELF);
        when(http.newWebSocketBuilder()).thenReturn(builder);
        when(builder.buildAsync(any(URI.class),any())).thenAnswer(invocation->{
            var listener=(WebSocket.Listener)invocation.getArgument(1);
            listener.onOpen(socket);
            when(socket.sendText(any(),eq(true))).thenAnswer(sent->{
                if(sent.getArgument(0).toString().contains("end_of_source_media")) {
                    listener.onText(socket,"{\"source_transcript_update\":{\"concluded\":[{\"text\":\"Hello\"}]}}",true);
                    listener.onText(socket,"{\"end_of_stream\":{}}",true);
                }
                return CompletableFuture.completedFuture(socket);
            });
            return CompletableFuture.completedFuture(socket);
        });
        assertEquals("Hello",client.transcribe("AAA=","audio/pcm","en-US",16000));
        verify(socket).abort();
        var request=ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(request.capture(),any());
        var payload=mapper.readTree(body(request.getValue()));
        assertEquals("en",payload.path("source_language").asText());
        assertEquals("fixed",payload.path("source_language_mode").asText());
        assertFalse(payload.has("target_languages"),"Translation must run after local glossary normalization");
    }
    @Test void invalidOrOversizedAudioIsRejectedBeforeSessionCreation() {
        assertThrows(IllegalArgumentException.class,()->client.transcribe("AAA=","audio/webm","ko",48000));
        assertThrows(IllegalArgumentException.class,()->client.transcribe("?","audio/pcm","ko",16000));
        assertThrows(IllegalArgumentException.class,()->client.transcribe(Base64.getEncoder().encodeToString(new byte[960002]),"audio/pcm","ko",16000));
        verifyNoInteractions(http);
    }
    @Test void vendorAndMediaRoutesUseDeepLAndDoNotCallRemovedFlitto() {
        DeepLClient deep=mock(DeepLClient.class);
        var vendor=new AiVendorService(properties,mapper,deep);
        when(deep.translate("Hello","en","ko")).thenReturn(new AiVendorService.VendorResult("안녕하세요","deepl","test"));
        assertEquals("deepl",vendor.translateTbmSpeech("Hello","en").vendor());
        var media=new AiMediaService(properties,mapper,deep);
        when(deep.transcribe("AAA=","audio/pcm","en-US",16000)).thenReturn("Hello");
        assertEquals("deepl",media.transcribe("AAA=","audio/pcm","en-US",16000,true,List.of(),"",List.of("ko")).vendor());
        properties.setSttProvider("flitto");
        assertThrows(IllegalArgumentException.class,()->media.transcribe("AAA=","audio/pcm","en-US",16000,true,List.of(),"",List.of()));
    }
    @Test void pcmWrapKeepsOpenAiRollbackFormatValid() {
        byte[] wav=AiMediaService.pcm16ToWav(new byte[]{1,2,3,4});
        assertEquals(48,wav.length);
        assertEquals(16000,ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN).getInt(24));
        assertEquals(4,ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN).getInt(40));
    }
    @Test void unsupportedVoiceLanguageKeepsGoogleWithCorrectPcmRateAndHints() throws Exception {
        properties.setGoogleCloudApiKey("fixture");
        DeepLClient deep=mock(DeepLClient.class);
        var media=new AiMediaService(properties,mapper,deep);
        org.springframework.test.util.ReflectionTestUtils.setField(media,"httpClient",http);
        respond(200,"{\"results\":[{\"alternatives\":[{\"transcript\":\"fixture transcript\",\"confidence\":0.99}]}]}");
        assertEquals("google",media.transcribe("AAA=","audio/pcm","km-KH",16000,true,List.of("fixture hint"),"",List.of()).vendor());
        verifyNoInteractions(deep);
        var request=ArgumentCaptor.forClass(HttpRequest.class);
        verify(http).send(request.capture(),any());
        var config=mapper.readTree(body(request.getValue())).path("config");
        assertEquals("LINEAR16",config.path("encoding").asText());
        assertEquals(16000,config.path("sampleRateHertz").asInt());
        assertEquals("km-KH",config.path("languageCode").asText());
        assertEquals("fixture hint",config.path("speechContexts").path(0).path("phrases").path(0).asText());
    }
    @Test void khmerTranslationUsesExplicitGoogleCapabilityFallback() throws Exception {
        properties.setGoogleCloudApiKey("fixture");
        DeepLClient deep=mock(DeepLClient.class);
        var vendor=new AiVendorService(properties,mapper,deep);
        org.springframework.test.util.ReflectionTestUtils.setField(vendor,"httpClient",http);
        respond(200,"{\"data\":{\"translations\":[{\"translatedText\":\"fixture\"}]}}");
        assertEquals("google",vendor.translateAuto("안녕하세요","ko","km").vendor());
        verifyNoInteractions(deep);
    }
    static String body(HttpRequest request) {
        var bytes=new ByteArrayOutputStream();
        request.bodyPublisher().orElseThrow().subscribe(new Flow.Subscriber<ByteBuffer>() {
            public void onSubscribe(Flow.Subscription subscription) { subscription.request(Long.MAX_VALUE); }
            public void onNext(ByteBuffer item) { byte[] chunk=new byte[item.remaining()]; item.get(chunk); bytes.writeBytes(chunk); }
            public void onError(Throwable error) { throw new AssertionError(error); }
            public void onComplete() {}
        });
        return bytes.toString(java.nio.charset.StandardCharsets.UTF_8);
    }
}
