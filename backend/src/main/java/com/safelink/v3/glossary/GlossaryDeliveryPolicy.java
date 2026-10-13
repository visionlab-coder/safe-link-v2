package com.safelink.v3.glossary;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;

/** Shared with the web normalizer. Dictionary descriptions are not spoken instructions. */
public final class GlossaryDeliveryPolicy {
    private static final JsonNode POLICY = load();

    private GlossaryDeliveryPolicy() {}

    private static JsonNode load() {
        try (var source = GlossaryDeliveryPolicy.class.getResourceAsStream("/glossary-delivery-policy.json")) {
            if (source == null) throw new IllegalStateException("glossary_delivery_policy_missing");
            return new ObjectMapper().readTree(source);
        } catch (IOException error) {
            throw new IllegalStateException("glossary_delivery_policy_invalid", error);
        }
    }

    public static String version() { return POLICY.path("version").asText(); }

    public static String deliveryTerm(String slang, String standard) {
        for (var value : POLICY.path("preserveTerms")) if (value.asText().equals(slang)) return slang;
        var reviewed = POLICY.path("reviewedTerms").path(slang);
        if (reviewed.isTextual()) return reviewed.asText();
        if (standard != null && standard.matches("(?s).*[（(].*") && !standard.matches("(?s).*[)）]\\s*$")) return slang;
        String core = standard == null ? "" : standard.split("[（(]", 2)[0].trim();
        if (core.isEmpty() || core.matches("(?s).*[,，/;；\\n:：=)）].*")) return slang;
        return core;
    }
}
