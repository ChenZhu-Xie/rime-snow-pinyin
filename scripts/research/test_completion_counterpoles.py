"""Behavior checks for high-CKT, strong-secondary-metric search poles."""
from __future__ import annotations

import random
import unittest

from completion_counterpoles import choose_cross_parents, fixed_composite, select_counterpoles
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


if __name__ == '__main__':
    unittest.main()
