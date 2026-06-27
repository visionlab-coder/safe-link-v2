# -*- coding: utf-8 -*-
"""미래전략TF 상반기 보고서 — 표지 + 섹션 구분 AI 이미지 생성 (Nano Banana Pro)."""
import json, urllib.request, base64, os, time

KEY = open('/tmp/gkey.txt').read().strip()
OUT = 'docs/generated/report_assets'
os.makedirs(OUT, exist_ok=True)

# 공통 톤: 다크 네이비→블랙 그라데이션, 레드(#C0392B)+시안 액센트, 영화적 조명, 텍스트 없음, 16:9
STYLE = ("Ultra-premium cinematic corporate tech visual, 16:9. Deep navy-to-black gradient base, "
         "elegant glowing red (#C0392B) and cyan accent light, dramatic volumetric lighting, "
         "clean minimal high-end aesthetic, subtle film grain, no text, no letters, no words, no logos.")

IMAGES = {
 'cover': "A construction site at dusk with tower-crane silhouettes, overlaid with a glowing red-and-cyan network mesh of connected data nodes weaving between the buildings. Sense of a digital safety nervous system over a real construction site. Hero title-card composition with empty dark space on the left for text. " + STYLE,
 'sec1_product': "Macro hero shot: a multinational construction worker in a safety helmet holding a smartphone that emits a floating translucent holographic interface with abstract multilingual safety UI panels and soft glowing icons (no readable text). Warm rim light plus cyan glow, shallow depth of field, premium. " + STYLE,
 'sec2_patent': "Abstract intellectual-property concept: a glowing translucent security shield at center, surrounded by floating interconnected cubic blocks linked in a chain (hash-chain), faint technical blueprint lines and fingerprint-like data patterns in the dark background. Conveys legal evidence integrity and protection. " + STYLE,
 'sec3_business': "A modern dawn city skyline of high-rise buildings with upward-rising translucent growth bars and a network of light beams connecting towers, suggesting business expansion and partnership. Wide cinematic vista, optimistic, corporate. " + STYLE,
 'sec4_academy': "A futuristic innovation scene: sleek AR smart-glasses floating with holographic data rings and a modern research-lab / exhibition-hall environment softly blurred behind, cyan and red light streaks, conveying R&D and industry-academia collaboration. " + STYLE,
 'sec5_future': "A sunrise over a long road leading toward a distant modern construction skyline on the horizon, with luminous upward trajectory lines arcing into the sky like a roadmap. Hopeful, forward-looking, expansive. " + STYLE,
}

def gen(name, prompt):
    path = f'{OUT}/{name}.png'
    if os.path.exists(path) and os.path.getsize(path) > 50000:
        print('SKIP(exists)', name); return
    for model in ['gemini-3-pro-image-preview', 'gemini-2.5-flash-image']:
        url = f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={KEY}'
        body = {'contents':[{'parts':[{'text':prompt}]}],
                'generationConfig':{'responseModalities':['IMAGE']}}
        try:
            req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                         headers={'Content-Type':'application/json'})
            data = json.loads(urllib.request.urlopen(req, timeout=180).read())
            for p in data['candidates'][0]['content']['parts']:
                d = p.get('inlineData') or p.get('inline_data')
                if d:
                    open(path,'wb').write(base64.b64decode(d['data']))
                    print('OK', name, model, os.path.getsize(path), 'bytes'); return
            print('NO_IMAGE', name, model)
        except Exception as e:
            print('FAIL', name, model, str(e)[:150]); time.sleep(2)
    print('!!GIVEUP', name)

for n,p in IMAGES.items():
    gen(n,p)
print('DONE')
