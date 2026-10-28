import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('planner', ROOT / 'scripts/deepl-glossary-plan.py')
planner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(planner)
POLICY = json.loads((ROOT / 'src/constants/glossary-delivery-policy.json').read_text())


class PlanTest(unittest.TestCase):
    def plan(self, pairs, terms):
        return planner.build([[s, t, 'KO', lang] for lang in planner.LANGUAGES for s, t in pairs], terms, POLICY)

    def term(self, slang, standard, active=True):
        return {'slang': slang, 'standard': standard, 'is_active': active}

    def test_raw_and_normalized_words_share_translation_without_reverse_rewriting(self):
        result = self.plan([('간조', 'calculation'), ('가타와꾸', 'formwork'), ('데모도', 'assistant')],
                           [self.term('간조', '셈'), self.term('가타와꾸', '틀/거푸집'), self.term('데모도', '보조공, 조수')])
        for dictionary in result['payload']['dictionaries']:
            self.assertIn('간조\tcalculation', dictionary['entries'])
            self.assertIn('셈\tcalculation', dictionary['entries'])
            self.assertIn('거푸집\tformwork', dictionary['entries'])
            self.assertIn('보조공\tassistant', dictionary['entries'])
            self.assertNotIn('보조공, 조수', dictionary['entries'])

    def test_conflicts_disabled_and_sentence_homonyms_are_not_guessed(self):
        terms = [self.term('가도', '모서리'), self.term('고시', '격자', False), self.term('a', '표준'), self.term('b', '표준')]
        result = self.plan([('가도', 'edge'), ('고시', 'grid'), ('a', 'one'), ('b', 'two')], terms)
        for dictionary in result['payload']['dictionaries']:
            self.assertNotIn('가도\t', dictionary['entries'])
            self.assertNotIn('고시\t', dictionary['entries'])
            self.assertNotIn('표준\t', dictionary['entries'])
        self.assertEqual(4, sum(x['reason'] == 'conflicting_targets' for x in result['excluded']))

    def test_revision_tracks_provider_terms_and_delivery_policy(self):
        terms = [self.term('간조', '셈')]
        first = self.plan([('간조', 'calculation')], terms)
        self.assertEqual(first['revision'], self.plan([('간조', 'calculation')], terms)['revision'])
        self.assertNotEqual(first['revision'], self.plan([('간조', 'settlement')], terms)['revision'])

    def test_literal_source_has_priority_over_a_conflicting_generated_alias(self):
        result = self.plan([('마에가리', 'advance payment'), ('가불', 'advance')],
                           [self.term('마에가리', '가불'), self.term('가불', '선급')])
        for d in result['payload']['dictionaries']:
            entries = dict(line.split('\t') for line in d['entries'].splitlines())
            self.assertEqual(entries['마에가리'], 'advance payment')
            self.assertEqual(entries['가불'], 'advance')

    def test_preserved_words_and_unreviewed_explanations_stay_intact(self):
        self.assertEqual('거푸집', planner.delivery('거푸집', '틀', POLICY))
        self.assertEqual('테스트', planner.delivery('테스트', '주입(그라우팅)한다', POLICY))
        self.assertEqual('테스트', planner.delivery('테스트', '첫째, 둘째', POLICY))

    def test_api_delivery_policy_drift_fails_closed(self):
        term = self.term('간조', '셈')
        term['delivery_term'] = '다른 말'
        with self.assertRaises(ValueError):
            self.plan([('간조', 'calculation')], [term])
        term['delivery_term'] = '셈'
        term['delivery_policy_version'] = 'future-unreviewed'
        with self.assertRaises(ValueError):
            self.plan([('간조', 'calculation')], [term])


if __name__ == '__main__':
    unittest.main()
