import os
import requests
import json

def get_data(q):
    api_key = os.getenv("SKILLSMP_API_KEY")
    headers = {"Authorization": f"Bearer {api_key}"}
    r = requests.get("https://skillsmp.com/api/v1/skills/search", headers=headers, params={"q": q})
    return r.json()

results = get_data("postgres-patterns")
skills = results.get("data", {}).get("skills", [])
for s in skills:
    print(f"NAME: {s.get('name')}")
    print(f"REPO: {s.get('repositoryUrl')}")
    print(f"STARS: {s.get('stars')}")
    print("---")
