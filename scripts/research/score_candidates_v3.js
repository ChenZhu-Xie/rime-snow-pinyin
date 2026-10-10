#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (['--html', '--input', '--output', '--tau', '--first-aux', '--second-aux'].includes(argv[i])) {
      args[argv[i].slice(2)] = argv[i + 1];
    }
  }
  if (!args.html) {
    args.html = path.resolve('D:/C2D/Desktop/Code/Lua/inputMethod/shuangpin-layout-benchmark/a7_CKT_R11.html');
  }
  args.tau = args.tau ? Number(args.tau) : 600;
  args['first-aux'] = args['first-aux'] ? Number(args['first-aux']) : 300;
  args['second-aux'] = args['second-aux'] ? Number(args['second-aux']) : 300;
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

  const model = data.cktV2;
  const roles = ['L2i1', 'L3i1', 'L3i2', 'L4i1', 'L4i2', 'L4i3'];
  const tables = Object.fromEntries(roles.map(role => {
    const buf = Buffer.from(model.tables[role], 'base64');
    return [role, new Float64Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))];
  }));
  const index = Object.fromEntries([...model.keys].map((key, i) => [key, i]));
  const donors = data.ckt.calibration.extension_maps;
  const oldCost = CKTEngine.codeCost;

  function nativeCost(code) {
    const a = [...code].map(key => index[key]);
    if (a.some(value => value === undefined) || a.length < 2) return null;
    function role(name, part) {
      let cur = 0;
      for (const key of part) cur = cur * 30 + key;
      return tables[name][cur];
    }
    if (a.length === 2) return role('L2i1', a);
    if (a.length === 3) return role('L3i1', a) + role('L3i2', a);
    let total = role('L4i1', a.slice(0, 3)) + role('L4i3', a.slice(-3));
    for (let j = 0; j <= a.length - 4; j++) total += role('L4i2', a.slice(j, j + 4));
    return Math.max(total, 0) + (a.length - 4) * model.longGuardMs;
  }

  CKTEngine.codeCost = code => {
    const old = oldCost(code);
    if (!old) return null;
    const projected = [...code].map(key => donors[key]
      ? Object.entries(donors[key].donors).sort((a, b) => b[1] - a[1])[0][0] : key).join('');
    const native = nativeCost(projected);
    const oldProjected = oldCost(projected);
    if (native === null || !oldProjected) return null;
    const upperMs = Math.max(0, old.upperMs + native - oldProjected.upperMs);
    return {...old, centerMs: upperMs, upperMs};
  };

  return { html, data };
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

const SHAPE_FROM = 'IEUAO';
const STROKE_SLOT = {s:0, h:1, p:2, z:3, n:4};
function physicalShape(abstract, toneKeys) {
  return [...(abstract || '')].map(key => toneKeys[SHAPE_FROM.indexOf(key)] || '').join('');
}
function physicalStroke(strk, toneKeys) {
  return strk && toneKeys[STROKE_SLOT[strk]] || null;
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

function scoreCohort(entries, costCache) {
  const buckets = [0, 1, 2].map(stage => winners(entries, stage));
  let total = 0, coverage = 0, weightedCenter = 0, weightedUpper = 0, weightedKeys = 0;
  let p0 = 0, p1 = 0, p2 = 0;
  const selected = [0, 0, 0];
  for (const row of entries) {
    total += row.weight;
    if (row.codes.some(options => options.length === 0)) continue;
    const first0 = first(row, buckets[0], 0);
    const first1 = first(row, buckets[1], 1);
    const first2 = first(row, buckets[2], 2);
    const stage = first0 ? 0 : first1 ? 1 : 2;
    const choices = row.codes[stage].filter(code => stage !== 2 || !first2 || buckets[2].get(code) === row);
    let best = null, chosen = null;
    for (const code of choices) {
      if (!costCache.has(code)) costCache.set(code, CKTEngine.codeCost(code));
      const cost = costCache.get(code);
      if (cost && (!best || cost.upperMs < best.upperMs || cost.upperMs === best.upperMs && code < chosen)) {
        best = cost; chosen = code;
      }
    }
    if (!best) continue;
    coverage += row.weight;
    if (!first0) p0 += row.weight;
    if (!first1) p1 += row.weight;
    if (!first2) p2 += row.weight;
    selected[stage] += row.weight;
    weightedCenter += row.weight * best.centerMs;
    weightedUpper += row.weight * best.upperMs;
    weightedKeys += row.weight * chosen.length;
  }
  if (!coverage) return null;
  return {
    count: entries.length,
    totalWeight: total,
    coveredWeight: coverage,
    completionUpperMs: weightedUpper / coverage,
    meanKeys: weightedKeys / coverage,
    p0: p0 / coverage,
    p1: p1 / coverage,
    p2: p2 / coverage,
    stageWeight: selected.map(w => w / coverage)
  };
}

const FIXED_ONE_KEY = new Set([..."的一是在了不有和人中大为上个国我以要他时来用生到作"]);

function extractMultiwords(dictFile, pinyinMap, shape) {
  function parseReading(syllableWithTone) {
    const match = syllableWithTone.match(/^([a-z]+)([1-5])?$/);
    if (!match) return null;
    const p = match[1];
    const t = match[2] ? Number(match[2]) : 5;
    const idx = pinyinMap.get(p);
    if (idx === undefined) return null;
    return { idx, tone: t };
  }

  const w3 = [], w4 = [];
  for (const line of fs.readFileSync(dictFile, 'utf8').split(/\r?\n/)) {
    if (!line.includes('\t') || line.startsWith('#')) continue;
    const [word, reading, weightText] = line.split('\t');
    if (!word || !reading || reading.startsWith('~')) continue;
    const chars = [...word];
    const syls = reading.split(' ');
    if (chars.length !== syls.length) continue;
    const parsed = syls.map(parseReading);
    if (parsed.some(x => !x)) continue;
    if (chars.some(c => !shape[c])) continue;
    const weight = Number(weightText) || 0;
    if (weight <= 0) continue;

    const item = { text: word, py: parsed.map(p => p.idx), tones: parsed.map(p => p.tone), weight };
    if (chars.length === 3) w3.push(item);
    else if (chars.length === 4) w4.push(item);
  }

  w3.sort((a, b) => b.weight - a.weight);
  w4.sort((a, b) => b.weight - a.weight);

  return {
    w3: w3.slice(0, 15000),
    w4: w4.slice(0, 15000)
  };
}

function makeRowsForScheme(entry, data, stroke, multiwords) {
  const codes = entry.codeList;
  const toneKeys = entry.tone;
  const shape = data.shapes.snowshape;
  const is21x21 = Array.isArray(entry.capacity) && entry.capacity[0] === 21 && entry.capacity[1] === 21;

  const chars_kt = [];
  const chars_sp = [];
  for (const [text, py, tone, weight, common] of data.characters) {
    if (!common || weight <= 0 || FIXED_ONE_KEY.has(text)) continue;
    const base = codes[py];
    if (!base) continue;
    const aux = physicalShape(shape[text], toneKeys);
    const toneKey = toneKeys[tone - 1];
    const possible = [...(stroke.alternatives.get(text) || [])].map(s => physicalStroke(s, toneKeys));

    chars_kt.push({
      text, weight,
      codes: [
        [base],
        aux ? [base + aux[0]] : [base],
        aux ? [base + aux.slice(0, 2)] : [base]
      ]
    });

    chars_sp.push({
      text, weight,
      codes: [
        [base],
        toneKey ? [base + toneKey] : [base],
        toneKey && possible.length ? possible.map(k => base + toneKey + k) : (toneKey ? [base + toneKey] : [base])
      ]
    });
  }

  const w2_kt = [];
  const w2_sp = [];
  for (const [text, py1, py2, tone1, tone2, weight, lexicon, common] of data.words) {
    if (!(lexicon & 1) || weight <= 0 || [...text].length !== 2) continue;
    const base = codes[py1] && codes[py2] ? codes[py1] + codes[py2] : null;
    if (!base) continue;
    const [ch1, ch2] = [...text];
    const x1 = physicalShape(shape[ch1], toneKeys), x2 = physicalShape(shape[ch2], toneKeys);
    const t1 = toneKeys[tone1 - 1], t2 = toneKeys[tone2 - 1];
    const b1 = is21x21 ? x1 : x2;
    const b2 = is21x21 ? x2 : x1;

    w2_kt.push({
      text, weight,
      codes: [
        [base],
        b1 ? [base + b1[0]] : [base],
        b1 && b2 ? [base + b1[0] + b2[0]] : (b1 ? [base + b1[0]] : [base])
      ]
    });

    w2_sp.push({
      text, weight,
      codes: [
        [base],
        t2 ? [base + t2] : [base],
        t1 && t2 ? [base + t2 + t1] : (t2 ? [base + t2] : [base])
      ]
    });
  }

  const w3_kt = [];
  const w3_sp = [];
  for (const item of multiwords.w3) {
    const { text, py, tones, weight } = item;
    const s0 = codes[py[0]], s1 = codes[py[1]], s2 = codes[py[2]];
    if (!s0 || !s1 || !s2) continue;
    const base = s0[0] + s1[0] + s2[0];
    const chars = [...text];
    const x0 = physicalShape(shape[chars[0]], toneKeys);
    const x1 = physicalShape(shape[chars[1]], toneKeys);
    const t_aux1 = is21x21 ? toneKeys[tones[2] - 1] : toneKeys[tones[0] - 1];
    const t_aux2 = is21x21 ? toneKeys[tones[0] - 1] : toneKeys[tones[1] - 1];

    w3_kt.push({
      text, weight,
      codes: [
        [base],
        x0 ? [base + x0[0]] : [base],
        x0 && x1 ? [base + x0[0] + x1[0]] : (x0 ? [base + x0[0]] : [base])
      ]
    });

    w3_sp.push({
      text, weight,
      codes: [
        [base],
        t_aux1 ? [base + t_aux1] : [base],
        t_aux1 && t_aux2 ? [base + t_aux1 + t_aux2] : (t_aux1 ? [base + t_aux1] : [base])
      ]
    });
  }

  const w4_kt = [];
  const w4_sp = [];
  for (const item of multiwords.w4) {
    const { text, py, tones, weight } = item;
    const s0 = codes[py[0]], s1 = codes[py[1]], s2 = codes[py[2]], s3 = codes[py[3]];
    if (!s0 || !s1 || !s2 || !s3) continue;
    const base = s0[0] + s1[0] + s2[0] + s3[0];
    const chars = [...text];
    const x0 = physicalShape(shape[chars[0]], toneKeys);
    const x1 = physicalShape(shape[chars[1]], toneKeys);
    const t_aux1 = is21x21 ? toneKeys[tones[3] - 1] : toneKeys[tones[0] - 1];
    const t_aux2 = is21x21 ? toneKeys[tones[0] - 1] : toneKeys[tones[1] - 1];

    w4_kt.push({
      text, weight,
      codes: [
        [base],
        x0 ? [base + x0[0]] : [base],
        x0 && x1 ? [base + x0[0] + x1[0]] : (x0 ? [base + x0[0]] : [base])
      ]
    });

    w4_sp.push({
      text, weight,
      codes: [
        [base],
        t_aux1 ? [base + t_aux1] : [base],
        t_aux1 && t_aux2 ? [base + t_aux1 + t_aux2] : (t_aux1 ? [base + t_aux1] : [base])
      ]
    });
  }

  return {
    keytao: { character: chars_kt, word2: w2_kt, word3: w3_kt, word4: w4_kt },
    sanpin: { character: chars_sp, word2: w2_sp, word3: w3_sp, word4: w4_sp }
  };
}

const B_COMPLETION_TRACKS_V3=[
  ['kc1','键道·单字(去一简)','keytao','character',1,2],
  ['kw2','键道·二字词','keytao','word2',3,4],
  ['kw3','键道·三字词','keytao','word3',1,3],
  ['kw4','键道·四字词','keytao','word4',1,4],
  ['sc1','三拼·单字(去一简)','sanpin','character',1,2],
  ['sw2','三拼·二字词','sanpin','word2',3,4],
  ['sw3','三拼·三字词','sanpin','word3',1,3],
  ['sw4','三拼·四字词','sanpin','word4',1,4]
];

function bCompletionScoreV3(m, tau, firstAux, secondAux, reference){
  if(!m || !reference) return null;
  let sum = 0, total = 0;
  for(const [, , mode, kind, weight, base] of B_COMPLETION_TRACKS_V3){
    const r = m[mode]?.[kind], b = reference[mode]?.[kind];
    if(!r || !b) return null;
    const f = 1 - (r.stageWeight?.[0] ?? 1), bf = 1 - (b.stageWeight?.[0] ?? 1);
    const f2 = Math.max(0, r.meanKeys - base - f), bf2 = Math.max(0, b.meanKeys - base - bf);
    const a = r.completionUpperMs + tau * r.p2 + firstAux * f + secondAux * f2;
    const c = b.completionUpperMs + tau * b.p2 + firstAux * bf + secondAux * bf2;
    if(!(a > 0 && c > 0)) return null;
    sum += weight * (a / c) ** 4;
    total += weight;
  }
  return 10 * (sum / total) ** 0.25;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) throw Error('--input <candidates.json> required');
  const page = loadPage(args.html);
  const data = page.data;

  const strokeFile = 'D:/C2D/Documents/rime-snow-pinyin/rime-stroke/stroke.dict.yaml';
  const stroke = strokeOptions(strokeFile);

  const dictFile = 'D:/C2D/Documents/rime-snow-pinyin/snow_pinyin.base.dict.yaml';
  const pinyinMap = new Map(data.pinyin.map((p, i) => [p, i]));
  const multiwords = extractMultiwords(dictFile, pinyinMap, data.shapes.snowshape);

  // Score S005 reference if needed
  const s005_entry = data.entries.find(e => e.id === 'S005');
  const cache = new Map();
  const s005_rows = makeRowsForScheme(s005_entry, data, stroke, multiwords);
  const s005_modes = { keytao: {}, sanpin: {} };
  for (const mode of ['keytao', 'sanpin']) {
    for (const kind of ['character', 'word2', 'word3', 'word4']) {
      s005_modes[mode][kind] = scoreCohort(s005_rows[mode][kind], cache);
    }
  }

  const rawCandidates = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  const candidateList = Array.isArray(rawCandidates) ? rawCandidates : rawCandidates.candidates;
  console.log(`Scoring ${candidateList.length} candidates with CKT v3...`);

  const results = [];
  for (let i = 0; i < candidateList.length; i++) {
    const entry = candidateList[i];
    const rows = makeRowsForScheme(entry, data, stroke, multiwords);
    const modes = { keytao: {}, sanpin: {} };
    for (const mode of ['keytao', 'sanpin']) {
      for (const kind of ['character', 'word2', 'word3', 'word4']) {
        modes[mode][kind] = scoreCohort(rows[mode][kind], cache);
      }
    }
    const v3Score = bCompletionScoreV3(modes, args.tau, args['first-aux'], args['second-aux'], s005_modes);
    results.push({
      id: entry.id,
      ckt_v3: v3Score,
      modes
    });
  }

  if (args.output) {
    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, JSON.stringify(results, null, 2), 'utf8');
    console.log(`Saved ${results.length} results to ${args.output}`);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
