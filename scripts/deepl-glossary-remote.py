#!/usr/bin/env python3
"""Audit/create a separate, reviewed DeepL bridge. Never edits the source glossary.

Run on VM100 with the already approved root-only key file. No key is exported.
The default audit is read-only; --create explicitly enables ONE new glossary.
"""
import argparse
import csv
import json
import os
import socket
import urllib.error
import urllib.request
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', required=True)
    parser.add_argument('--create', action='store_true')
    args = parser.parse_args()
    assert socket.gethostname() == 'safe-link' and os.getuid() == 0
    root = Path(args.directory)
    plan = json.loads((root / 'plan.json').read_text())
    keyfile = Path('/etc/safelink/rehearsal-ai-keys.json')
    assert not keyfile.is_symlink() and keyfile.stat().st_uid == 0
    assert keyfile.stat().st_mode & 0o077 == 0
    settings = json.loads(keyfile.read_text())
    key = settings.get('DEEPL_API_KEY', '').strip()
    assert key, 'DEEPL_API_KEY=MISSING'
    base = settings.get('DEEPL_API_BASE_URL', 'https://api.deepl.com')
    assert base in ('https://api.deepl.com', 'https://api-free.deepl.com')

    def api(path, payload=None):
        request = urllib.request.Request(base + path,
            data=None if payload is None else json.dumps(payload, ensure_ascii=False).encode(),
            headers={'Authorization': 'DeepL-Auth-Key ' + key, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            # Never emit vendor bodies, authorization, or exception request data.
            raise RuntimeError('DEEPL_HTTP_' + str(error.code)) from None
        except (urllib.error.URLError, TimeoutError):
            raise RuntimeError('DEEPL_NETWORK_ERROR') from None

    def entries(glossary_id, language):
        result = api('/v3/glossaries/' + glossary_id + '/entries?source_lang=ko&target_lang=' + language.lower())
        dictionaries = result['dictionaries']
        assert len(dictionaries) == 1
        dictionary = dictionaries[0]
        assert dictionary['source_lang'].upper() == 'KO' and dictionary['target_lang'].upper() == language
        return dict(line.split('\t', 1) for line in dictionary['entries'].splitlines() if line)

    source_id = plan['source_glossary_id']
    metadata = api('/v3/glossaries/' + source_id)
    assert metadata['glossary_id'] == source_id
    exported = {lang: {} for lang in ('EN', 'JA', 'VI', 'ZH')}
    with (root / 'source.csv').open(encoding='utf-8-sig', newline='') as stream:
        for source, target, source_lang, target_lang in csv.reader(stream):
            assert source_lang.upper() == 'KO'
            exported[target_lang.upper()][source.strip()] = target.strip()
    for lang, expected in exported.items():
        assert entries(source_id, lang) == expected, 'SOURCE_CHANGED_' + lang
    report = {'source_id': source_id, 'source_verified': True, 'key': 'SET',
              'source_counts': {lang: len(values) for lang, values in exported.items()},
              'revision': plan['revision'], 'original_changed': False, 'aws_changed': False}
    if args.create:
        existing = [g for g in api('/v3/glossaries')['glossaries'] if g['name'] == plan['payload']['name']]
        assert len(existing) <= 1, 'DUPLICATE_BRIDGE_NAME'
        # An unknown POST outcome must be recovered by listing, never blind retries.
        created = existing[0] if existing else api('/v3/glossaries', plan['payload'])
        bridge_id = created['glossary_id']
        assert bridge_id != source_id
        for dictionary in plan['payload']['dictionaries']:
            assert entries(bridge_id, dictionary['target_lang']) == dict(
                line.split('\t', 1) for line in dictionary['entries'].splitlines())
        report.update({'glossary_id': bridge_id, 'name': plan['payload']['name'],
                       'created': not bool(existing), 'bridge_verified': True})
    output = root / ('bridge-report.json' if args.create else 'audit-report.json')
    with output.open('x') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
    output.chmod(0o644)  # Report contains IDs/counts only, never credentials.
    print(json.dumps(report), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('GLOSSARY_CHECK_FAILED ' + (str(error) if isinstance(error, (AssertionError, RuntimeError)) else type(error).__name__), flush=True)
        raise SystemExit(1)
