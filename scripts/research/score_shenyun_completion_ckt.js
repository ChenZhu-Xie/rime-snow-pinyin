#!/usr/bin/env node
/* Static frequency-weighted B completion CKT + fixed nonfirst selection time. */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const vm = require('vm');

function argumentsFrom(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--html', '--output', '--ids', '--mapping'].includes(argv[i]) || !argv[i + 1])
      throw Error('usage: node score_shenyun_completion_ckt.js --html R11.html --output result.json [--ids ID,ID] [--mapping native|fixed]');
    args[argv[i].slice(2)] = argv[i + 1];
  }
  if (!args.html || !args.output) throw Error('--html and --output are required');
  if (args.mapping && !['native', 'fixed'].includes(args.mapping)) throw Error('unknown B mapping: ' + args.mapping);
  return args;
}

function loadPage(file) {
  const html = fs.readFileSync(file, 'utf8');
  const tag = '<script id="payload"';
  const at = html.indexOf(tag);
  if (at < 0) throw Error('R11 payload not found');
  const start = html.indexOf('>', at) + 1;
  const end = html.indexOf('</script>', start);
  const data = JSON.parse(zlib.gunzipSync(Buffer.from(html.slice(start, end), 'base64')));
  for (const marker of ['Shared-data evaluator.', 'CKT role-aware within-code evaluator.']) {
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    const source = scripts.find(match => match[1].includes(marker));
    if (!source) throw Error('R11 engine not found: ' + marker);
    vm.runInThisContext(source[1], {filename: marker});
  }
  if (!data.ckt?.tables || data.lite) throw Error('full R11 CKT tensor required');
  Engine7.init(data);
  CKTEngine.init(data);
  return {data, htmlSha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
}

function strokeOptions(file) {
  const alternatives = new Map();
  const primary = new Map();
  let started = false;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!started) { started = line.trim() === '...'; continue; }
    const fields = line.split('\t');
    if (fields.length < 2 || !fields[1] || !/[hspnz]/.test(fields[1][0]) || /[^hspnz]/.test(fields[1])) continue;
    const [character, spelling] = fields;
    const key = spelling[0];
    if (!primary.has(character)) primary.set(character, key);
    if (!alternatives.has(character)) alternatives.set(character, new Set());
    alternatives.get(character).add(key);
  }
  return {primary, alternatives};
}

const TONE = 'IVUAO';
const SHAPE_FROM = 'IEUAO';
const STROKE_SLOT = {s:0, h:1, p:2, z:3, n:4};
function physicalShape(abstract, toneKeys) {
  return [...(abstract || '')].map(key => toneKeys[SHAPE_FROM.indexOf(key)] || '').join('');
}
function physicalStroke(stroke, toneKeys) {
  return stroke && toneKeys[STROKE_SLOT[stroke]] || null;
}
function winnerBeats(a, b) {
  return !b || a.weight > b.weight || (a.weight === b.weight && Engine7.lex(a.text, b.text) < 0);
}
function winners(rows, stage) {
  const buckets = new Map();
  for (const row of rows) for (const code of row.codes[stage]) {
    if (winnerBeats(row, buckets.get(code))) buckets.set(code, row);
  }
  return buckets;
}
function first(row, bucket, stage) {
  return row.codes[stage].some(code => bucket.get(code) === row);
}

function makeRows(data, entry, stroke, mappingMode) {
  const chars = [];
  const words = [];
  const codes = entry.codeList;
  const shape = data.shapes.snowshape;
  const keytaoWordFirstCharacterFirst = Array.isArray(entry.capacity) && entry.capacity[0] === 21 && entry.capacity[1] === 21;
  const toneKeys = mappingMode === 'native' ? entry.tone : TONE;
  if (!toneKeys || [...toneKeys].length !== 5 || new Set([...toneKeys]).size !== 5)
    throw Error('invalid five-key order: ' + entry.id + ' ' + toneKeys);
  for (const [text, py, tone, weight, common] of data.characters) {
    if (!common || weight <= 0) continue;
    const base = codes[py], aux = physicalShape(shape[text], toneKeys);
    const toneKey = toneKeys[tone - 1], possible = [...(stroke.alternatives.get(text) || [])].map(s => physicalStroke(s, toneKeys));
    chars.push({text, weight, common:true, keytao:[
      base ? [base] : [], base && aux ? [base + aux[0]] : [],
      base && aux ? [base + aux.slice(0, 2)] : []
    ], sanpin:[
      base ? [base] : [], base && toneKey ? [base + toneKey] : [],
      base && toneKey ? possible.map(key => base + toneKey + key) : []
    ], primaryStroke:physicalStroke(stroke.primary.get(text), toneKeys)});
  }
  for (const [text, py1, py2, tone1, tone2, weight, lexicon, common] of data.words) {
    if (!(lexicon & 1) || weight <= 0 || [...text].length !== 2) continue;
    const [ch1, ch2] = [...text];
    const base = codes[py1] && codes[py2] ? codes[py1] + codes[py2] : null;
    const x1 = physicalShape(shape[ch1], toneKeys), x2 = physicalShape(shape[ch2], toneKeys);
    const t1 = toneKeys[tone1 - 1], t2 = toneKeys[tone2 - 1];
    const keytaoB1 = keytaoWordFirstCharacterFirst ? x1 : x2;
    const keytaoB2 = keytaoWordFirstCharacterFirst ? x2 : x1;
    words.push({text, weight, common:!!common, keytao:[
      base ? [base] : [], base && keytaoB1 ? [base + keytaoB1[0]] : [],
      base && keytaoB1 && keytaoB2 ? [base + keytaoB1[0] + keytaoB2[0]] : []
    ], sanpin:[base ? [base] : [], base && t2 ? [base + t2] : [],
      base && t1 && t2 ? [base + t2 + t1] : []]});
  }
  return {chars, words};
}

function scoreCohort(rows, mode, type, costCache, strokePrimary = false) {
  const entries = rows.filter(row => row.common).map(row => ({...row, codes:row[mode].map((codes, stage) => {
    if (mode !== 'sanpin' || type !== 'character' || stage !== 2 || !strokePrimary) return codes;
    const key = row.primaryStroke;
    return key ? codes.filter(code => code.endsWith(key)) : [];
  })}));
  const buckets = [0, 1, 2].map(stage => winners(entries, stage));
  let total = 0, coverage = 0, weightedCenter = 0, weightedUpper = 0, weightedKeys = 0;
  let p0 = 0, p1 = 0, p2 = 0, extrapolated = 0, long = 0;
  const selected = [0, 0, 0], invalid = [];
  for (const row of entries) {
    if (!row.common) continue;
    total += row.weight;
    if (row.codes.some(options => options.length === 0)) {
      invalid.push(row.text);
      continue;
    }
    coverage += row.weight;
    const first0 = first(row, buckets[0], 0);
    const first1 = first(row, buckets[1], 1);
    const first2 = first(row, buckets[2], 2);
    if (!first0) p0 += row.weight;
    if (!first1) p1 += row.weight;
    if (!first2) p2 += row.weight;
    const stage = first0 ? 0 : first1 ? 1 : 2;
    selected[stage] += row.weight;
    const choices = row.codes[stage].filter(code => stage !== 2 || !first2 || buckets[2].get(code) === row);
    let best = null, chosen = null;
    for (const code of choices) {
      if (!costCache.has(code)) costCache.set(code, CKTEngine.codeCost(code));
      const cost = costCache.get(code);
      if (cost && (!best || cost.upperMs < best.upperMs || cost.upperMs === best.upperMs && code < chosen)) {
        best = cost; chosen = code;
      }
    }
    if (!best) throw Error('unscored code: ' + row.text + ' ' + stage);
    weightedCenter += row.weight * best.centerMs;
    weightedUpper += row.weight * best.upperMs;
    weightedKeys += row.weight * chosen.length;
    if (best.extra) extrapolated += row.weight;
    if (best.long) long += row.weight;
  }
  if (!total) throw Error('empty ' + mode + ' ' + type);
  const metric = {
    count:entries.filter(row => row.common).length, totalWeight:total, coveredWeight:coverage,
    coverage:coverage / total, missingCount:invalid.length, missingExamples:invalid.slice(0, 8),
    completionCenterMs:weightedCenter / coverage, completionUpperMs:weightedUpper / coverage,
    meanKeys:weightedKeys / coverage, p0:p0 / coverage, p1:p1 / coverage, p2:p2 / coverage,
    stageWeight:selected.map(w => w / coverage), extrapolatedCodeShare:extrapolated / coverage,
    longCodeShare:long / coverage, timeMs:{}
  };
  for (const tau of [0, 150, 300, 600]) metric.timeMs[tau] = metric.completionUpperMs + tau * metric.p2;
  return metric;
}

function main() {
  const args = argumentsFrom(process.argv.slice(2));
  const {data, htmlSha256} = loadPage(args.html);
  const repo = path.resolve(__dirname, '../..');
  const strokeFile = path.join(repo, 'rime-stroke/stroke.dict.yaml');
  const stroke = strokeOptions(strokeFile);
  const requested = args.ids ? new Set(args.ids.split(',')) : null;
  const entries = requested ? data.entries.filter(entry => requested.has(entry.id)) : data.entries;
  if (requested && entries.length !== requested.size) throw Error('unknown scheme ID in --ids');
  const mappingMode = args.mapping || 'fixed';
  const output = {version:mappingMode === 'native' ? 'B-completion-CKT-native-v2' : 'B-completion-CKT-fixed-v1', source:{html:path.resolve(args.html), htmlSha256,
    strokeSha256:crypto.createHash('sha256').update(fs.readFileSync(strokeFile)).digest('hex'),
    entries:data.entries.length, characterRows:data.characters.length, wordRows:data.words.length},
    policy:{cohort:'R11 Common8095 and Snow common two-character words', mappingMode,
      toneKeys:mappingMode === 'native' ? 'entry.tone' : TONE,
      shapeKeys:mappingMode === 'native' ? 'entry.tone by IEUAO class' : TONE,
      wordBOrder:'keytao: 21x21 first character then second; other domains second then first; sanpin: second then first',
    ranking:'frequency descending, text lexicographic; common cohort filtered before ranking as in frozen CKT',
      sanpinStroke:'all accepted first strokes; at B2 choose a first-choice code if available, then least upper CKT; optimistic bound',
      selection:'completion upper CKT + tauMs * p2; tauMs = 0,150,300,600; no commit or boundary cost',
      modes:['keytao','sanpin'], classes:['character','word']}, schemes:{}};
  for (const entry of entries) {
    const rows = makeRows(data, entry, stroke, mappingMode), cache = new Map();
    const modes = {};
    for (const mode of ['keytao', 'sanpin']) {
      modes[mode] = {
        character:scoreCohort(rows.chars, mode, 'character', cache),
        word:scoreCohort(rows.words, mode, 'word', cache)
      };
    }
    modes.sanpin.character.firstDictionaryStroke = scoreCohort(rows.chars, 'sanpin', 'character', cache, true);
    const scenario = {};
    for (const mode of ['keytao', 'sanpin']) {
      scenario[mode] = {};
      for (const tau of [0, 150, 300, 600]) {
        const character = modes[mode].character.timeMs[tau];
        const word = modes[mode].word.timeMs[tau];
        scenario[mode][tau] = Object.fromEntries([0, .25, .5, 2/3, .75, 1].map(q => {
          const msPerHanzi = ((1 - q) * character + q * word) / (1 + q);
          return [q, {msPerHanzi, hanziPerMinute:60000 / msPerHanzi}];
        }));
      }
    }
    const frozen = data.ckt.tracks[entry.id];
    const anchorDeltas = frozen ? {
      C2:modes.keytao.character.p0 - frozen.C2.miss,
      C3:modes.sanpin.character.p1 - frozen.C3.miss,
      C4Snow:modes.keytao.character.p2 - frozen['C4-Snow'].miss,
      W4Snow:modes.keytao.word.p0 - frozen['W4-Snow'].miss,
      WX21:modes.keytao.word.p2 - frozen['WX-Snow-21'].miss,
      W621:modes.sanpin.word.p2 - frozen['W6-21'].miss
    } : null;
    const b = entry.bPathMetrics;
    const bPathDeltas = b ? {
      j1:modes.keytao.character.p1 - b.j1, j2:modes.keytao.character.p2 - b.j2,
      s1:modes.sanpin.character.p1 - b.s1, s2:modes.sanpin.character.p2 - b.s2,
      wj1:modes.keytao.word.p1 - b.wj1, wj2:modes.keytao.word.p2 - b.wj2,
      ws1:modes.sanpin.word.p1 - b.ws1, ws2:modes.sanpin.word.p2 - b.ws2
    } : null;
    const compatibleDeltas = bPathDeltas && (mappingMode === 'fixed' || entry.tone === TONE)
      ? (entry.capacity?.[0] === 21 && entry.capacity?.[1] === 21
          ? Object.entries(bPathDeltas).filter(([key]) => key !== 'wj1' && key !== 'wj2').map(([, value]) => value)
          : Object.values(bPathDeltas)) : null;
    if (compatibleDeltas && Math.max(...compatibleDeltas.map(Math.abs)) > 1e-10)
      throw Error('B path audit failed: ' + entry.id + ' ' + JSON.stringify(bPathDeltas));
    output.schemes[entry.id] = {capacity:entry.capacity, actual:entry.actual, tone:entry.tone,
      memory:entry.searchMemoryNoTone ?? null,
      displaced:entry.memoryAuditR2?.ordinaryDisplacedCount ?? null,
      rightPinkyMax:frozen ? Math.max(...Object.values(frozen).map(track => track.rightPinky || 0)) : null,
      homeS2:frozen?.S2?.home ?? null,
      ae6:data.ensembleV6?.values?.[entry.id]?.score ?? null,
      modes, scenario, anchorDeltas, bPathDeltas};
  }
  fs.mkdirSync(path.dirname(args.output), {recursive:true});
  fs.writeFileSync(args.output, JSON.stringify(output, null, 2));
  console.log(JSON.stringify({version:output.version, scored:Object.keys(output.schemes).length,
    out:path.resolve(args.output), sourceEntries:output.source.entries}));
}

if (require.main === module) main();
module.exports = {makeRows};
