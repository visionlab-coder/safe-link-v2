package com.safelink.v3.auth;

import com.safelink.v3.ai.AiGatewayController;
import java.util.*;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** Only translates server-owned active site labels; never accepts arbitrary user text or grants membership. */
@Service
public class WorkerSiteLocalizationService {
    private static final Set<String> LANGUAGES = Set.of("ko","en","vi","zh","th","uz","ph","km","id","mn","my","ne","bn","kk","ru","jp","fr","es","ar","hi");
    private final JdbcClient jdbc;
    private final AiGatewayController gateway;
    public WorkerSiteLocalizationService(JdbcClient jdbc, AiGatewayController gateway) {
        this.jdbc=jdbc; this.gateway=gateway;
    }
    public List<Map<String,Object>> sites(SessionPrincipal actor, String language) {
        WorkerUpgradeService.requireTemporary(actor);
        String lang = language == null ? actor.preferredLanguage() : language;
        lang = "ja".equals(lang) ? "jp" : Set.of("tl","fil").contains(lang == null ? "" : lang) ? "ph" : lang;
        if (lang == null) lang="ko";
        if (!LANGUAGES.contains(lang)) throw new IllegalArgumentException("language_invalid");
        var rows = jdbc.sql("""
            select s.id,s.name,l.translated_name from sites s
            left join site_name_localizations l on l.site_id=s.id and l.language=:lang and l.source_name=s.name
            where s.status='ACTIVE' order by s.name,s.id
            """).param("lang",lang).query().listOfRows();
        Map<Long,String> translated = new HashMap<>();
        var missing = new ArrayList<Map<String,Object>>();
        for (var row:rows) {
            Long id=((Number)row.get("id")).longValue();
            if ("ko".equals(lang)) translated.put(id,(String)row.get("name"));
            else if (row.get("translated_name") instanceof String name) translated.put(id,name);
            else missing.add(row);
        }
        // Bounded batches. Gateway owns vendor selection, distributed quota, usage and timeout controls.
        // Stable numeric markers prevent a reordered translation from being attached to the wrong site.
        for (int offset=0; offset<missing.size(); offset+=40) {
            var batch=missing.subList(offset,Math.min(offset+40,missing.size()));
            String text=batch.stream().map(r->"["+r.get("id")+"] "+((String)r.get("name")).replaceAll("[\\r\\n]+"," "))
                .collect(java.util.stream.Collectors.joining("\n"));
            if (text.length()>8000 || actor.siteIds().isEmpty()) break;
            try {
                String target="jp".equals(lang)?"ja":"ph".equals(lang)?"tl":lang;
                var body=gateway.translate(actor,new AiGatewayController.TranslateRequest(
                    actor.siteIds().stream().min(Long::compareTo).orElseThrow(),"ko",target,text)).getBody();
                var parsed=parse(body == null ? "" : body.translatedText(),batch);
                for (var row:batch) {
                    Long id=((Number)row.get("id")).longValue();
                    String name=parsed.get(id);
                    jdbc.sql("""
                        insert into site_name_localizations(site_id,language,source_name,translated_name)
                        values(:id,:lang,:source,:name) on conflict(site_id,language) do update
                        set source_name=excluded.source_name,translated_name=excluded.translated_name,updated_at=now()
                        """).param("id",id).param("lang",lang).param("source",row.get("name")).param("name",name).update();
                    translated.put(id,name);
                }
            } catch (RuntimeException unavailable) {
                // Never return provider errors, credentials or a fabricated successful translation.
                break;
            }
        }
        return rows.stream().map(row -> {
            Long id=((Number)row.get("id")).longValue(); String original=(String)row.get("name");
            return Map.<String,Object>of("id",id,"name",translated.getOrDefault(id,original),
                "original_name",original,"translation_available",translated.containsKey(id));
        }).toList();
    }
    static Map<Long,String> parse(String text,List<Map<String,Object>> rows) {
        Set<Long> expected=new HashSet<>(); rows.forEach(r->expected.add(((Number)r.get("id")).longValue()));
        Map<Long,String> result=new HashMap<>();
        var pattern=Pattern.compile("^\\s*\\[(\\d+)\\]\\s*(.+?)\\s*$");
        for (String line:text.split("\\R")) {
            if (line.isBlank()) continue;
            var match=pattern.matcher(line);
            if (!match.matches()) throw new IllegalArgumentException("site_translation_mismatch");
            Long id=Long.valueOf(match.group(1)); String name=match.group(2);
            if (!expected.contains(id) || name.length()>500 || result.putIfAbsent(id,name)!=null)
                throw new IllegalArgumentException("site_translation_mismatch");
        }
        if (!result.keySet().equals(expected)) throw new IllegalArgumentException("site_translation_mismatch");
        return result;
    }
}
