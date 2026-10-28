"""Read-only vendor test. Credentials stay on the production host; outputs contain test phrases only."""
import json, socket, os, urllib.request, urllib.error
from pathlib import Path

def main():
    assert os.getuid() == 0 and socket.gethostname() == 'ip-172-31-46-14'
    root=Path('/home/ubuntu/deepl-source-fix-20261028')
    report=json.loads((root/'source-bridge-report.json').read_text())
    fixtures=json.loads((root/'deepl-source-conflicts.json').read_text())
    env=Path('/etc/safelink/v3-backend.env')
    assert env.stat().st_mode & 0o077 == 0
    settings=dict(l.split('=',1) for l in env.read_text().splitlines() if '=' in l and not l.startswith('#'))
    key=settings['DEEPL_API_KEY'].strip().strip('"').strip("'")
    base=settings.get('DEEPL_API_BASE_URL','https://api.deepl.com').strip().strip('"')
    assert base in ('https://api.deepl.com','https://api-free.deepl.com') and key
    results=[]
    for lang in ('EN','JA','VI','ZH'):
        payload={'text':[f['source'] for f in fixtures], 'source_lang':'KO','target_lang':lang,'glossary_id':report['glossary_id']}
        req=urllib.request.Request(base+'/v2/translate',data=json.dumps(payload).encode(),headers={'Authorization':'DeepL-Auth-Key '+key,'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(req,timeout=60) as r: translations=json.load(r)['translations']
        except urllib.error.HTTPError as e: raise RuntimeError('DEEPL_HTTP_'+str(e.code)) from None
        assert len(translations)==len(fixtures)
        for f,t in zip(fixtures,translations):
            actual=t['text'].strip(); expected=f['targets'][lang]
            results.append({'language':lang,'source':f['source'],'expected':expected,'actual':actual,'pass':actual.casefold()==expected.casefold()})
    out=root/'vendor-source-results.json'
    out.write_text(json.dumps(results,ensure_ascii=False,indent=2));out.chmod(0o644)
    print(json.dumps({'passed':sum(r['pass'] for r in results),'total':len(results),'failures':[r for r in results if not r['pass']]},ensure_ascii=False))
    assert all(r['pass'] for r in results)

if __name__=='__main__':
    try: main()
    except Exception as e:
        print('FAILED '+(str(e) if isinstance(e,RuntimeError) else type(e).__name__))
        raise SystemExit(1)
