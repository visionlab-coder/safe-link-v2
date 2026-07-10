package com.safelink.v3.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "safe-link")
public class SecurityProperties {
    private Cors cors = new Cors();
    private Security security = new Security();

    public Cors getCors() {
        return cors;
    }

    public Security getSecurity() {
        return security;
    }

    public static class Cors {
        private List<String> allowedOrigins = List.of("http://localhost:3000");

        public List<String> getAllowedOrigins() {
            return allowedOrigins;
        }

        public void setAllowedOrigins(List<String> allowedOrigins) {
            this.allowedOrigins = allowedOrigins;
        }
    }

    public static class Security {
        private int maxSessionsPerUser = 5;

        public int getMaxSessionsPerUser() {
            return maxSessionsPerUser;
        }

        public void setMaxSessionsPerUser(int maxSessionsPerUser) {
            this.maxSessionsPerUser = maxSessionsPerUser;
        }
    }
}
