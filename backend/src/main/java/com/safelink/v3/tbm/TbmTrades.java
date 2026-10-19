package com.safelink.v3.tbm;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;

/** Canonical TBM labels, separate from workers' roles and site access. */
public final class TbmTrades {
    private TbmTrades() {}
    public static final List<String> ALL = List.of("철근", "거푸집", "콘크리트", "갱폼", "알폼", "비계", "양중", "할석미장",
        "해체", "정리", "시스템", "직영", "용역", "로프공", "거푸집-형틀", "타설(콘비_콘크리트 비계)");
    private static final ObjectMapper JSON = new ObjectMapper();
    public static List<String> normalize(List<String> values) {
        if (values == null) return List.of(); // Existing clients and historical TBMs remain compatible.
        if (values.size() > ALL.size() || values.stream().anyMatch(v -> v == null || !ALL.contains(v)))
            throw new IllegalArgumentException("tbm_trade_types_invalid");
        return ALL.stream().filter(values::contains).toList();
    }
    public static String json(List<String> values) {
        try { return JSON.writeValueAsString(normalize(values)); }
        catch (com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException(e); }
    }
    public static List<String> read(String value) {
        if (value == null) return List.of();
        try { return normalize(JSON.readValue(value, new TypeReference<List<String>>() {})); }
        catch (com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException("invalid_stored_tbm_trades", e); }
    }
}
