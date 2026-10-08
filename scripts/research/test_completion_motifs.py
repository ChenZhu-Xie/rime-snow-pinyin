from __future__ import annotations

import random
import unittest

import numpy as np

from completion_motifs import MOTIFS, apply_soft_motif, choose_motif, motif_final_positions


class CompletionMotifTests(unittest.TestCase):
    finals = ['a', 'ai', 'an', 'ang', 'ao', 'e', 'ei', 'en', 'eng', 'er',
              'i', 'ia', 'ian', 'iang', 'iao', 'ie', 'in', 'ing', 'iong', 'iu',
              'o', 'ong', 'ou', 'u', 'ua', 'uai', 'uan', 'uang', 'ui', 'un',
              'uo', 'v', 'van', 've', 'vn']
    keys = "QWERTYUIOPASDFGHJKLZXCVBNM;/,.[]\\'"

    def state(self):
        # The helper only touches positions 27:62; make all 21 physical keys
        # present and leave duplicates available for coverage repair.
        physical = [self.keys.index(key) for key in 'QWERTYPSDFGHJKLZXCVBNM']
        return np.asarray([0] * 27 + physical + [physical[0]] * 14 + [0] * 5,
                          dtype=np.int32)

    def test_mixed_profile_is_deterministic_for_seed(self):
        self.assertEqual(choose_motif('mixed', random.Random(3)),
                         choose_motif('mixed', random.Random(3)))

    def test_joint_profile_is_selected_directly(self):
        self.assertEqual(choose_motif('joint', random.Random(3)), 'joint')

    def test_soft_motif_preserves_coverage_and_requested_pin_count(self):
        old_fast = MOTIFS['fast']
        MOTIFS['fast'] = {'i': 'P', 'ia': 'W', 'er': 'J'}
        try:
            state = self.state()
            allowed = {self.keys.index(key) for key in 'QWERTYPSDFGHJKLZXCVBNM'}
            ok, labels = apply_soft_motif(state, self.finals, self.keys, allowed,
                                          'fast', 2, 2, random.Random(7))
        finally:
            MOTIFS['fast'] = old_fast
        self.assertTrue(ok)
        self.assertEqual(len(labels), 2)
        self.assertEqual(set(map(int, state[27:62])), allowed)
        for label in labels:
            final, key = label.split('->')
            self.assertEqual(int(state[27 + self.finals.index(final)]), self.keys.index(key))

    def test_motif_positions_are_unique(self):
        positions = motif_final_positions(self.finals)
        self.assertEqual(len(positions), len(set(positions)))


if __name__ == '__main__':
    unittest.main()
