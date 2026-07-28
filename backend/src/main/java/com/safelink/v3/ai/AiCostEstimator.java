package com.safelink.v3.ai;

import java.math.BigDecimal;
import java.math.RoundingMode;

final class AiCostEstimator {
    private static final BigDecimal MILLION = BigDecimal.valueOf(1_000_000);

    private AiCostEstimator() {}

    static String estimate(String feature, String vendor, long inputSize, long outputSize) {
        // Operational budget telemetry only. The vendor invoice remains the billing source of truth;
        // media endpoints use payload size as a conservative proxy when duration/token details are unavailable.
        BigDecimal units = BigDecimal.valueOf(Math.max(0, inputSize) + Math.max(0, outputSize));
        BigDecimal usdPerMillion = switch (feature == null ? "" : feature) {
            case "translate" -> BigDecimal.valueOf(20);
            case "tts" -> BigDecimal.valueOf(16);
            case "stt" -> BigDecimal.valueOf(24);
            case "vision" -> BigDecimal.valueOf(1500);
            case "quiz", "realtime" -> "openai".equalsIgnoreCase(vendor)
                ? BigDecimal.valueOf(2.5)
                : BigDecimal.valueOf(20);
            default -> BigDecimal.ZERO;
        };
        return units.multiply(usdPerMillion)
            .divide(MILLION, 6, RoundingMode.HALF_UP)
            .toPlainString();
    }
}
