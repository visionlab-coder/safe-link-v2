import os
import requests
import json

def search_skills(query, limit=10):
    api_key = os.getenv("SKILLSMP_API_KEY")
    if not api_key:
        print("API Key not set")
        return []
    
    headers = {"Authorization": f"Bearer {api_key}"}
    url = "https://skillsmp.com/api/v1/skills/search"
    params = {"q": query, "sortBy": "stars", "limit": limit}
    
    try:
        r = requests.get(url, headers=headers, params=params)
        r.raise_for_status()
        data = r.json()
        return data.get("data", {}).get("skills", [])
    except Exception as e:
        print(f"Error searching for {query}: {e}")
        return []

queries = ["supabase", "translation", "safety", "ai chat", "nextjs", "cloudflare"]
all_results = []
for q in queries:
    results = search_skills(q)
    all_results.extend(results)

unique_skills = {}
for s in all_results:
    skill_id = s.get("id")
    if skill_id not in unique_skills or s.get("stars", 0) > unique_skills[skill_id].get("stars", 0):
        unique_skills[skill_id] = s

sorted_skills = sorted(unique_skills.values(), key=lambda x: x.get("stars", 0), reverse=True)

for s in sorted_skills:
    print(json.dumps({
        "id": s.get("id"),
        "name": s.get("name"),
        "stars": s.get("stars"),
        "repositoryUrl": s.get("repositoryUrl"),
        "skillUrl": s.get("skillUrl")
    }))
