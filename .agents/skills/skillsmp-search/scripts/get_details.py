import os
import requests
import json

def get_skill_details(queries):
    api_key = os.getenv("SKILLSMP_API_KEY")
    headers = {"Authorization": f"Bearer {api_key}"}
    url = "https://skillsmp.com/api/v1/skills/search"
    
    results = []
    for q in queries:
        r = requests.get(url, headers=headers, params={"q": q, "sortBy": "stars", "limit": 10})
        if r.status_code == 200:
            skills = r.json().get("data", {}).get("skills", [])
            results.extend(skills)
            
    # Deduplicate by id
    dedup = {s["id"]: s for s in results}
    sorted_s = sorted(dedup.values(), key=lambda x: x.get("stars", 0), reverse=True)
    
    for s in sorted_s:
        print(json.dumps({
            "name": s.get("name"),
            "stars": s.get("stars"),
            "githubUrl": s.get("githubUrl"),
            "skillUrl": s.get("skillUrl"),
            "description": s.get("description")
        }))

get_skill_details(["supabase", "translation", "safety", "nextjs", "cloudflare"])
