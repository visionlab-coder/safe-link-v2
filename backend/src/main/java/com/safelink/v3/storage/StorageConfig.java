package com.safelink.v3.storage;

import java.net.URI;
import java.nio.file.Path;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class StorageConfig {
    @Bean
    @ConditionalOnProperty(prefix = "safe-link.storage", name = "enabled", havingValue = "true")
    S3Presigner s3Presigner(StorageProperties properties) {
        var builder = S3Presigner.builder()
            .region(Region.of(properties.getRegion()))
            .serviceConfiguration(S3Configuration.builder()
                .pathStyleAccessEnabled(properties.isPathStyleAccess())
                .build());
        if (StringUtils.hasText(properties.getEndpoint())) {
            builder.endpointOverride(URI.create(properties.getEndpoint()));
        }
        if (StringUtils.hasText(properties.getAccessKey()) && StringUtils.hasText(properties.getSecretKey())) {
            builder.credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(properties.getAccessKey(), properties.getSecretKey())
            ));
        }
        return builder.build();
    }

    @Bean
    @ConditionalOnProperty(prefix = "safe-link.storage", name = "enabled", havingValue = "true")
    S3Client s3Client(StorageProperties properties) {
        var builder = S3Client.builder()
            .region(Region.of(properties.getRegion()))
            .serviceConfiguration(S3Configuration.builder()
                .pathStyleAccessEnabled(properties.isPathStyleAccess())
                .build());
        if (StringUtils.hasText(properties.getEndpoint())) {
            builder.endpointOverride(URI.create(properties.getEndpoint()));
        }
        if (StringUtils.hasText(properties.getAccessKey()) && StringUtils.hasText(properties.getSecretKey())) {
            builder.credentialsProvider(StaticCredentialsProvider.create(
                AwsBasicCredentials.create(properties.getAccessKey(), properties.getSecretKey())
            ));
        }
        return builder.build();
    }

    @Bean
    @ConditionalOnProperty(prefix = "safe-link.storage", name = "enabled", havingValue = "true")
    ObjectStorageService s3ObjectStorageService(
        S3Presigner presigner,
        S3Client s3,
        StorageProperties properties
    ) {
        return new S3ObjectStorageService(presigner, s3, properties);
    }

    @Bean
    @ConditionalOnMissingBean(ObjectStorageService.class)
    ObjectStorageService disabledObjectStorageService(StorageProperties properties) {
        return new DisabledObjectStorageService(Path.of(properties.getLocalRoot()));
    }
}
