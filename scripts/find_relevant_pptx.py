from pathlib import Path

roots = [
    Path.home() / "Downloads",
    Path.home() / "Documents" / "dev",
]
tokens = ("framexr", "fram", "pour", "gate", "dev", "todo", "sync")
found = []
for root in roots:
    if not root.exists():
        continue
    for path in root.rglob("*.pptx"):
        name = path.name.lower()
        if any(token in name for token in tokens):
            try:
                found.append((path.stat().st_mtime, path, path.stat().st_size))
            except OSError:
                pass

for _, path, size in sorted(found, reverse=True)[:50]:
    print(f"{path}\t{size}")
