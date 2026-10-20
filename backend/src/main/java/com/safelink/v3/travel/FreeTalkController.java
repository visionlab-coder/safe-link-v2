package com.safelink.v3.travel;

import com.safelink.v3.ai.AiMediaService;
import com.safelink.v3.ai.AiUsageRepository;
import com.safelink.v3.ai.AiCostEstimator;
import com.safelink.v3.ai.AiVendorService;
import jakarta.servlet.http.HttpServletRequest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/free-talk/internal")
public class FreeTalkController {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String,String>> status(ResponseStatusException error) {
        // Avoid /error redispatch being replaced by the authenticated-only default security rule.
        return ResponseEntity.status(error.getStatusCode()).body(Map.of("error",error.getReason()==null?"free_talk_failed":error.getReason()));
    }

    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public ResponseEntity<Map<String,String>> storageUnavailable() {
        return ResponseEntity.status(503).body(Map.of("error","free_talk_storage_unavailable"));
    }
    // Same 20 choices as SQ Link. Translation uses ja/tl, not UI aliases jp/ph.
    static final Map<String, String> LANGS = Map.ofEntries(
        Map.entry("ko", "ko-KR"), Map.entry("vi", "vi-VN"), Map.entry("zh", "zh-CN"),
        Map.entry("th", "th-TH"), Map.entry("uz", "uz-UZ"), Map.entry("tl", "fil-PH"),
        Map.entry("km", "km-KH"), Map.entry("id", "id-ID"), Map.entry("mn", "mn-MN"),
        Map.entry("my", "my-MM"), Map.entry("ne", "ne-NP"), Map.entry("bn", "bn-IN"),
        Map.entry("kk", "kk-KZ"), Map.entry("ru", "ru-RU"), Map.entry("en", "en-US"),
        Map.entry("ja", "ja-JP"), Map.entry("fr", "fr-FR"), Map.entry("es", "es-ES"),
        Map.entry("ar", "ar-SA"), Map.entry("hi", "hi-IN"));
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final DefaultRedisScript<Long> JOIN = new DefaultRedisScript<>("""
        if redis.call('EXISTS',KEYS[1])==0 then return 0 end
        if redis.call('HGET',KEYS[1],'host')==ARGV[1] then return 1 end
        local guest=redis.call('HGET',KEYS[1],'guest')
        if guest and guest~=ARGV[1] then return -1 end
        redis.call('HSET',KEYS[1],'guest',ARGV[1],'guestLang',ARGV[2]); return 1
        """, Long.class);
    private final FreeTalkAccess access;
    private final StringRedisTemplate redis;
    private final TravelRealtimeEventBus events;
    private final AiVendorService vendor;
    private final AiMediaService media;
    private final AiUsageRepository usage;
    private final JdbcClient jdbc;

    public FreeTalkController(FreeTalkAccess access, StringRedisTemplate redis, TravelRealtimeEventBus events,
        AiVendorService vendor, AiMediaService media, AiUsageRepository usage, JdbcClient jdbc) {
        this.access=access; this.redis=redis; this.events=events; this.vendor=vendor; this.media=media; this.usage=usage; this.jdbc=jdbc;
    }

    @PostMapping("/session")
    public Map<String, Object> session(HttpServletRequest request) {
        return Map.of("handle", access.start(request), "maxAge", FreeTalkAccess.LIFETIME.toSeconds());
    }

    @PostMapping("/room")
    public Map<String, String> room(HttpServletRequest request, @RequestBody RoomRequest body) {
        String token=access.require(request), lang=language(body.lang());
        access.limit("rooms:" + token, 10, 3600);
        // Reservation prevents collisions across server processes; codes are server generated.
        for (int attempt=0; attempt<10; attempt++) {
            String code=String.valueOf(10_000_000 + RANDOM.nextInt(90_000_000));
            if (!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent("free-talk:reserved:"+code, "1", FreeTalkAccess.LIFETIME))) continue;
            redis.opsForHash().putAll(key(code), Map.of("host", token, "hostLang", lang));
            redis.expire(key(code), FreeTalkAccess.LIFETIME);
            return Map.of("room", code, "senderId", "host");
        }
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "free_talk_room_unavailable");
    }

    @PostMapping("/join")
    public Map<String, String> join(HttpServletRequest request, @RequestBody RoomRequest body) {
        String token=access.require(request), code=code(body.room()), lang=language(body.lang());
        access.limit("joins:"+token, 12, 60);
        Long joined=redis.execute(JOIN, List.of(key(code)), token, lang);
        if (joined == null || joined != 1) throw new ResponseStatusException(HttpStatus.CONFLICT, "free_talk_room_missing_or_full");
        String role=member(code, token);
        events.publish(channel(code), "partner-joined", Map.of("senderId", role, "payload", Map.of("lang", lang)));
        String other=(String)redis.opsForHash().get(key(code), role.equals("host")?"guestLang":"hostLang");
        return Map.of("senderId", role, "partnerLang", other == null ? "" : other);
    }

    @GetMapping(value="/events", produces="text/event-stream")
    public SseEmitter events(HttpServletRequest request, @RequestParam String room) {
        String token=access.require(request), code=code(room), role=member(code,token);
        SseEmitter emitter=events.subscribe(channel(code), token, 120_000L);
        String other=(String)redis.opsForHash().get(key(code), role.equals("host")?"guestLang":"hostLang");
        // Replay partner state on reconnection; a join before subscription must not get lost.
        if (other != null) {
            try { emitter.send(SseEmitter.event().name("partner-joined").data(Map.of("senderId", role.equals("host")?"guest":"host", "payload", Map.of("lang", other)))); }
            catch (java.io.IOException e) { emitter.complete(); }
        }
        return emitter;
    }

    @PostMapping("/signal")
    public Map<String, Boolean> signal(HttpServletRequest request, @RequestBody SignalRequest body) {
        String token=access.require(request), code=code(body.room()), role=member(code, token);
        if (body.event()==null || !Set.of("speaking-start", "speaking-end", "new-message").contains(body.event())) throw new IllegalArgumentException("invalid_free_talk_event");
        Map<String,Object> payload=body.payload()==null ? Map.of() : body.payload();
        if (payload.toString().length()>16000) throw new IllegalArgumentException("free_talk_message_too_large");
        if (body.event().equals("new-message")) {
            text((String)payload.get("original"), 2000); text((String)payload.get("translated"), 6000);
            language((String)payload.get("lang")); language((String)payload.get("targetLang"));
        }
        events.publish(channel(code), body.event(), Map.of("senderId", role, "payload", payload));
        return Map.of("ok", true);
    }

    @PostMapping("/translate")
    public Map<String, String> translate(HttpServletRequest request, @RequestBody TranslateRequest body) {
        String token=access.require(request), from=language(body.from()), to=language(body.to()), text=text(body.text(),2000);
        access.paid(request,token);
        long started=System.currentTimeMillis();
        var result=vendor.translateAuto(text, from, to);
        usage.log(null,null,"free_talk_translate",result.vendor(),result.model(),text.length(),result.text().length(),System.currentTimeMillis()-started,AiCostEstimator.estimate("translate",result.vendor(),text.length(),result.text().length()));
        return Map.of("translated",result.text(),"engine",result.vendor());
    }

    @PostMapping("/stt")
    public Map<String, String> stt(HttpServletRequest request, @RequestBody SpeechRequest body) {
        String token=access.require(request), lang=language(body.lang());
        String audio=text(body.audio(),2_800_000);
        if (Base64.getDecoder().decode(audio).length > 2_000_000) throw new IllegalArgumentException("free_talk_audio_too_large");
        String mime=body.mimeType();
        if (mime==null || !mime.matches("audio/(webm|ogg|mp4|wav|pcm)(;[a-zA-Z0-9=; -]+)?")) throw new IllegalArgumentException("invalid_audio_type");
        int rate=body.sampleRateHertz()==null?48000:body.sampleRateHertz();
        if (!Set.of(8000,12000,16000,24000,44100,48000).contains(rate)) throw new IllegalArgumentException("invalid_sample_rate");
        access.paid(request,token);
        List<String> hints=lang.equals("ko") ? jdbc.sql("select slang from construction_glossary where is_active=true order by id limit 500").query(String.class).list() : List.of();
        long started=System.currentTimeMillis();
        var result=media.transcribe(audio,mime,LANGS.get(lang),rate,true,hints,null,List.of());
        usage.log(null,null,"free_talk_stt",result.vendor(),result.model(),audio.length(),result.transcript().length(),System.currentTimeMillis()-started,AiCostEstimator.estimate("stt",result.vendor(),audio.length(),result.transcript().length()));
        return Map.of("transcript",result.transcript(),"originalTranscript",result.transcript(),"engine",result.vendor());
    }

    @PostMapping("/tts")
    public AiMediaService.AudioResult tts(HttpServletRequest request, @RequestBody VoiceRequest body) {
        String token=access.require(request), lang=language(body.lang()), text=text(body.text(),1000);
        if (body.gender()==null || !Set.of("male","female").contains(body.gender())) throw new IllegalArgumentException("invalid_gender");
        access.paid(request,token);
        long started=System.currentTimeMillis();
        var result=media.synthesize(null,text,lang.equals("ar") ? "ar-XA" : LANGS.get(lang),null,body.gender(),true,false,"MP3");
        usage.log(null,null,"free_talk_tts",result.vendor(),result.model(),text.length(),result.audioBase64().length(),System.currentTimeMillis()-started,AiCostEstimator.estimate("tts",result.vendor(),text.length(),result.audioBase64().length()));
        return result;
    }

    private String member(String code,String token) {
        if (token.equals(redis.opsForHash().get(key(code),"host"))) return "host";
        if (token.equals(redis.opsForHash().get(key(code),"guest"))) return "guest";
        throw new ResponseStatusException(HttpStatus.FORBIDDEN,"free_talk_room_denied");
    }
    private static String key(String code) { return "free-talk:room:"+code; }
    private static String channel(String code) { return "free-talk:"+code; }
    private static String code(String code) {
        if (code==null || !code.matches("[0-9]{8}")) throw new IllegalArgumentException("invalid_room_code");
        return code;
    }
    static String language(String value) {
        String lang=value==null?"":value.trim().toLowerCase(Locale.ROOT).split("[-_]", -1)[0];
        lang=switch (lang) { case "jp" -> "ja"; case "ph", "fil" -> "tl"; default -> lang; };
        if (!LANGS.containsKey(lang)) throw new IllegalArgumentException("unsupported_free_talk_language");
        return lang;
    }
    private static String text(String text,int max) {
        if (text==null || text.isBlank() || text.length()>max) throw new IllegalArgumentException("invalid_free_talk_input");
        return text.trim();
    }
    public record RoomRequest(String room,String lang) {}
    public record SignalRequest(String room,String event,Map<String,Object> payload) {}
    public record TranslateRequest(String text,String from,String to) {}
    public record SpeechRequest(String audio,String lang,String mimeType,Integer sampleRateHertz) {}
    public record VoiceRequest(String text,String lang,String gender) {}
}
