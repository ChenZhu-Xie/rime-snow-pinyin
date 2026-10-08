from __future__ import annotations

import importlib.util
import inspect
import random
import unittest

import numpy as np

import completion_onset_strata as onset_strata


class CompletionOnsetStrataAvailabilityTests(unittest.TestCase):
    def test_onset_strata_helper_module_exists(self):
        self.assertIsNotNone(importlib.util.find_spec('completion_onset_strata'))

    def test_select_representatives_keeps_best_row_per_exact_signature(self):
        select = getattr(onset_strata, 'select_onset_representatives', None)
        self.assertTrue(callable(select))
        rows = [
            {'id': 'same-slow', 'state': [1, 2] + [0] * 65, 'eightWorstRatio': 1.02},
            {'id': 'same-fast', 'state': [1, 2] + [3] * 65, 'eightWorstRatio': 1.01},
            {'id': 'other', 'state': [2, 1] + [0] * 65, 'eightWorstRatio': 1.015},
        ]
        selected = select(rows, onset_count=2, limit=2)
        self.assertEqual([row['id'] for row in selected], ['same-fast', 'other'])

    def test_mutate_onsets_changes_requested_number_to_physical_keys(self):
        mutate = getattr(onset_strata, 'mutate_onsets', None)
        self.assertTrue(callable(mutate))
        state = np.zeros(67, dtype=np.int32)
        changed = mutate(state, [0, 1, 2, 3], 2, 2, random.Random(7))
        positions = [index for index in range(27) if state[index] != 0]
        self.assertEqual(len(positions), 2)
        self.assertEqual(changed, positions)
        self.assertTrue(all(int(state[index]) in {1, 2, 3} for index in positions))

    def test_select_representatives_preserves_metric_extremes_within_signature(self):
        select = onset_strata.select_onset_representatives
        self.assertIn('metric_keys', inspect.signature(select).parameters)
        rows = [
            {'id': 'best-worst', 'state': [1, 2] + [0] * 65,
             'eightWorstRatio': 1.01, 'wj1': .12, 'wj2': .20},
            {'id': 'best-wj1', 'state': [1, 2] + [3] * 65,
             'eightWorstRatio': 1.02, 'wj1': .10, 'wj2': .21},
            {'id': 'best-wj2', 'state': [1, 2] + [4] * 65,
             'eightWorstRatio': 1.03, 'wj1': .13, 'wj2': .18},
        ]
        selected = select(rows, onset_count=2, limit=3,
                          metric_keys=('eightWorstRatio', 'wj1', 'wj2'))
        self.assertEqual({row['id'] for row in selected},
                         {'best-worst', 'best-wj1', 'best-wj2'})

    def test_stratified_beam_reserves_d0_and_d1_rows_across_objectives(self):
        select = getattr(onset_strata, 'select_stratified_beam', None)
        self.assertTrue(callable(select))
        rows = [
            {'id': 'd0-max', 'D': 0, 'eightWorstRatio': 1.01, 'wordExcess': .04,
             'wj1Ratio': 1.02},
            {'id': 'd0-wj1', 'D': 0, 'eightWorstRatio': 1.03, 'wordExcess': .05,
             'wj1Ratio': 1.00},
            {'id': 'd1-max', 'D': 1, 'eightWorstRatio': .99, 'wordExcess': 0,
             'wj1Ratio': .98},
            {'id': 'd1-other', 'D': 1, 'eightWorstRatio': 1.00, 'wordExcess': .01,
             'wj1Ratio': .97},
        ]
        selected = select(rows, per_displaced=2,
                          objective_keys=('eightWorstRatio', 'wj1Ratio'))
        self.assertEqual({row['id'] for row in selected},
                         {'d0-max', 'd0-wj1', 'd1-max', 'd1-other'})


if __name__ == '__main__':
    unittest.main()
