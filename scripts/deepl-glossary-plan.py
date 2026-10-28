#!/usr/bin/env python3
"""Offline, deterministic DeepL bridge planner. Never writes a vendor glossary or credentials.

Inputs: DeepL's four-column CSV export, SQ Link /glossary JSON, shared delivery policy.
Output: reviewable create-glossary payload plus exclusions and a content revision.
"""
import argparse
import csv
import hashlib
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

LANGUAGES = ('EN', 'JA', 'VI', 'ZH')


def clean(value):
    return unicodedata.normalize('NFC', value).strip()


def delivery(slang, standard, policy):
    if slang in policy['preserveTerms']:
        return slang
    if slang in policy['reviewedTerms']:
        return policy['reviewedTerms'][slang]
    if re.search(r'[（(]', standard) and not re.search(r'[)）]\s*$', standard):
        return slang
    core = re.split(r'[（(]', standard, maxsplit=1)[0].strip()
    return slang if not core or re.search(r'[,，/;；\n:：=)）]', core) else core


def build(rows, terms, policy):
    originals = {lang: {} for lang in LANGUAGES}
    for row in rows:
        if len(row) != 4 or row[2].upper() != 'KO' or row[3].upper() not in originals:
            raise ValueError('Unexpected glossary CSV columns or language')
        source, target = map(clean, row[:2])
        if not source or not target or any(c in source + target for c in '\t\r\n'):
            raise ValueError('Invalid glossary entry')
        dictionary = originals[row[3].upper()]
        if source in dictionary:
            raise ValueError('Duplicate source/language')
        dictionary[source] = target
    active = {clean(t['slang']): t for t in terms if t.get('is_active', t.get('isActive', False))}
    for source, term in active.items():
        # Reject drift between this offline planner and the API's effective delivery policy.
        if 'delivery_term' in term and clean(term['delivery_term']) != clean(delivery(source, term['standard'], policy)):
            raise ValueError('SQ delivery policy differs; refresh inputs before creating glossary')
        if term.get('delivery_policy_version', policy['version']) != policy['version']:
            raise ValueError('SQ delivery policy version differs')
    unsafe = set(policy['ambiguousTerms'])
    dictionaries, excluded, missing = [], [], []
    for lang in LANGUAGES:
        candidates = defaultdict(set)
        for source, target in originals[lang].items():
            if source not in active:
                excluded.append({'language': lang, 'source': source, 'reason': 'inactive_or_absent'})
                continue
            if source in unsafe:
                excluded.append({'language': lang, 'source': source, 'reason': 'ambiguous_sentence_term'})
                continue
            candidates[source].add(target)
            alias = clean(delivery(source, active[source]['standard'], policy))
            if alias not in unsafe:
                candidates[alias].add(target)
        for source in active:
            if source not in originals[lang]:
                missing.append({'language': lang, 'source': source})
        accepted = {}
        for source, targets in sorted(candidates.items()):
            if len(targets) == 1:
                accepted[source] = next(iter(targets))
            else:
                excluded.append({'language': lang, 'source': source, 'reason': 'conflicting_targets', 'targets': sorted(targets)})
        if not accepted:
            raise ValueError('Empty target dictionary')
        dictionaries.append({'source_lang': 'KO', 'target_lang': lang, 'entries_format': 'tsv',
                             'entries': '\n'.join(f'{s}\t{t}' for s, t in accepted.items())})
    revision = hashlib.sha256(json.dumps({'dictionaries': dictionaries, 'policy': policy}, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
    return {'revision': revision, 'source_glossary_id': '52f898a5-98d7-4538-b907-46a645fb5136',
            'policy_version': policy['version'], 'active_sq_terms': len(active),
            'payload': {'name': 'SQLink-standard-bridge-' + revision[:16], 'dictionaries': dictionaries},
            'excluded': excluded, 'missing': missing}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--csv', required=True)
    parser.add_argument('--sq-json', required=True)
    parser.add_argument('--policy', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    with open(args.csv, encoding='utf-8-sig', newline='') as stream:
        rows = list(csv.reader(stream))
    plan = build(rows, json.loads(Path(args.sq_json).read_text())['terms'], json.loads(Path(args.policy).read_text()))
    # Refuse accidental overwrite of an already reviewed plan.
    with open(args.output, 'x', encoding='utf-8') as stream:
        json.dump(plan, stream, ensure_ascii=False, indent=2)
    print(json.dumps({'revision': plan['revision'], 'counts': {d['target_lang']: len(d['entries'].splitlines()) for d in plan['payload']['dictionaries']},
                      'excluded': len(plan['excluded']), 'missing': len(plan['missing'])}))


if __name__ == '__main__':
    main()
