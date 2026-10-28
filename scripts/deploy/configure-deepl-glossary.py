#!/usr/bin/env python3
"""AWS-only, explicit glossary configuration with protected backup; never exports keys.

Default: read-only API/config preflight. --configure: change only the two glossary
settings for the next normal release restart. No database, DNS or service changes.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import urllib.error
import urllib.request

GLOSSARY = '7201ad79-923a-4cf1-8d6d-9a2d150ce45c'
REVISION = '6433ebc83455814a5af578d30b3da3839a0093eb2cd6ec97b91f9f8ae2dc1638'
PREVIOUS = '62466579a89f6353da06a27d70b5e7447a0dbd80'
ENV = Path('/etc/safelink/v3-backend.env')
BACKUP = Path('/etc/safelink/deepl-glossary-before-20261028')


def main():
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--configure', action='store_true')
    options = args.parse_args()
    assert os.getuid() == 0 and socket.gethostname() == 'ip-172-31-46-14'
    assert not ENV.is_symlink() and ENV.stat().st_uid == 0 and ENV.stat().st_mode & 0o077 == 0
    raw = ENV.read_bytes()
    settings = {}
    for line in raw.decode().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            settings[k.strip()] = v.strip().strip('"').strip("'")
    assert settings.get('SAFE_LINK_TRANSLATION_PROVIDER') == 'deepl', 'UNEXPECTED_PROVIDER'
    assert settings.get('DEEPL_API_KEY'), 'DEEPL_API_KEY_MISSING'
    base = settings.get('DEEPL_API_BASE_URL', 'https://api.deepl.com')
    assert base in ('https://api.deepl.com', 'https://api-free.deepl.com')
    request = urllib.request.Request(base + '/v3/glossaries/' + GLOSSARY,
        headers={'Authorization': 'DeepL-Auth-Key ' + settings['DEEPL_API_KEY']})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            metadata = json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError('DEEPL_HTTP_' + str(error.code)) from None
    except (urllib.error.URLError, TimeoutError):
        raise RuntimeError('DEEPL_NETWORK_ERROR') from None
    assert metadata['glossary_id'] == GLOSSARY
    counts = {(d['source_lang'].upper(), d['target_lang'].upper()): d['entry_count'] for d in metadata['dictionaries']}
    assert counts == {('KO', 'EN'): 828, ('KO', 'JA'): 830, ('KO', 'VI'): 830, ('KO', 'ZH'): 830}, 'DICTIONARY_CHANGED'
    desired = {'DEEPL_GLOSSARY_ID': GLOSSARY, 'DEEPL_GLOSSARY_REVISION': REVISION}
    configured = all(settings.get(k) == v for k, v in desired.items())
    if options.configure and not configured:
        assert Path('/home/ubuntu/safelink-v3/current').resolve().name == PREVIOUS, 'RELEASE_CHANGED_RECHECK'
        os.umask(0o077)
        BACKUP.mkdir(mode=0o700)
        shutil.copy2(ENV, BACKUP / 'v3-backend.env')
        (BACKUP / 'previous-release').write_text(PREVIOUS + '\n')
        lines = [line for line in raw.decode().splitlines() if line.split('=', 1)[0].strip() not in desired]
        updated = ('\n'.join(lines) + '\n' + '\n'.join(k + '=' + v for k, v in desired.items()) + '\n').encode()
        pending = ENV.with_name('v3-backend.env.deepl-pending')
        with pending.open('xb') as stream:
            stream.write(updated); stream.flush(); os.fsync(stream.fileno())
        os.chown(pending, ENV.stat().st_uid, ENV.stat().st_gid)
        pending.chmod(0o600)
        assert ENV.read_bytes() == raw, 'CONCURRENT_ENV_CHANGE'
        pending.replace(ENV)
        (BACKUP / 'configured-sha256').write_text(hashlib.sha256(updated).hexdigest() + '\n')
        configured = True
    print(json.dumps({'key': 'SET', 'glossary_access': 'PASS', 'configured': configured,
        'glossary_id': GLOSSARY, 'revision': REVISION,
        'backup_created': BACKUP.exists(), 'services_restarted': False}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('GLOSSARY_CONFIGURATION_FAILED ' + (str(error) if isinstance(error, (AssertionError, RuntimeError)) else type(error).__name__))
        raise SystemExit(1)
