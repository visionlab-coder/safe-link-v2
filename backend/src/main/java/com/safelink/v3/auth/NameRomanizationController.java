package com.safelink.v3.auth;

import com.ibm.icu.text.Transliterator;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** Public registration helper: local transliteration only, no paid vendor, logging or persistence of names. */
@RestController
public class NameRomanizationController {
    private final LoginAttemptRateLimiter limiter;
    public NameRomanizationController(LoginAttemptRateLimiter limiter) { this.limiter = limiter; }

    @PostMapping("/api/v1/auth/romanize-name")
    public ResponseEntity<Map<String,String>> suggest(@RequestBody Input input, HttpServletRequest request) {
        if (input.name() == null || input.name().isBlank() || input.name().length() > 80
            || !input.name().matches("[\\p{L}\\p{M} .’'\\-]+")) {
            throw new IllegalArgumentException("english_name_required");
        }
        limiter.consumeNameSuggestion(request.getRemoteAddr());
        // Per-request instance: ICU transliterators are mutable, not shared between requests.
        String result = Transliterator.getInstance("Any-Latin; Latin-ASCII")
            .transliterate(input.name()).replace('’', '\'');
        // Never drop unconverted characters and silently return an incomplete name.
        try { result = EnglishName.require(result); }
        catch (IllegalArgumentException ex) { return ResponseEntity.unprocessableEntity().cacheControl(CacheControl.noStore())
            .body(Map.of("error", "name_suggestion_unavailable")); }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of("romanized", result));
    }
    public record Input(String name) {}
}
