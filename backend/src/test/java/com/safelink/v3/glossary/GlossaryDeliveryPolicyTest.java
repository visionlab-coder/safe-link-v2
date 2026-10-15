package com.safelink.v3.glossary;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class GlossaryDeliveryPolicyTest {
    @Test void reviewedTermsHaveOneDeliveryName() {
        assertEquals("거푸집", GlossaryDeliveryPolicy.deliveryTerm("가타와꾸", "거푸집"));
        assertEquals("서포트", GlossaryDeliveryPolicy.deliveryTerm("사포도", "서포트, 동바리"));
        assertEquals("평탄화", GlossaryDeliveryPolicy.deliveryTerm("나라시", "평탄화"));
        assertEquals("망치", GlossaryDeliveryPolicy.deliveryTerm("함마", "해머(망치)"));
        assertEquals("해체", GlossaryDeliveryPolicy.deliveryTerm("바라시", "해체, 뜯기"));
        assertEquals("보조공", GlossaryDeliveryPolicy.deliveryTerm("데모도", "보조공, 조수"));
        assertEquals("안전모", GlossaryDeliveryPolicy.deliveryTerm("안전모", "안전 헬멧(의무 착용)"));
    }

    @Test void doesNotGuessUnreviewedAlternativesOrRewriteOrdinaryWords() {
        assertEquals("예시", GlossaryDeliveryPolicy.deliveryTerm("예시", "뜻1/뜻2"));
        assertEquals("기둥", GlossaryDeliveryPolicy.deliveryTerm("하시라", "기둥 (Column)"));
        assertEquals("공기", GlossaryDeliveryPolicy.deliveryTerm("공기", "공사 기간"));
        assertEquals("쑤신다", GlossaryDeliveryPolicy.deliveryTerm("쑤신다", "주입(그라우팅)한다"));
        assertEquals("조인다", GlossaryDeliveryPolicy.deliveryTerm("조인다", "체결(볼트·너트 조임)한다"));
    }

    @Test void apiKeepsReferenceDescriptionSeparateAndReturnsVersion() throws Exception {
        var term = new GlossaryController.GlossaryTerm(1L, "데모도", "보조공, 조수", "인원", true);
        var json = new ObjectMapper().readTree(new ObjectMapper().writeValueAsString(term));
        assertEquals("보조공, 조수", json.path("standard").asText());
        assertEquals("보조공", json.path("delivery_term").asText());
        assertEquals("ko-glossary-2026-10-15.1", json.path("delivery_policy_version").asText());
    }
}
