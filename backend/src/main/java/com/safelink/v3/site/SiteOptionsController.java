package com.safelink.v3.site;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.safelink.v3.auth.SessionPrincipal;
import com.safelink.v3.security.SiteGuard;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sites")
public class SiteOptionsController {
    private static final Pattern SITE_CODE_PATTERN = Pattern.compile("^SL-\\d{6}-\\d{4}$", Pattern.CASE_INSENSITIVE);
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final SecureRandom RANDOM = new SecureRandom();
    private final JdbcClient jdbc;
    private final SiteGuard siteGuard;

    public SiteOptionsController(JdbcClient jdbc, SiteGuard siteGuard) {
        this.jdbc = jdbc;
        this.siteGuard = siteGuard;
    }

    @GetMapping("/options")
    public SiteOptionsResponse options(@AuthenticationPrincipal SessionPrincipal actor) {
        if (actor == null) {
            return new SiteOptionsResponse(List.of());
        }
        if (actor.hasAnyGlobalRole()) {
            return new SiteOptionsResponse(findActiveSites());
        }
        if (actor.siteIds().isEmpty()) {
            return new SiteOptionsResponse(List.of());
        }
        return new SiteOptionsResponse(findActiveSites(actor.siteIds().stream().sorted().toList()));
    }

    private List<SiteOption> findActiveSites() {
        return jdbc.sql("""
                select id, name
                     , site_code
                from sites
                where status = 'ACTIVE'
                order by name, id
            """)
            .query((rs, rowNum) -> new SiteOption(
                String.valueOf(rs.getLong("id")),
                rs.getString("name"),
                rs.getString("site_code")
            ))
            .list();
    }

    private List<SiteOption> findActiveSites(List<Long> siteIds) {
        return jdbc.sql("""
                select id, name
                     , site_code
                from sites
                where status = 'ACTIVE'
                  and id in (:siteIds)
                order by name, id
            """)
            .param("siteIds", siteIds)
            .query((rs, rowNum) -> new SiteOption(
                String.valueOf(rs.getLong("id")),
                rs.getString("name"),
                rs.getString("site_code")
            ))
            .list();
    }

    @PostMapping("/current-location")
    public SiteLocationResponse updateCurrentLocation(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestBody SiteLocationRequest request
    ) {
        Long siteId = request.siteId() == null || request.siteId().isBlank()
            ? actor.siteIds().stream().sorted().findFirst().orElseThrow(() -> new IllegalArgumentException("profile_site_required"))
            : parseRequiredLong(request.siteId(), "site_id_invalid");
        siteGuard.requireGlobalOrSiteAdmin(actor, siteId, "admin.site.location.update", "site", String.valueOf(siteId));

        double latitude = cleanLatitude(request.latitude());
        double longitude = cleanLongitude(request.longitude());
        int radius = clampRadius(request.geofenceRadiusM());

        var site = jdbc.sql("""
                update sites
                set latitude = :latitude,
                    longitude = :longitude,
                    geofence_radius_m = :radius
                where id = :siteId
                  and status = 'ACTIVE'
                returning id, name, site_code, latitude, longitude, geofence_radius_m
            """)
            .param("latitude", latitude)
            .param("longitude", longitude)
            .param("radius", radius)
            .param("siteId", siteId)
            .query((rs, rowNum) -> new SiteLocation(
                String.valueOf(rs.getLong("id")),
                rs.getString("name"),
                rs.getString("site_code"),
                rs.getDouble("latitude"),
                rs.getDouble("longitude"),
                rs.getInt("geofence_radius_m")
            ))
            .optional()
            .orElseThrow(() -> new IllegalArgumentException("site_not_found"));
        return new SiteLocationResponse(site);
    }

    @PostMapping("/resolve")
    public SiteResolveResponse resolve(
        @AuthenticationPrincipal SessionPrincipal actor,
        @RequestBody SiteResolveRequest request
    ) {
        if (actor == null) {
            throw new AccessDeniedException("authentication_required");
        }
        String name = cleanSiteName(request.name());
        String siteCodeInput = SITE_CODE_PATTERN.matcher(name).matches() ? name.toUpperCase(Locale.ROOT) : null;
        SiteOption existing = siteCodeInput == null ? findByName(name) : findByCode(siteCodeInput);
        if (existing == null && siteCodeInput != null) {
            existing = findByName(name);
        }

        if (existing != null) {
            maybeUpdateResolvedSiteLocation(actor, Long.valueOf(existing.id()), request.location(), request.geofenceRadiusM());
            return new SiteResolveResponse(existing.id(), existing.name(), existing.site_code(), false);
        }

        boolean canCreate = actor.roles().stream().anyMatch(role -> role.hasGlobalSiteScope() || role.canManageSiteUsers());
        if (!canCreate) {
            throw new AccessDeniedException("FORBIDDEN");
        }

        Long organizationId = defaultOrganizationId();
        String siteCode = nextSiteCode();
        SiteLocationInput location = cleanLocation(request.location(), request.geofenceRadiusM(), false);
        var spec = jdbc.sql("""
                insert into sites(organization_id, name, status, site_code, latitude, longitude, geofence_radius_m)
                values (:organizationId, :name, 'ACTIVE', :siteCode, :latitude, :longitude, :radius)
                returning id, name, site_code
            """)
            .param("organizationId", organizationId)
            .param("name", name)
            .param("siteCode", siteCode)
            .param("latitude", location == null ? null : location.latitude())
            .param("longitude", location == null ? null : location.longitude())
            .param("radius", location == null ? 300 : location.radius());
        SiteOption created = spec.query((rs, rowNum) -> new SiteOption(
            String.valueOf(rs.getLong("id")),
            rs.getString("name"),
            rs.getString("site_code")
        )).single();
        return new SiteResolveResponse(created.id(), created.name(), created.site_code(), true);
    }

    private SiteOption findByCode(String siteCode) {
        return jdbc.sql("""
                select id, name, site_code
                from sites
                where upper(site_code) = :siteCode
                  and status = 'ACTIVE'
                limit 1
            """)
            .param("siteCode", siteCode.toUpperCase(Locale.ROOT))
            .query((rs, rowNum) -> new SiteOption(
                String.valueOf(rs.getLong("id")),
                rs.getString("name"),
                rs.getString("site_code")
            ))
            .optional()
            .orElse(null);
    }

    private SiteOption findByName(String name) {
        return jdbc.sql("""
                select id, name, site_code
                from sites
                where lower(name) = lower(:name)
                  and status = 'ACTIVE'
                order by id
                limit 1
            """)
            .param("name", name)
            .query((rs, rowNum) -> new SiteOption(
                String.valueOf(rs.getLong("id")),
                rs.getString("name"),
                rs.getString("site_code")
            ))
            .optional()
            .orElse(null);
    }

    private void maybeUpdateResolvedSiteLocation(SessionPrincipal actor, Long siteId, LocationRequest location, Integer radius) {
        SiteLocationInput cleaned = cleanLocation(location, radius, true);
        if (cleaned == null) {
            return;
        }
        siteGuard.requireGlobalOrSiteAdmin(actor, siteId, "admin.site.resolve.location.update", "site", String.valueOf(siteId));
        jdbc.sql("""
                update sites
                set latitude = :latitude,
                    longitude = :longitude,
                    geofence_radius_m = :radius
                where id = :siteId
                  and status = 'ACTIVE'
            """)
            .param("latitude", cleaned.latitude())
            .param("longitude", cleaned.longitude())
            .param("radius", cleaned.radius())
            .param("siteId", siteId)
            .update();
    }

    private Long defaultOrganizationId() {
        return jdbc.sql("""
                insert into organizations(name)
                select '서원건설'
                where not exists (select 1 from organizations where name = '서원건설')
                returning id
            """)
            .query(Long.class)
            .optional()
            .orElseGet(() -> jdbc.sql("select id from organizations order by id limit 1").query(Long.class).single());
    }

    private static String cleanSiteName(String value) {
        String name = value == null ? "" : value.trim();
        if (name.length() < 2) {
            throw new IllegalArgumentException("name_too_short");
        }
        if (name.length() > 100) {
            throw new IllegalArgumentException("name_too_long");
        }
        return name;
    }

    private static String nextSiteCode() {
        String date = LocalDate.now(SEOUL).toString().replace("-", "").substring(2);
        int suffix = 1000 + RANDOM.nextInt(9000);
        return "SL-" + date + "-" + suffix;
    }

    private static SiteLocationInput cleanLocation(LocationRequest location, Integer radius, boolean optional) {
        if (location == null || location.latitude() == null || location.longitude() == null) {
            return null;
        }
        double latitude = cleanLatitude(location.latitude());
        double longitude = cleanLongitude(location.longitude());
        return new SiteLocationInput(latitude, longitude, clampRadius(radius));
    }

    private static double cleanLatitude(Number value) {
        if (value == null || !Double.isFinite(value.doubleValue()) || value.doubleValue() < -90 || value.doubleValue() > 90) {
            throw new IllegalArgumentException("latitude_invalid");
        }
        return value.doubleValue();
    }

    private static double cleanLongitude(Number value) {
        if (value == null || !Double.isFinite(value.doubleValue()) || value.doubleValue() < -180 || value.doubleValue() > 180) {
            throw new IllegalArgumentException("longitude_invalid");
        }
        return value.doubleValue();
    }

    private static int clampRadius(Number value) {
        int radius = value == null ? 300 : (int) Math.round(value.doubleValue());
        return Math.max(20, Math.min(5000, radius));
    }

    private static Long parseRequiredLong(String value, String error) {
        try {
            return Long.valueOf(value.trim());
        } catch (RuntimeException e) {
            throw new IllegalArgumentException(error);
        }
    }

    public record SiteOptionsResponse(List<SiteOption> sites) {}
    public record SiteOption(String id, String name, String site_code) {}
    public record SiteLocationRequest(@JsonProperty("site_id") String siteId, Double latitude, Double longitude, Double accuracy, @JsonProperty("geofence_radius_m") Integer geofenceRadiusM) {}
    public record SiteLocationResponse(SiteLocation site) {}
    public record SiteLocation(String id, String name, String site_code, Double latitude, Double longitude, Integer geofence_radius_m) {}
    public record SiteResolveRequest(String name, LocationRequest location, @JsonProperty("geofence_radius_m") Integer geofenceRadiusM) {}
    public record LocationRequest(Double latitude, Double longitude, Double accuracy) {}
    public record SiteResolveResponse(String id, String name, String site_code, boolean created) {}
    private record SiteLocationInput(double latitude, double longitude, int radius) {}
}
