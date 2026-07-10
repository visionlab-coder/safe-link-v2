import { NextRequest, NextResponse } from "next/server";
import { getCookieUser } from "@/utils/auth/cookie-user";
import { callV3AiVision } from "@/utils/ai/v3-ai-gateway";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getCookieUser({ allowV3: true });
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const siteId = user.siteIds?.[0];
  if (user.source !== "v3" || typeof siteId !== "number") {
    return NextResponse.json({ error: "V3_SITE_SESSION_REQUIRED" }, { status: 403 });
  }

  try {
    const { image, lang, mimeType } = await request.json() as {
      image?: string;
      lang?: string;
      mimeType?: string;
    };
    if (!image) return NextResponse.json({ error: "No image data" }, { status: 400 });
    if (typeof image !== "string" || image.length > 5 * 1024 * 1024 * (4 / 3)) {
      return NextResponse.json({ error: "Image too large (max 5MB)" }, { status: 413 });
    }

    const targetLang = lang || "ko";
    const langNames: Record<string, string> = {
      ko: "한국어", en: "English", zh: "中文", vi: "Tiếng Việt",
      th: "ภาษาไทย", uz: "O'zbek", ph: "Filipino", ru: "Русский",
      jp: "日本語", km: "ខ្មែរ", id: "Bahasa Indonesia", mn: "Монгол",
      my: "မြန်မာ", ne: "नेपाली", bn: "বাংলা", kk: "Қазақ",
      fr: "Français", es: "Español", ar: "العربية", hi: "हिन्दी",
    };
    const langName = langNames[targetLang] || "English";
    const prompt = `You are a construction site safety expert analyzing a photo from a construction site.

Identify all construction-related objects, equipment, materials, and potential hazards visible in this image.
For each item return: name_ko, name_local in ${langName}, category (equipment/material/hazard/ppe/structure/tool), risk_level (safe/caution/danger), safety_note_ko, safety_note_local in ${langName}.
Return only a valid JSON array. If none are found, return [].`;

    const upstream = await callV3AiVision(request, {
      siteId,
      image,
      mimeType: mimeType || "image/jpeg",
      targetLanguage: targetLang,
      prompt,
    });
    if (!upstream) {
      return NextResponse.json({ error: "Vision gateway unavailable" }, { status: 503 });
    }
    if (!upstream.ok) {
      const body = await upstream.text().catch(() => "");
      console.error("[Vision API] Gateway error:", upstream.status, body.slice(0, 200));
      return NextResponse.json({ error: "Vision API failed" }, { status: upstream.status });
    }

    const data = await upstream.json() as { text?: string };
    const textContent = data.text?.trim() || "";
    if (!textContent) return NextResponse.json({ items: [] });
    const jsonMatch = textContent.match(/```json\s*([\s\S]*?)```/) || textContent.match(/(\[[\s\S]*\])/);
    if (!jsonMatch) return NextResponse.json({ items: [] });
    const items = JSON.parse(jsonMatch[1]);
    return NextResponse.json({ items: Array.isArray(items) ? items : [] });
  } catch (error) {
    console.error("[Vision API] Error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
