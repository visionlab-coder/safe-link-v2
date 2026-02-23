import os
import requests
import json

def api_get(endpoint, params=None):
    api_key = os.getenv("SKILLSMP_API_KEY")
    headers = {"Authorization": f"Bearer {api_key}"}
    url = f"https://skillsmp.com/api/v1{endpoint}"
    r = requests.get(url, headers=headers, params=params)
    r.raise_for_status()
    return r.json()

def search_top():
    # Use AI search for better relevance to the project
    query = "Skills for a Next.js Supabase app with real-time translation and safety monitoring"
    print(f"Searching for: {query}")
    data = api_get("/skills/ai-search", params={"q": query})
    skills = data.get("data", {}).get("data", [])
    
    for item in skills:
        skill = item.get("skill", {})
        score = item.get("score", 0)
        print(f"ID: {skill.get('id')}")
        print(f"NAME: {skill.get('name')}")
        print(f"STARS: {skill.get('stars')}")
        print(f"REPO: {skill.get('repositoryUrl')}")
        print(f"SCORE: {score}")
        print("---")

search_top()
