import os
import requests
import json

def find_installable_skills():
    api_key = os.getenv("SKILLSMP_API_KEY")
    headers = {"Authorization": f"Bearer {api_key}"}
    url = "https://skillsmp.com/api/v1/skills/search"
    
    queries = ["supabase", "translation", "nextjs", "safety", "ai"]
    installable = []
    
    for q in queries:
        r = requests.get(url, headers=headers, params={"q": q, "sortBy": "stars", "limit": 50})
        if r.status_code == 200:
            skills = r.json().get("data", {}).get("skills", [])
            for s in skills:
                if s.get("repositoryUrl"):
                    installable.append(s)
    
    # Unique by ID
    unique = {s["id"]: s for s in installable}
    sorted_s = sorted(unique.values(), key=lambda x: x.get("stars", 0), reverse=True)
    
    for s in sorted_s[:10]:
        print(f"NAME: {s.get('name')} | STARS: {s.get('stars')} | REPO: {s.get('repositoryUrl')}")

find_installable_skills()
