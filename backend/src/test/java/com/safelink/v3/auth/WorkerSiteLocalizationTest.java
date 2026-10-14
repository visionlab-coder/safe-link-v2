package com.safelink.v3.auth;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class WorkerSiteLocalizationTest {
    @Test void matchesByStableIdNotOutputOrder() {
        var rows=List.of(Map.<String,Object>of("id",2L),Map.<String,Object>of("id",3L));
        assertEquals(Map.of(2L,"Site A",3L,"Site B"),WorkerSiteLocalizationService.parse("[3] Site B\n[2] Site A",rows));
        for(String text:new String[]{"[2] A", "[2] A\n[2] B", "[2] A\n[4] B", "A\nB", "[2] A\n[3] B\nExtra"})
            assertThrows(IllegalArgumentException.class,()->WorkerSiteLocalizationService.parse(text,rows));
    }
}
