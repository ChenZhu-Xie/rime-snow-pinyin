from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import search_completion_boundary_beam as boundary_beam


class CompletionBoundaryBeamTests(unittest.TestCase):
    def test_resolve_output_path_is_stable_across_chdir(self):
        resolve = getattr(boundary_beam, 'resolve_output_path', None)
        self.assertTrue(callable(resolve))
        original = Path.cwd()
        expected = (original / 'result.json').resolve()
        output = resolve(Path('result.json'))
        with tempfile.TemporaryDirectory() as directory:
            import os
            os.chdir(directory)
            try:
                self.assertEqual(output, expected)
            finally:
                os.chdir(original)


if __name__ == '__main__':
    unittest.main()
