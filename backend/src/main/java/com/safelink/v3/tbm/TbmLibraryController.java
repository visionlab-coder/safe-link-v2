package com.safelink.v3.tbm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.domain.Role;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Versioned reference material, not an assessment or approval for a user's active site. */
@RestController
@RequestMapping("/api/v1/tbm/library")
public class TbmLibraryController {
    private final LibraryResponse library;

    public TbmLibraryController(ObjectMapper mapper) throws IOException {
        var items = new ArrayList<LibraryItem>();
        var sources = new ArrayList<Source>();
        for (String file : List.of("seowon-risk-assessment.json", "sample-risk-assessment.json")) {
            try (var input = new ClassPathResource("tbm/" + file).getInputStream()) {
                var catalog = mapper.readValue(input, Catalog.class);
                sources.add(catalog.source());
                items.addAll(catalog.items());
            }
        }
        library = new LibraryResponse(List.copyOf(items), List.copyOf(sources));
    }

    @GetMapping
    public ResponseEntity<LibraryResponse> list(@AuthenticationPrincipal SessionPrincipal actor) {
        if (actor == null || !(actor.hasRole(Role.ROOT) || actor.hasRole(Role.HQ_ADMIN)
            || actor.hasRole(Role.SITE_ADMIN) || actor.hasRole(Role.SAFETY_MANAGER))) {
            throw new AccessDeniedException("tbm_admin_required");
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(library);
    }

    public record Source(String id, String name, String sheet, String range, String sha256) {}
    public record Catalog(Source source, List<LibraryItem> items) {}
    public record LibraryResponse(List<LibraryItem> data, List<Source> sources) {}
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record LibraryItem(String id, String category, String subcategory, String hazardDescription,
        String accidentType, int frequency, int severity, int riskLevel, String preventiveMeasure,
        boolean isCritical, String sourceId, Integer sourceRow, String sourceCriticalMark) {}
}
