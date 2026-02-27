import json
data = json.load(open('c:/Users/seowo/Documents/dev/seowon-projects/SAFE-LINK-V2/.agents/skills/skillsmp-search/scripts/search_output.json', encoding='utf-16le'))
for i, x in enumerate(data[:5]):
    print(f"{i+1}. {x['name']} ({x['author']}) - {x['description']}")
    print(f"URL: {x.get('skillUrl', '')}\n")
