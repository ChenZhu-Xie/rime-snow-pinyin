"""Behavior checks for high-CKT, strong-secondary-metric search poles."""
from __future__ import annotations

import random
import unittest

import completion_counterpoles as counterpoles
from completion_counterpoles import (choose_attribute_parents, choose_cross_parents,
                                     fixed_composite, select_attribute_poles,
                                     select_counterpoles, state_distance)
from integrate_shenyun_completion_v2_frontier import select_rows


class CounterpoleTests(unittest.TestCase):
    def test_fixed_objective_selects_old_column_improvement(self):
        def modes(ms):
            return {mode: {kind: {'completionUpperMs': ms, 'p2': 0,
                                  'stageWeight': [1], 'meanKeys': 2 if kind == 'character' else 4}
                           for kind in ('character', 'word')}
                    for mode in ('keytao', 'sanpin')}
        baseline = {'S005': {'modes': modes(100)},
                    'existing': {'modes': modes(95), 'tone': 'IVUAO', 'capacity': [21, 21],
                                 'memory': 48, 'displaced': 7}}
        doc = {'objective': 'fixed', 'results': [
            {'id': 'old-column-winner', 'M': 48, 'D': 7, 'fixed12': 9.3, 'ckt12': 10.2},
            {'id': 'v2-winner', 'M': 48, 'D': 7, 'fixed12': 9.7, 'ckt12': 9.2},
        ]}
        selected = select_rows(doc, {'S005', 'existing'}, baseline, baseline, (600, 300, 300))
        self.assertEqual([row['id'] for row in selected], ['old-column-winner'])

    def test_fixed_score_uses_word_weight_and_selection_time(self):
        base = {mode: {kind: {'completionUpperMs': 100, 'p2': 0}
                       for kind in ('character', 'word')}
                for mode in ('keytao', 'sanpin')}
        candidate = {mode: {kind: {'completionUpperMs': 100, 'p2': 0}
                            for kind in ('character', 'word')}
                     for mode in ('keytao', 'sanpin')}
        for mode in candidate:
            candidate[mode]['word'] = {'completionUpperMs': 110, 'p2': 0}
        self.assertAlmostEqual(fixed_composite(candidate, base, 600),
                               10 * ((2 + 4 * 1.1**4) / 6)**.25)
        candidate['keytao']['character'] = {'completionUpperMs': 100, 'p2': .1}
        self.assertAlmostEqual(fixed_composite(candidate, base, 600),
                               10 * ((1.6**4 + 1 + 4 * 1.1**4) / 6)**.25)

    def test_slow_but_high_home_and_low_pinky_poles_survive(self):
        rows = [
            {'id': 'fast-extreme', 'oldFixed12': 8, 'homeS2': .70, 'Pmax': .01, 'M': 38, 'D': 0, 'eightWorstRatio': .8},
            {'id': 'home', 'oldFixed12': 11, 'homeS2': .60, 'Pmax': .10, 'M': 44, 'D': 3, 'eightWorstRatio': 1.2},
            {'id': 'pinky', 'oldFixed12': 12, 'homeS2': .40, 'Pmax': .02, 'M': 44, 'D': 3, 'eightWorstRatio': 1.2},
            {'id': 'memory', 'oldFixed12': 13, 'homeS2': .40, 'Pmax': .10, 'M': 39, 'D': 0, 'eightWorstRatio': 1.2},
            {'id': 'ordinary', 'oldFixed12': 9, 'homeS2': .45, 'Pmax': .08, 'M': 45, 'D': 4, 'eightWorstRatio': 1.1},
        ]
        threshold, poles = select_counterpoles(rows, quantile=.4, per_axis=1)
        self.assertEqual(threshold, 11)
        self.assertEqual({r['id'] for r in poles}, {'home', 'pinky', 'memory'})

    def test_crosses_include_a_slow_pole_and_frontier_parent(self):
        pole = {'id': 'slow'}
        elite = [{'id': 'fast1'}, {'id': 'fast2'}]
        bridges = [{'id': 'lowM'}, {'id': 'lowD'}]
        for kind in ('line', 'face', 'mutate'):
            parents = choose_cross_parents(kind, pole, elite, bridges, random.Random(3))
            ids = [r['id'] for r in parents]
            self.assertIn('slow', ids)
            self.assertTrue({'fast1', 'fast2'} & set(ids))
            self.assertEqual(len(ids), len(set(ids)))
            self.assertGreaterEqual(len(ids), 3 if kind == 'face' else 2)

    def test_attribute_poles_cover_distinct_axes_and_states(self):
        axes = ('homeS2', 'Pmax', 'eightWorstRatio', 'M', 'v4', 'v5', 'S2ms',
                'ckt12tau0', 'j1', 'j2', 's1', 's2', 'wj1', 'wj2', 'ws1', 'ws2')
        rows = []
        for index in range(16):
            row = {key: 100.0 for key in axes}
            row.update(id=str(index), state=[index] * 62, fixed12=10.0,
                       M=40, D=0, homeS2=.5)
            if index == 0:
                row['homeS2'] = .9
            if index == 1:
                row['Pmax'] = .001
            if index == 2:
                row['eightWorstRatio'] = .5
            rows.append(row)
        poles, labels = select_attribute_poles(rows, excluded={'0'}, top_share=.25)
        self.assertNotIn('0', {r['id'] for r in poles})
        self.assertEqual(len(poles), len({r['id'] for r in poles}))
        self.assertTrue(all(state_distance(a, b) >= 8 for i, a in enumerate(poles)
                            for b in poles[i + 1:]))
        self.assertEqual([item['id'] for item in labels], [r['id'] for r in poles])

    def test_v2_poles_use_v2_score_without_old_column(self):
        axes = ('homeS2', 'Pmax', 'eightWorstRatio', 'M', 'v4', 'v5', 'S2ms',
                'ckt12tau0', 'j1', 'j2', 's1', 's2', 'wj1', 'wj2', 'ws1', 'ws2')
        rows = []
        for index in range(15):
            row = {key: 100.0 for key in axes}
            row.update(id=str(index), state=[index] * 62, ckt12=9.0 + index / 10,
                       fixed12=None, M=40, D=0, homeS2=.5)
            if index == 0:
                row['homeS2'] = .9
            if index == 1:
                row['Pmax'] = .001
            rows.append(row)
        poles, labels = select_attribute_poles(rows, score_key='ckt12', limit=3)
        self.assertTrue(poles)
        self.assertEqual({item['scoreKey'] for item in labels}, {'ckt12'})
        self.assertTrue(all(item['score'] == poles[index]['ckt12']
                            for index, item in enumerate(labels)))

    def test_attribute_face_uses_two_poles_and_fast_parent(self):
        poles = [{'id': 'home'}, {'id': 'pinky'}, {'id': 'B'}]
        parents = choose_attribute_parents('face', poles[0], poles,
                                            [{'id': 'fast'}], [{'id': 'bridge'}],
                                            random.Random(4))
        self.assertEqual(len(parents), 4)
        self.assertEqual(parents[0]['id'], 'home')
        self.assertIn(parents[1]['id'], {'pinky', 'B'})
        self.assertEqual(parents[2]['id'], 'fast')
        self.assertEqual(parents[3]['id'], 'bridge')

    def test_anchored_line_connects_high_dimensional_and_low_md_endpoints(self):
        choose = getattr(counterpoles, 'choose_anchored_parents', None)
        self.assertIsNotNone(choose, 'anchored endpoint selection is not implemented')
        endpoint = {'id': 'new-global', 'M': 48, 'D': 7}
        low_md = [{'id': 'm39d0', 'M': 39, 'D': 0}]
        parents = choose('line', endpoint, [endpoint, {'id': 'home-pole', 'M': 46, 'D': 5}],
                         low_md, [], random.Random(2), low_md_share=1)
        self.assertEqual([row['id'] for row in parents], ['new-global', 'm39d0'])

    def test_anchored_face_combines_two_endpoints_with_low_md_parent(self):
        choose = getattr(counterpoles, 'choose_anchored_parents', None)
        self.assertIsNotNone(choose, 'anchored endpoint selection is not implemented')
        endpoint = {'id': 'new-global', 'M': 48, 'D': 7}
        endpoints = [endpoint, {'id': 'home-pole', 'M': 46, 'D': 5},
                     {'id': 'pinky-pole', 'M': 43, 'D': 2}]
        low_md = [{'id': 'm39d0', 'M': 39, 'D': 0}]
        parents = choose('face', endpoint, endpoints, low_md,
                         [{'id': 'bridge', 'M': 41, 'D': 1}], random.Random(3))
        ids = [row['id'] for row in parents]
        self.assertEqual(ids[0], 'new-global')
        self.assertIn(ids[1], {'home-pole', 'pinky-pole'})
        self.assertEqual(ids[2], 'm39d0')
        self.assertEqual(len(ids), len(set(ids)))

    def test_explicit_endpoints_resolve_ids_and_atlas_ids_without_duplicates(self):
        resolve = getattr(counterpoles, 'resolve_endpoint_rows', None)
        self.assertIsNotNone(resolve, 'explicit endpoint resolution is not implemented')
        rows = [{'id': 'hash-a', 'atlasId': 'atlas-a'}, {'id': 'hash-b'}]
        resolved = resolve(rows, ['atlas-a', 'hash-b', 'atlas-a'])
        self.assertEqual([row['id'] for row in resolved], ['hash-a', 'hash-b'])

    def test_explicit_endpoints_reject_missing_ids(self):
        resolve = getattr(counterpoles, 'resolve_endpoint_rows', None)
        self.assertIsNotNone(resolve, 'explicit endpoint resolution is not implemented')
        with self.assertRaisesRegex(ValueError, 'missing'):
            resolve([{'id': 'present'}], ['missing'])


if __name__ == '__main__':
    unittest.main()
