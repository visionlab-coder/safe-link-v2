package com.safelink.v3.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class RootBootstrapRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(RootBootstrapRunner.class);

    private final Environment environment;
    private final RootBootstrapService rootBootstrapService;

    public RootBootstrapRunner(Environment environment, RootBootstrapService rootBootstrapService) {
        this.environment = environment;
        this.rootBootstrapService = rootBootstrapService;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!environment.getProperty("safe-link.root-bootstrap.enabled", Boolean.class, false)) {
            return;
        }

        var result = rootBootstrapService.bootstrap(
            environment.getProperty("safe-link.root-bootstrap.email"),
            environment.getProperty("safe-link.root-bootstrap.password"),
            environment.getProperty("safe-link.root-bootstrap.display-name"),
            environment.getProperty("safe-link.root-bootstrap.preferred-language"),
            environment.getProperty("safe-link.root-bootstrap.token"),
            environment.getProperty("safe-link.root-bootstrap.confirm-token")
        );

        if ("CREATED".equals(result.status())) {
            log.info("root_bootstrap_created userId={}", result.userId());
        } else {
            log.info("root_bootstrap_skipped reason={}", result.reason());
        }
    }
}
