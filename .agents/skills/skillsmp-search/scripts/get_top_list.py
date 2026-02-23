import os
import requests
import json

def get_top_skills():
    api_key = os.getenv("SKILLSMP_API_KEY")
    headers = {"Authorization": f"Bearer {api_key}"}
    url = "https://skillsmp.com/api/v1/skills/search"
    params = {"q": "", "sortBy": "stars", "limit": 20}
    
    try:
        r = requests.get(url, headers=headers, params=params)
        r.raise_for_status()
        data = r.json()
        skills = data.get("data", {}).get("skills", [])
        
        for s in skills:
            print(f"ID: {s.get('id')}")
            print(f"NAME: {s.get('name')}")
            print(f"STARS: {s.get('stars')}")
            print(f"REPO: {s.get('repositoryUrl')}")
            print(f"DOCS: {s.get('skillUrl')}")
            print("---")
    except Exception as e:
        print(f"Error: {e}")

get_top_skills()
