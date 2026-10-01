plugins {
    java
    id("org.springframework.boot") version "3.4.7"
    id("io.spring.dependency-management") version "1.1.7"
    id("org.owasp.dependencycheck") version "12.2.2"
}

group = "com.safelink"
version = "0.1.0"

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-actuator")
    implementation("org.springframework.boot:spring-boot-starter-data-jdbc")
    implementation("org.springframework.boot:spring-boot-starter-data-redis")
    implementation("org.springframework.boot:spring-boot-starter-security")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.session:spring-session-data-redis")
    implementation("org.flywaydb:flyway-core")
    implementation("org.flywaydb:flyway-database-postgresql")
    implementation("io.micrometer:micrometer-registry-prometheus")
    implementation(platform("software.amazon.awssdk:bom:2.25.70"))
    implementation("software.amazon.awssdk:s3")
    implementation("software.amazon.awssdk:sesv2")
    implementation("software.amazon.awssdk:sns")
    runtimeOnly("org.postgresql:postgresql")

    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.springframework.security:spring-security-test")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
}

tasks.withType<Test> {
    useJUnitPlatform()
}

// Local-only test harness: excluded from main and every bootJar.
val enrollmentSandbox by sourceSets.creating {
    compileClasspath += sourceSets.main.get().output + sourceSets.main.get().compileClasspath
    runtimeClasspath += sourceSets.main.get().output + sourceSets.main.get().runtimeClasspath
}
tasks.register<JavaExec>("enrollmentSandbox") {
    dependsOn(enrollmentSandbox.classesTaskName)
    classpath = enrollmentSandbox.runtimeClasspath
    mainClass.set("com.safelink.v3.SafeLinkV3Application")
    args("--spring.profiles.active=enrollment-sandbox", "--spring.config.import=",
        "--server.address=127.0.0.1", "--server.port=18081",
        "--spring.datasource.url=jdbc:postgresql://127.0.0.1:55439/sq_enrollment_sandbox",
        "--spring.datasource.username=sq_enrollment", "--spring.datasource.password=local-fixture-only",
        "--spring.data.redis.host=127.0.0.1", "--spring.data.redis.port=56389", "--spring.data.redis.password=",
        "--spring.session.redis.namespace=sq:enrollment:sandbox", "--server.servlet.session.cookie.secure=false",
        "--safe-link.temporary-worker.sponsor-email=enrollment-manager@example.invalid",
        "--safe-link.cors.allowed-origins=http://127.0.0.1:3100", "--safe-link.ai.vendor-enabled=false",
        "--safe-link.storage.enabled=false", "--safe-link.root-bootstrap.enabled=false")
}

dependencyCheck {
    formats = listOf("HTML", "JSON")
    failBuildOnCVSS = 7.0F
}
