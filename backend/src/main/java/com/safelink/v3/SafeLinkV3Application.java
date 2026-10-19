package com.safelink.v3;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableScheduling
public class SafeLinkV3Application {
    public static void main(String[] args) {
        SpringApplication.run(SafeLinkV3Application.class, args);
    }
}
