from __future__ import annotations

import unittest

import numpy as np

from completion_coordinate_faces import coordinate_face


class CoordinateFaceTests(unittest.TestCase):
    def test_enumerates_unique_coordinate_values(self):
        states = [np.array([0, 1, 2]), np.array([0, 3, 4]), np.array([0, 1, 4])]
        positions, rows = coordinate_face(states, 10)
        self.assertEqual(positions, [(1, (1, 3)), (2, (2, 4))])
        self.assertEqual([row.tolist() for row in rows],
                         [[0, 1, 2], [0, 1, 4], [0, 3, 2], [0, 3, 4]])

    def test_rejects_oversized_face(self):
        with self.assertRaisesRegex(ValueError, '4 combinations'):
            coordinate_face([np.array([0, 0]), np.array([1, 1])], 3)

    def test_requires_two_equal_width_states(self):
        with self.assertRaisesRegex(ValueError, 'At least two'):
            coordinate_face([np.array([0])], 10)
        with self.assertRaisesRegex(ValueError, 'equal length'):
            coordinate_face([np.array([0]), np.array([0, 1])], 10)


if __name__ == '__main__':
    unittest.main()
