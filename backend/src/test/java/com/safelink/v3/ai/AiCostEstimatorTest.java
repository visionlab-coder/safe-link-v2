package com.safelink.v3.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class AiCostEstimatorTest {
    @Test
    void estimatesTranslationCostWithSixDecimalPlaces() {
        assertEquals("0.002000", AiCostEstimator.estimate("translate", "papago", 50, 50));
    }

    @Test
    void leavesUnknownFeaturesAtZero() {
        assertEquals("0.000000", AiCostEstimator.estimate("unknown", "gateway", 100, 100));
    }
}
