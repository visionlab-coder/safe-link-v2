"""Explicit source-aware bridge preparation on AWS. No keys leave the server."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import socket
import urllib.request
import urllib.error

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', required=True)
    parser.add_argument('--create', action='store_true')
    args = parser.parse_args()
    assert os.getuid() == 0 and socket.gethostname() == 'ip-172-31-46-14'
    root = Path(args.directory)
    env = Path('/etc/safelink/v3-backend.env')
    assert not env.is_symlink() and env.stat().st_mode & 0o077 == 0
    settings = dict(line.split('=', 1) for line in env.read_text().splitlines() if '=' in line and not line.startswith('#'))
    key = settings['DEEPL_API_KEY'].strip().strip('"').strip("'")
    base = settings.get('DEEPL_API_BASE_URL', 'https://api.deepl.com').strip().strip('"')
    assert base in ('https://api.deepl.com', 'https://api-free.deepl.com') and key
    def api(path, payload=None):
        req = urllib.request.Request(base+path, data=None if payload is None else json.dumps(payload).encode(),
            headers={'Authorization':'DeepL-Auth-Key '+key, 'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=40) as r: return json.load(r)
        except urllib.error.HTTPError as e: raise RuntimeError('DEEPL_HTTP_'+str(e.code)) from None
    source = '52f898a5-98d7-4538-b907-46a645fb5136'
    originals, rows = {}, []
    for lang in ('EN','JA','VI','ZH'):
        d = api('/v3/glossaries/'+source+'/entries?source_lang=ko&target_lang='+lang.lower())['dictionaries'][0]
        originals[lang] = dict(line.split('\t',1) for line in d['entries'].splitlines())
        rows.extend([s,t,'KO',lang] for s,t in originals[lang].items())
    with urllib.request.urlopen('https://api.safe-link.co.kr/api/v1/glossary?active=true', timeout=15) as r:
        terms = json.load(r)['terms']
    spec = importlib.util.spec_from_file_location('planner', root/'deepl-glossary-plan.py')
    planner = importlib.util.module_from_spec(spec); spec.loader.exec_module(planner)
    plan = planner.build(rows,terms,json.loads((root/'glossary-delivery-policy.json').read_text()))
    report = {'key':'SET', 'plan':plan, 'originals':originals, 'terms':terms, 'original_changed':False}
    if args.create:
        existing = [g for g in api('/v3/glossaries')['glossaries'] if g['name'] == plan['payload']['name']]
        assert len(existing) <= 1
        created = existing[0] if existing else api('/v3/glossaries',plan['payload'])
        gid = created['glossary_id']; assert gid != source
        for d in plan['payload']['dictionaries']:
            actual = api('/v3/glossaries/'+gid+'/entries?source_lang=ko&target_lang='+d['target_lang'].lower())['dictionaries'][0]['entries']
            assert dict(line.split('\t',1) for line in actual.splitlines()) == dict(line.split('\t',1) for line in d['entries'].splitlines())
        report['glossary_id'] = gid
    output = root/'source-bridge-report.json'
    with output.open('x') as f: json.dump(report,f,ensure_ascii=False,indent=2)
    output.chmod(0o644)  # Term metadata only, no credentials.
    print(json.dumps({'key':'SET','revision':plan['revision'],'glossary_id':report.get('glossary_id'),
        'counts':{d['target_lang']:len(d['entries'].splitlines()) for d in plan['payload']['dictionaries']}}))

if __name__ == '__main__':
    try: main()
    except Exception as error:
        print('FAILED '+(str(error) if isinstance(error, (AssertionError, RuntimeError)) else type(error).__name__))
        raise SystemExit(1)
