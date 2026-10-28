import com.fasterxml.jackson.databind.ObjectMapper;
import com.safelink.v3.ai.AiProperties;
import com.safelink.v3.ai.DeepLClient;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Opt-in VM100 smoke harness using the actual application client; never starts Spring/DB. */
public class DeepLGlossarySmoke {
    public static void main(String[] args) throws Exception {
        if (!"root".equals(System.getProperty("user.name"))) throw new IllegalStateException("root required");
        var mapper = new ObjectMapper();
        Path directory = Path.of(args[0]);
        var report = mapper.readTree(directory.resolve("bridge-report.json").toFile());
        var keys = mapper.readTree(Path.of("/etc/safelink/rehearsal-ai-keys.json").toFile());
        var properties = new AiProperties();
        properties.setDeeplApiKey(keys.path("DEEPL_API_KEY").asText());
        properties.setDeeplApiBaseUrl(keys.path("DEEPL_API_BASE_URL").asText("https://api.deepl.com"));
        properties.setDeeplGlossaryId(report.path("glossary_id").asText());
        var client = new DeepLClient(properties, mapper);
        var plan = mapper.readTree(directory.resolve("plan.json").toFile());
        List<Map<String,Object>> results = new ArrayList<>();
        int failed = 0;
        // Short synthetic terms/sentences only. No real user conversations are transmitted.
        for (var dictionary : plan.path("payload").path("dictionaries")) {
            String lang = dictionary.path("target_lang").asText();
            Map<String,String> targets = new LinkedHashMap<>();
            for (String line : dictionary.path("entries").asText().split("\n")) {
                String[] pair = line.split("\t", 2); targets.put(pair[0], pair[1]);
            }
            for (String input : List.of("간조", "셈", "거푸집", "망치", "평탄화",
                    "들어가도 됩니까? 작업 시작합시다.",
                    "거푸집을 해체하지 마세요. 안전모가 없으면 들어가지 마세요.")) {
                Map<String,Object> row = new LinkedHashMap<>();
                row.put("language", lang); row.put("input", input);
                try {
                    var result = client.translate(input, "ko", lang);
                    row.put("output", result.text()); row.put("model", result.model());
                    String expected = targets.get(input);
                    if (expected != null) {
                        row.put("expected", expected);
                        boolean match = result.text().strip().equalsIgnoreCase(expected);
                        row.put("exact_term_match", match);
                        if (!match) failed++;
                    } else row.put("semantic_review_required", true);
                } catch (Exception error) {
                    row.put("error", error.getClass().getSimpleName()); failed++;
                }
                results.add(row);
                System.out.println("CASE " + lang + " " + results.size());
                mapper.writerWithDefaultPrettyPrinter().writeValue(directory.resolve("live-results.json").toFile(), results);
            }
        }
        System.out.println("LIVE_CASES=" + results.size() + " TERM_OR_REQUEST_FAILURES=" + failed);
        if (failed > 0) System.exit(1);
    }
}
