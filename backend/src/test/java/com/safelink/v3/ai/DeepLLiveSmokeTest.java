package com.safelink.v3.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in external calls using generated, non-personal audio. No credentials in fixtures/reports. */
@EnabledIfEnvironmentVariable(named="SAFE_LINK_DEEPL_LIVE_TEST", matches="true")
class DeepLLiveSmokeTest {
    DeepLClient client() {
        var properties=new AiProperties();
        properties.setDeeplApiKey(System.getenv("SAFE_LINK_DEEPL_SMOKE_KEY"));
        return new DeepLClient(properties,new ObjectMapper());
    }
    @Test void translatesAllNineteenSupportedApplicationLanguages() {
        var client=client();
        for (String target:List.of("en","zh","vi","th","uz","ph","id","mn","my","ne","bn","kk","ru","jp","fr","es","ar","hi")) {
            var result=client.translate("작업 전에 안전모를 착용하세요.","ko",target);
            assertEquals("deepl",result.vendor());
            assertFalse(result.text().isBlank(),target);
            System.out.println("DeepL text target="+target+" PASS");
        }
        assertFalse(client.translate("Wear a hard hat before work.","en","ko").text().isBlank());
    }
    @Test void transcribesGeneratedKoreanEnglishAndMandarinAudio() throws Exception {
        var client=client();
        for(String source:List.of("ko","en","zh")) {
            Path file=Path.of(System.getenv("SAFE_LINK_DEEPL_SMOKE_AUDIO_DIR"),source+".wav");
            byte[] wave=Files.readAllBytes(file);
            assertEquals("RIFF",new String(wave,0,4,StandardCharsets.US_ASCII));
            byte[] pcm=null;
            for(int offset=12;offset+8<=wave.length;) {
                int length=ByteBuffer.wrap(wave).order(ByteOrder.LITTLE_ENDIAN).getInt(offset+4);
                if("data".equals(new String(wave,offset,4,StandardCharsets.US_ASCII))) {
                    pcm=Arrays.copyOfRange(wave,offset+8,offset+8+length); break;
                }
                offset+=8+length+(length%2);
            }
            assertNotNull(pcm);
            String transcript=client.transcribe(Base64.getEncoder().encodeToString(pcm),"audio/pcm",source,16000);
            assertFalse(transcript.isBlank(),source);
            assertTrue(switch(source) {
                case "ko" -> transcript.contains("안전모");
                case "en" -> transcript.toLowerCase().contains("helmet");
                default -> transcript.contains("安全帽");
            },"Synthetic speech mismatch for "+source+": "+transcript);
            System.out.println("DeepL Voice source="+source+" transcript="+transcript);
        }
    }
}
