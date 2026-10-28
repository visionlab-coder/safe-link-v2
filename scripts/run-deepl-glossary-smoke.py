#!/usr/bin/env python3
"""VM100 only: execute the freshly built Java client without starting an app or DB."""
import os
from pathlib import Path
import socket
import subprocess
import zipfile

assert os.getuid() == 0 and socket.gethostname() == 'safe-link'
root = Path(__file__).resolve().parent
assert (root / 'bridge-report.json').is_file()
assert not (root / 'live-results.json').exists(), 'Results already exist; do not repeat paid calls accidentally'
unpacked = root / 'java-smoke'
unpacked.mkdir(mode=0o700)
with zipfile.ZipFile(root / 'safe-link-v3-backend-0.1.0.jar') as archive:
    for member in archive.infolist():
        if member.filename.startswith(('BOOT-INF/classes/', 'BOOT-INF/lib/')):
            assert '..' not in Path(member.filename).parts
            archive.extract(member, unpacked)
classpath = f'{root}:{unpacked}/BOOT-INF/classes:{unpacked}/BOOT-INF/lib/*'
result = subprocess.run(['/usr/bin/java', '-cp', classpath, 'DeepLGlossarySmoke', str(root)], timeout=540)
report = root / 'live-results.json'
if report.exists():
    report.chmod(0o644)
raise SystemExit(result.returncode)
