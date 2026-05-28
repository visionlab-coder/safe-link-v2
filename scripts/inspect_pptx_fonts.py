from __future__ import annotations

import re
import sys
import zipfile
from collections import Counter


def main() -> None:
    path = sys.argv[1]
    sizes: list[float] = []
    with zipfile.ZipFile(path) as zf:
        for name in zf.namelist():
            if not name.startswith("ppt/slides/slide") or not name.endswith(".xml"):
                continue
            xml = zf.read(name).decode("utf-8", "ignore")
            sizes.extend(int(v) / 100 for v in re.findall(r'sz="(\d+)"', xml))
    counts = Counter(sizes)
    print(f"font_entries={len(sizes)}")
    print(f"min_pt={min(sizes) if sizes else 'none'}")
    print("sizes=" + ", ".join(f"{size:g}:{count}" for size, count in sorted(counts.items())))


if __name__ == "__main__":
    main()
