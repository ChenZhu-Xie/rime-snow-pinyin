"""Regression checks for fixed IVUAO CKT v2 and its staged extra delays."""
from __future__ import annotations
import base64
import gzip
import hashlib
import json
import re
import subprocess
import unittest
from pathlib import Path

HTML = Path(r'D:\C2D\Desktop\Code\Lua\inputMethod\shuangpin-layout-benchmark\a7_CKT_R11.html')


def adjusted(row, kind, selection=500, first=100, second=150):
    base = 2 if kind == 'character' else 4
    first_share = 1 - row['stageWeight'][0]
    second_share = row['meanKeys'] - base - first_share
    assert -1e-10 <= second_share <= 1 + 1e-10
    return row['completionUpperMs'] + selection * row['p2'] + first * first_share + second * second_share


def composite(modes, baseline):
    weighted = []
    for mode in ('keytao', 'sanpin'):
        for kind in ('character', 'word'):
            weight = 2 if kind == 'word' else 1
            weighted.append(weight * (adjusted(modes[mode][kind],kind)/adjusted(baseline[mode][kind],kind))**4)
    return 10*(sum(weighted)/6)**.25


class CompletionCKTv2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = HTML.read_text(encoding='utf-8')
        m = re.search(r'<script id="payload"[^>]*>([^<]+)</script>', cls.html)
        cls.data = json.loads(gzip.decompress(base64.b64decode(m[1])))

    def test_model_version_and_coverage(self):
        d=self.data
        self.assertEqual(d['cktV2']['upstreamCommit'],'a551021c1cd6df0c3e25e2111b81d062dbe9f574')
        self.assertEqual(set(d['completionBV2']['schemes']),{x['id'] for x in d['entries']})
        self.assertEqual(d['completionBV2']['penaltyDefinition']['defaultSelectionMs'],500)
        self.assertEqual(d['completionBV2']['penaltyDefinition']['defaultFirstAuxiliaryMs'],100)
        self.assertEqual(d['completionBV2']['penaltyDefinition']['defaultSecondAuxiliaryMs'],150)
        self.assertEqual(d['cktV2']['sourceSha256'], d['completionBV2']['modelSource']['sourceSha256'])
        self.assertEqual(d['cktV2']['keys'],'ABCDEFGHIJKLMNOPQRSTUVWXYZ;,./')
        self.assertEqual(len(d['cktV2']['tables']),6)
        self.assertEqual(composite(d['completionBV2']['schemes']['S005']['modes'],d['completionBV2']['schemes']['S005']['modes']),10)

    def test_browser_formula_matches_exact_archive(self):
        # Execute the actual inline browser function against two independently
        # computed archive rows; catches stage-2 omission or double counting.
        source=re.search(r'^function bCompletionScoreV2\(.*$',self.html,re.MULTILINE).group()
        block=self.data['completionBV2']['schemes']
        tracks=[['j1','', 'keytao','character'],['s1','', 'sanpin','character'],
                ['wj1','', 'keytao','word'],['ws1','', 'sanpin','word']]
        for ident in ('S005','BCW-553dbe07fc7c'):
            payload=json.dumps({'m':block[ident]['modes'],'base':block['S005']['modes'],'tracks':tracks})
            js='const B_COMPLETION_TRACKS='+json.dumps(tracks)+';'+source+';const x='+payload+';console.log(bCompletionScoreV2(x.m,500,100,150,x.base))'
            actual=float(subprocess.check_output(['node','-e',js],text=True).strip())
            self.assertAlmostEqual(actual,composite(block[ident]['modes'],block['S005']['modes']),places=10)

    def test_stage_delays_are_on_top_of_included_ckt(self):
        score=self.data['completionBV2']['schemes']
        for id in ('S005','BCW-728ebe1b8ae6'):
            for mode in ('keytao','sanpin'):
                for kind in ('character','word'):
                    row=score[id]['modes'][mode][kind]
                    self.assertGreaterEqual(adjusted(row,kind),row['completionUpperMs'])
                    self.assertAlmostEqual(adjusted(row,kind,0,0,0),row['completionUpperMs'])
        row={'completionUpperMs':300,'p2':.05,'meanKeys':3,'stageWeight':[.2,.6,.2]}
        self.assertAlmostEqual(adjusted(row,'character'),300+25+80+30)
        self.assertEqual(len(re.findall(r'id="ux(?:Tau|FirstAuxPenalty|SecondAuxPenalty)" type="range"',self.html)),3)
        self.assertNotIn('id="uxAuxPenalty"',self.html)
        self.assertIn("function bCompletionScoreV2(m,tau,firstAux,secondAux,reference)",self.html)

if __name__=='__main__':unittest.main()
