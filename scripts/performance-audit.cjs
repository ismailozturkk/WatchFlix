/* Read-only synthetic audit. Run: node scripts/performance-audit.cjs
 * Node/V8 timings are NOT mobile/Hermes frame or CPU/GPU measurements.
 * Babel compilation and fixture generation are outside the timed regions.
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { performance } = require('node:perf_hooks');
const { transformSync } = require('@babel/core');

const root = path.resolve(__dirname, '..');
const loaded = new Map();
function load(relative) {
  const file = path.resolve(root, relative);
  if (!file.startsWith(path.join(root, 'utils') + path.sep)) throw new Error('Only utils may be loaded');
  if (loaded.has(file)) return loaded.get(file).exports;
  const module = new Module(file);
  loaded.set(file, module);
  module.require = (name) => {
    if (name === 'react-native') return { PixelRatio: { get: () => 3 } };
    if (!name.startsWith('.')) throw new Error(`Unexpected dependency: ${name}`);
    const next = path.resolve(path.dirname(file), name);
    return load(path.relative(root, path.extname(next) ? next : next + '.js'));
  };
  const { code } = transformSync(fs.readFileSync(file, 'utf8'), {
    filename: file, babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  module._compile(code, file);
  return module.exports;
}

const history = load('utils/watchHistory.js');
const { computeWatchScore } = load('utils/watchScoring.js');
const { kanonikTur } = load('utils/genreCanon.js');
const { sameJson } = load('utils/sameData.js');
const { getOptimalTmdbSize } = load('utils/tmdbImageUtils.js');

function show(id, seasons, episodes) {
  return {
    id, name: `Synthetic show ${id}`, genres: ['Drama'],
    showEpisodeCount: seasons * episodes, watchedEpisodeCount: seasons * episodes,
    addedShowDate: '2026-01-01',
    seasons: Array.from({ length: seasons }, (_, s) => ({
      seasonNumber: s + 1, seasonEpisodes: episodes,
      episodes: Array.from({ length: episodes }, (_, e) => ({
        episodeNumber: e + 1, episodeMinutes: 45,
        episodeWatchTime: '2026-01-01',
        watchEvents: [{ id: `${id}_${s}_${e}`, watchedAt: '2026-01-01', scope: 'episode' }],
      })),
    })),
  };
}

function measure(fn) {
  for (let i = 0; i < 3; i++) fn();
  const values = [];
  for (let i = 0; i < 7; i++) {
    const start = performance.now();
    fn();
    values.push(performance.now() - start);
  }
  values.sort((a, b) => a - b);
  return { medianMs: +values[3].toFixed(3), maxMs: +values[6].toFixed(3) };
}

const seasonRows = [];
for (const [seasons, episodes] of [[1, 24], [10, 24], [20, 50]]) {
  const raw = show(1, seasons, episodes);
  const state = history.materializeTvWatchState(raw);
  const materialized = { ...raw, ...state };
  const current = () => Array.from({ length: episodes }, (_, e) =>
    history.tvWatchEvents(materialized, { seasonNumber: 1, episodeNumber: e + 1 }));
  // Proposed index: build once from already materialized state, then look up rows.
  // Including index construction makes this a conservative algorithm comparison.
  const indexed = () => {
    const index = new Map();
    for (const event of state.watchEvents) {
      for (const key of event.episodeKeys || []) {
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(event);
      }
    }
    return Array.from({ length: episodes }, (_, e) => index.get(`1:${e + 1}`) || []);
  };
  const expected = current();
  const actual = indexed();
  assert(expected.every((events) => events.length > 0), 'Fixture must contain watched events');
  assert.deepEqual(actual, expected, 'Proposed lookup must preserve event data and ordering');
  seasonRows.push({ totalEpisodes: seasons * episodes, renderedRows: episodes,
    repeatedMaterialization: measure(current), buildIndexAndLookup: measure(indexed) });
}

const libraryRows = [];
for (const [movieCount, showCount] of [[100, 10], [1000, 50], [5000, 200]]) {
  const movies = Array.from({ length: movieCount }, (_, i) => ({
    id: i, type: 'movie', name: `Synthetic movie ${i}`, minutes: 120,
    genres: ['Drama'], dateAdded: '2026-01-01',
  }));
  const shows = Array.from({ length: showCount }, (_, i) => show(i, 5, 20));
  const data = { movies, shows };
  const serialized = JSON.stringify(data);
  const copied = JSON.parse(serialized);
  libraryRows.push({ movieCount, totalEpisodes: showCount * 100,
    jsonBytes: Buffer.byteLength(serialized),
    doubleParse: measure(() => { JSON.parse(serialized); JSON.parse(serialized); }),
    sameJson: measure(() => sameJson(data, copied)),
    profileDerivations: measure(() => {
      history.flattenMovieWatchEntries(movies);
      const states = shows.map((s) => history.materializeTvWatchState(s));
      history.flattenTvEpisodeWatchEntries(shows);
      history.countTvWatchStats(states);
    }),
    watchScore: measure(() => computeWatchScore({ movies, shows, kanonikTur,
      simdi: new Date('2026-11-10T12:00:00Z').getTime() })),
  });
}

console.log(JSON.stringify({
  method: 'Synthetic Node/V8 microbenchmark; 3 warmups, 7 samples; no disk/network/UI/GPU measurement',
  node: process.version, cpu: os.cpus()[0]?.model, platform: process.platform,
  seasonRows, libraryRows,
  imageExamplesAtDpr3: [
    { type: 'still', width: 300 }, { type: 'backdrop', width: 1000 },
    { type: 'poster', width: 200 },
  ].map((x) => ({ ...x, quality: 'good', result: getOptimalTmdbSize(x.type, x.width, 'good') })),
}, null, 2));
