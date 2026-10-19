package com.safelink.v3.tbm;

import java.util.List;
import java.util.Arrays;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class TbmTradesTest {
    @Test void canonicalSixteenValuesAndLegacyCompatibility() {
        assertEquals(16, TbmTrades.ALL.size());
        assertEquals(16, TbmTrades.ALL.stream().distinct().count());
        assertEquals(List.of(), TbmTrades.normalize(null));
        assertEquals(TbmTrades.ALL, TbmTrades.read(TbmTrades.json(TbmTrades.ALL)));
    }
    @Test void multipleSelectionsAreUniqueAndOrderedWithoutChangingSimilarLabels() {
        assertEquals(List.of("거푸집", "해체", "거푸집-형틀"),
            TbmTrades.normalize(List.of("해체", "거푸집-형틀", "거푸집", "해체")));
    }
    @Test void unknownAndMalformedSelectionsAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> TbmTrades.normalize(List.of("없는 공종")));
        assertThrows(IllegalArgumentException.class, () -> TbmTrades.normalize(Arrays.asList("해체", null)));
        assertThrows(IllegalStateException.class, () -> TbmTrades.read("{}"));
    }
}
