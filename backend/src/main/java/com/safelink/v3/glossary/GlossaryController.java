package com.safelink.v3.glossary;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.safelink.v3.auth.SessionPrincipal;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/glossary")
public class GlossaryController {
    private final JdbcClient jdbc;

    public GlossaryController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public GlossaryListResponse list(
        @RequestParam(name = "active", required = false, defaultValue = "false") boolean activeOnly,
        @RequestParam(name = "slang", required = false) List<String> slang
    ) {
        List<String> slangs = slang == null ? List.of() : slang.stream()
            .map(GlossaryController::cleanOptional)
            .filter(value -> !value.isBlank())
            .distinct()
            .limit(300)
            .toList();
        String activeSql = activeOnly ? " and is_active = true\n" : "";
        String slangSql = slangs.isEmpty() ? "" : " and slang in (:slangs)\n";
        var spec = jdbc.sql("""
                select id, slang, standard, category, is_active
                from construction_glossary
                where 1 = 1
            """ + activeSql + slangSql + """
                order by category, slang
            """);
        if (!slangs.isEmpty()) spec = spec.param("slangs", slangs);
        return new GlossaryListResponse(spec.query((rs, rowNum) -> new GlossaryTerm(
            rs.getLong("id"),
            rs.getString("slang"),
            rs.getString("standard"),
            rs.getString("category"),
            rs.getBoolean("is_active")
        )).list());
    }

    @GetMapping("/translations")
    public GlossaryTranslationListResponse translations() {
        var rows = jdbc.sql("""
                select t.glossary_id, g.standard, t.pivot_en, t.lang_code, t.local_slang
                from site_term_translations t
                join construction_glossary g on g.id = t.glossary_id
                where g.is_active = true
                order by t.lang_code, g.standard, t.local_slang
            """)
            .query((rs, rowNum) -> {
                String standard = rs.getString("standard");
                return new GlossaryTranslation(
                    rs.getLong("glossary_id"),
                    standard,
                    standardCore(standard),
                    rs.getString("pivot_en"),
                    rs.getString("local_slang"),
                    normalizeLanguage(rs.getString("lang_code"))
                );
            })
            .list();
        return new GlossaryTranslationListResponse(rows);
    }

    @PostMapping
    @Transactional
    public GlossaryTerm upsert(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody GlossaryUpsertRequest request) {
        requireGlossaryManager(actor);
        String slang = cleanRequired(request.slang(), "slang_required");
        String standard = cleanRequired(request.standard(), "standard_required");
        String category = cleanCategory(request.category());
        return jdbc.sql("""
                insert into construction_glossary(slang, standard, category, is_active)
                values (:slang, :standard, :category, coalesce(:active, true))
                on conflict (slang)
                do update set standard = excluded.standard,
                              category = excluded.category,
                              is_active = excluded.is_active,
                              updated_at = now()
                returning id, slang, standard, category, is_active
            """)
            .param("slang", slang)
            .param("standard", standard)
            .param("category", category)
            .param("active", request.isActive())
            .query((rs, rowNum) -> new GlossaryTerm(
                rs.getLong("id"),
                rs.getString("slang"),
                rs.getString("standard"),
                rs.getString("category"),
                rs.getBoolean("is_active")
            ))
            .single();
    }

    @PatchMapping("/{id}")
    @Transactional
    public GlossaryTerm update(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable Long id, @RequestBody GlossaryPatchRequest request) {
        requireGlossaryManager(actor);
        return jdbc.sql("""
                update construction_glossary
                set standard = coalesce(:standard, standard),
                    category = coalesce(:category, category),
                    is_active = coalesce(:active, is_active),
                    updated_at = now()
                where id = :id
                returning id, slang, standard, category, is_active
            """)
            .param("id", id)
            .param("standard", blankToNull(request.standard()))
            .param("category", blankToNull(request.category()))
            .param("active", request.isActive())
            .query((rs, rowNum) -> new GlossaryTerm(
                rs.getLong("id"),
                rs.getString("slang"),
                rs.getString("standard"),
                rs.getString("category"),
                rs.getBoolean("is_active")
            ))
            .optional()
            .orElseThrow(() -> new IllegalArgumentException("glossary_not_found"));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public Map<String, Boolean> delete(@AuthenticationPrincipal SessionPrincipal actor, @PathVariable Long id) {
        requireGlossaryManager(actor);
        jdbc.sql("delete from construction_glossary where id = :id")
            .param("id", id)
            .update();
        return Map.of("ok", true);
    }

    @PostMapping("/import")
    @Transactional
    public ImportResponse importRows(@AuthenticationPrincipal SessionPrincipal actor, @RequestBody List<GlossaryImportRow> rows) {
        requireGlossaryManager(actor);
        if (rows == null || rows.isEmpty()) {
            throw new IllegalArgumentException("rows_empty");
        }
        List<GlossaryImportRow> valid = rows.stream()
            .filter(row -> row != null && !cleanOptional(row.slang()).isBlank() && !cleanOptional(row.standard()).isBlank())
            .limit(1000)
            .toList();
        if (valid.isEmpty()) {
            throw new IllegalArgumentException("no_valid_rows");
        }
        List<String> slangs = valid.stream().map(row -> cleanRequired(row.slang(), "slang_required")).distinct().toList();
        var existing = jdbc.sql("select slang from construction_glossary where slang in (:slangs)")
            .param("slangs", slangs)
            .query(String.class)
            .list()
            .stream()
            .collect(java.util.stream.Collectors.toSet());

        int inserted = 0;
        for (GlossaryImportRow row : valid) {
            String slang = cleanRequired(row.slang(), "slang_required");
            if (existing.contains(slang)) {
                continue;
            }
            jdbc.sql("""
                    insert into construction_glossary(slang, standard, category, is_active)
                    values (:slang, :standard, :category, true)
                """)
                .param("slang", slang)
                .param("standard", cleanRequired(row.standard(), "standard_required"))
                .param("category", cleanCategory(row.category()))
                .update();
            existing.add(slang);
            inserted++;
        }
        int dup = valid.size() - inserted;
        String message = inserted == 0
            ? "모두 이미 등록된 항목입니다 (%d개 중복).".formatted(dup)
            : "%d개 저장 완료 (%d개 중복 건너뜀).".formatted(inserted, dup);
        return new ImportResponse(inserted, dup, message);
    }

    private static void requireGlossaryManager(SessionPrincipal actor) {
        if (actor == null) {
            throw new AccessDeniedException("authentication_required");
        }
        boolean allowed = actor.roles().stream().anyMatch(role -> role.hasGlobalSiteScope() || role.canManageSiteUsers());
        if (!allowed) {
            throw new AccessDeniedException("glossary_admin_required");
        }
    }

    private static String cleanRequired(String value, String error) {
        String cleaned = cleanOptional(value);
        if (cleaned.isBlank()) {
            throw new IllegalArgumentException(error);
        }
        return cleaned.substring(0, Math.min(cleaned.length(), 200));
    }

    private static String cleanOptional(String value) {
        return value == null ? "" : value.trim();
    }

    private static String blankToNull(String value) {
        String cleaned = cleanOptional(value);
        return cleaned.isBlank() ? null : cleaned.substring(0, Math.min(cleaned.length(), 200));
    }

    private static String cleanCategory(String value) {
        String category = cleanOptional(value);
        if (category.isBlank()) {
            return "기타";
        }
        return category.substring(0, Math.min(category.length(), 40));
    }

    private static String standardCore(String standard) {
        if (standard == null) return "";
        String[] parts = standard.split("[,(]", 2);
        return parts[0].trim();
    }

    private static String normalizeLanguage(String language) {
        String value = language == null ? "" : language.trim().toLowerCase(Locale.ROOT);
        return switch (value) {
            case "ph" -> "tl";
            case "kh" -> "km";
            case "lk" -> "si";
            case "bd" -> "bn";
            case "np" -> "ne";
            case "mm" -> "my";
            case "pk" -> "ur";
            default -> value;
        };
    }

    public record GlossaryListResponse(List<GlossaryTerm> terms) {}
    public record GlossaryTranslationListResponse(List<GlossaryTranslation> terms) {}
    public record ImportResponse(int ok, int dup, String message) {}
    public record GlossaryTerm(Long id, String slang, String standard, String category, @JsonProperty("is_active") boolean isActive) {}
    public record GlossaryTranslation(Long glossaryId, String standard, String standardCore, String pivotEnglish, String localTerm, String language) {}
    public record GlossaryUpsertRequest(String slang, String standard, String category, @JsonProperty("is_active") Boolean isActive) {}
    public record GlossaryPatchRequest(String standard, String category, @JsonProperty("is_active") Boolean isActive) {}
    public record GlossaryImportRow(String slang, String standard, String category) {}
}
