package com.safelink.v3.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(SecurityProperties.class)
public class SecurityConfig {
    @Bean
    SecurityFilterChain securityFilterChain(
        HttpSecurity http,
        @Value("${server.servlet.session.cookie.secure:false}") boolean secureCookie
    ) throws Exception {
        var csrfTokenRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfTokenRepository.setCookieCustomizer(cookie -> cookie
            .secure(secureCookie)
            .sameSite("Lax")
            .path("/")
        );

        http.cors(Customizer.withDefaults());
        http.csrf(csrf -> csrf
            .csrfTokenRepository(csrfTokenRepository)
            .ignoringRequestMatchers(
                new AntPathRequestMatcher("/api/v1/auth/login", "POST"),
                new AntPathRequestMatcher("/api/v1/auth/admin-signup", "POST"),
                new AntPathRequestMatcher("/api/v1/auth/worker-quick-login", "POST"),
                new AntPathRequestMatcher("/api/v1/qr/site-entry", "POST"),
                new AntPathRequestMatcher("/api/v1/qr/worker-token", "POST"),
                new AntPathRequestMatcher("/api/v1/nfc/worker-preference", "POST"),
                new AntPathRequestMatcher("/api/v1/ai/internal/translate", "POST"),
                new AntPathRequestMatcher("/api/v1/travel/internal/signal", "POST"),
                new AntPathRequestMatcher("/api/v1/reports/internal/verification-code", "POST"),
                new AntPathRequestMatcher("/actuator/**")
            )
        );
        http.sessionManagement(session -> session
            .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
            .sessionFixation(fixation -> fixation.migrateSession())
        );
        http.authorizeHttpRequests(auth -> auth
            .requestMatchers("/actuator/health/**", "/actuator/info").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/v1/auth/csrf").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/auth/login").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/auth/admin-signup").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/auth/worker-quick-login").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/qr/site-entry").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/qr/worker-token").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/v1/nfc/worker-info").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/nfc/worker-preference").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/ai/internal/translate").permitAll()
            .requestMatchers("/api/v1/travel/internal/**").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/v1/reports/public/**").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/v1/reports/internal/verification-code").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/v1/glossary/**").permitAll()
            .anyRequest().authenticated()
        );
        http.httpBasic(basic -> basic.disable());
        http.formLogin(form -> form.disable());
        http.logout(logout -> logout.disable());
        return http.build();
    }

    @Bean
    UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException("password_login_is_not_supported_here");
        };
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(SecurityProperties properties) {
        var config = new CorsConfiguration();
        config.setAllowedOrigins(properties.getCors().getAllowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN", "X-Requested-With"));
        config.setExposedHeaders(List.of("X-Request-Id"));
        config.setAllowCredentials(true);
        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
