package com.safelink.v3.ai;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AiUsageRepository {
    private final JdbcClient jdbc;

    public AiUsageRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void log(Long userId, Long siteId, String feature, String vendor, String model, long inputSize, long outputSize, long durationMs, String estimatedCost) {
        jdbc.sql("""
                insert into ai_usage_logs(user_id, site_id, feature, vendor, model, input_size, output_size, duration_ms, estimated_cost)
                values (:userId, :siteId, :feature, :vendor, :model, :inputSize, :outputSize, :durationMs, cast(:estimatedCost as numeric))
            """)
            .param("userId", userId)
            .param("siteId", siteId)
            .param("feature", feature)
            .param("vendor", vendor)
            .param("model", model)
            .param("inputSize", inputSize)
            .param("outputSize", outputSize)
            .param("durationMs", durationMs)
            .param("estimatedCost", estimatedCost)
            .update();
    }
}
