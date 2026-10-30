// scripts/build-film-chain-puzzles.mjs
//
// Film Zinciri (docs/ozellikler/FILM_ZINCIRI.md) bulmacalarını ÖNCEDEN hesaplar ve data/filmChainPuzzles.js'i yazar.
// Kenar kuralı uygulamayla ORTAK: utils/filmChainRules.js (içe aktarmasız saf modül; Node 22 ESM algılamasıyla okunur).
//
// Çalıştırma (PowerShell):
//   $env:TMDB_READ_TOKEN = "..."   # yoksa .env'deki EXPO_PUBLIC_API_KEY okunur
//   node scripts/build-film-chain-puzzles.mjs
//
// TMDB yanıtları işletim sisteminin geçici klasöründe önbelleklenir (ikinci çalıştırma ağsız biter);
// `--fresh` önbelleği yok sayar.
//
// PAR (en kısa zincir, film sayısı) KESİNDİR:
//   1 → ortak film var; çok kolay, alınmaz.
//   2 → A'nın filmlerinin kadrosu ∩ B'nin filmlerinin kadrosu ≠ ∅ (1 olmadığı biliniyor).
//   3 → 2 olmadığı TÜM kadrolar taranarak biliniyor; iki taraftaki en popüler ortak-oyuncuların film listeleri
//       kesiştirilerek bir 3'lük yol bulunur. Bulunamazsa çift atılır.
// Her çözüm oyundaki yönde (oyuncunun filmleri → filmin kadrosu → …) yeniden doğrulanır.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chainCastOf, chainFilmsOf } from "../utils/filmChainRules.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "filmChainPuzzles.js");
const CACHE_DIR = path.join(os.tmpdir(), "seelogd-film-chain-cache");
const FRESH = process.argv.includes("--fresh");
const CONCURRENCY = 8;
const PAR3_SIDE = 50; // par 3 araması: her taraftan en popüler kaç ortak-oyuncu
const MAX_PUZZLES = 240;
// Bulmaca seçimi tarih bağımsız olsun: "bugün" sabit (sonradan çıkan filmler listeyi oynatmasın).
const NOW = Date.parse("2026-10-30T00:00:00Z");

function readToken() {
  if (process.env.TMDB_READ_TOKEN) return `Bearer ${process.env.TMDB_READ_TOKEN}`;
  try {
    const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
    const match = env.match(/^EXPO_PUBLIC_API_KEY=(.*)$/m);
    if (match) {
      const raw = match[1].trim().replace(/^["']|["']$/g, "");
      return raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;
    }
  } catch {}
  console.error("TMDB_READ_TOKEN ortam değişkeni (ya da .env EXPO_PUBLIC_API_KEY) gerekli.");
  process.exit(1);
}
const TOKEN = readToken();

// Tanınan, dönem ve tür olarak dağılmış oyuncu havuzu. Beklenen ad kimliği doğrular: TMDB'deki ad tutmazsa atılır.
const POOL = [
  [31, "Tom Hanks"], [505710, "Zendaya"], [4724, "Kevin Bacon"], [287, "Brad Pitt"], [6193, "Leonardo DiCaprio"],
  [5064, "Meryl Streep"], [1245, "Scarlett Johansson"], [500, "Tom Cruise"], [192, "Morgan Freeman"],
  [2231, "Samuel L. Jackson"], [3223, "Robert Downey Jr."], [6384, "Keanu Reeves"], [524, "Natalie Portman"],
  [85, "Johnny Depp"], [112, "Cate Blanchett"], [5292, "Denzel Washington"], [1813, "Anne Hathaway"],
  [1892, "Matt Damon"], [3894, "Christian Bale"], [54693, "Emma Stone"], [30614, "Ryan Gosling"],
  [234352, "Margot Robbie"], [1190668, "Timothée Chalamet"], [1373737, "Florence Pugh"], [6968, "Hugh Jackman"],
  [72129, "Jennifer Lawrence"], [74568, "Chris Hemsworth"], [2888, "Will Smith"], [1204, "Julia Roberts"],
  [1461, "George Clooney"], [2227, "Nicole Kidman"], [1158, "Al Pacino"], [380, "Robert De Niro"],
  [514, "Jack Nicholson"], [3, "Harrison Ford"], [10205, "Sigourney Weaver"], [73421, "Joaquin Phoenix"],
  [2037, "Cillian Murphy"], [2524, "Tom Hardy"], [3895, "Michael Caine"], [64, "Gary Oldman"],
  [10990, "Emma Watson"], [10980, "Daniel Radcliffe"], [116, "Keira Knightley"], [1327, "Ian McKellen"],
  [4173, "Anthony Hopkins"], [1038, "Jodie Foster"], [204, "Kate Winslet"], [1532, "Bill Murray"],
  [1253360, "Pedro Pascal"], [1136406, "Tom Holland"], [71580, "Benedict Cumberbatch"], [131, "Jake Gyllenhaal"],
  [9273, "Amy Adams"], [1023139, "Adam Driver"], [36592, "Saoirse Ronan"], [6885, "Charlize Theron"],
  [8691, "Zoe Saldaña"], [1100, "Arnold Schwarzenegger"], [62, "Bruce Willis"], [2963, "Nicolas Cage"],
  [17419, "Bryan Cranston"], [8784, "Daniel Craig"], [6161, "Jennifer Connelly"], [18918, "Dwayne Johnson"],
  [1397778, "Anya Taylor-Joy"], [1083010, "Lily James"], [139, "Uma Thurman"], [4491, "Jennifer Aniston"],
  [2963, "Nicolas Cage"], [976, "Jason Statham"], [17052, "Topher Grace"], [1625558, "Awkwafina"],
  [16828, "Chris Evans"], [1892, "Matt Damon"], [17647, "Michelle Yeoh"], [1979, "Kevin Spacey"],
  [2461, "Mel Gibson"], [3293, "Rachel Weisz"], [8891, "John Travolta"], [819, "Edward Norton"],
  // Klasik ve uluslararası yıldızlar: güncel havuza uzak düşer → "3 film"lik (zor) bulmacalar buradan çıkar.
  // Kimliği bilinmeyen (null) ya da tutmayan ad TMDB aramasıyla çözülür.
  [1932, "Audrey Hepburn"], [3149, "Marilyn Monroe"], [4110, "Humphrey Bogart"], [13848, "Charlie Chaplin"],
  [2638, "Cary Grant"], [854, "James Stewart"], [4070, "Grace Kelly"], [190, "Clint Eastwood"],
  [16757, "Sophia Loren"], [7450, "Toshirō Mifune"], [35742, "Shah Rukh Khan"], [18897, "Jackie Chan"],
  [19429, "Bruce Lee"], [20738, "Song Kang-ho"], [955, "Penélope Cruz"], [3131, "Antonio Banderas"],
  [16927, "Gérard Depardieu"], [8293, "Marion Cotillard"], [50, "Catherine Deneuve"], [1019, "Mads Mikkelsen"],
  [3810, "Javier Bardem"], [3084, "Marlon Brando"], [3635, "Elizabeth Taylor"], [3636, "Paul Newman"],
  [4111, "Ingrid Bergman"], [3380, "Bette Davis"], [null, "Cem Yılmaz"], [null, "Haluk Bilginer"],
  [null, "Kemal Sunal"], [null, "Şener Şen"], [null, "Tarık Akan"], [null, "Amitabh Bachchan"],
  [null, "Isabelle Huppert"], [null, "Lee Byung-hun"], [null, "Gong Li"], [null, "Omar Sharif"],
  [null, "Sean Connery"], [null, "Grace Jones"], [null, "Steve McQueen"], [null, "Sidney Poitier"],
];

// ── TMDB + disk önbelleği ────────────────────────────────────────────────────

fs.mkdirSync(CACHE_DIR, { recursive: true });
let requests = 0;

async function tmdb(urlPath) {
  const file = path.join(CACHE_DIR, `${urlPath.replace(/[^a-z0-9]+/gi, "_")}.json`);
  if (!FRESH && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    requests += 1;
    const response = await fetch(`https://api.themoviedb.org/3${urlPath}${urlPath.includes("?") ? "&" : "?"}language=en-US`, {
      headers: { accept: "application/json", Authorization: TOKEN },
    });
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    if (response.status === 404) {
      fs.writeFileSync(file, "null");
      return null;
    }
    if (!response.ok) throw new Error(`${urlPath} → ${response.status}`);
    const data = await response.json();
    fs.writeFileSync(file, JSON.stringify(data));
    return data;
  }
  throw new Error(`${urlPath} → 429 (vazgeçildi)`);
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        out[index] = await fn(items[index], index);
      }
    }),
  );
  return out;
}

const personMemo = new Map();
const filmsMemo = new Map();
const castMemo = new Map();

async function personOf(id) {
  if (!personMemo.has(id)) personMemo.set(id, tmdb(`/person/${id}`));
  return personMemo.get(id);
}
async function filmsOf(id) {
  if (!filmsMemo.has(id)) filmsMemo.set(id, tmdb(`/person/${id}/movie_credits`).then((d) => chainFilmsOf(d, NOW)));
  return filmsMemo.get(id);
}
async function castOf(id) {
  if (!castMemo.has(id)) castMemo.set(id, tmdb(`/movie/${id}/credits`).then((d) => chainCastOf(d)));
  return castMemo.get(id);
}

const normalizeName = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// ── Havuz ve bir adım ötesi (filmler + kadrolar) ─────────────────────────────

async function buildSide(personId) {
  const films = await filmsOf(personId);
  const casts = await mapLimit(films, CONCURRENCY, (film) => castOf(film.id));
  // Ortak-oyuncu → onu getiren EN popüler film (films zaten popülerden aza sıralı).
  const reach = new Map();
  films.forEach((film, index) => {
    casts[index].forEach((person) => {
      if (person.id === personId || reach.has(person.id)) return;
      reach.set(person.id, { film, person });
    });
  });
  return { films, filmIds: new Set(films.map((f) => f.id)), reach };
}

const personNode = (p) => ({ kind: "person", id: p.id, name: p.name, profilePath: p.profilePath ?? p.profile_path ?? null });
const filmNode = (f) => ({ kind: "film", id: f.id, title: f.title, year: f.year, posterPath: f.posterPath ?? null });

/** Çözümü oyundaki yönde doğrular: her oyuncudan sonraki film o oyuncunun listesinde, her filmden sonraki oyuncu kadroda. */
async function validatePath(nodes) {
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const node = nodes[i];
    const next = nodes[i + 1];
    if (node.kind === "person") {
      const films = await filmsOf(node.id);
      if (!films.some((f) => f.id === next.id)) return false;
    } else {
      const cast = await castOf(node.id);
      if (!cast.some((p) => p.id === next.id)) return false;
    }
  }
  const ids = nodes.map((n) => `${n.kind}:${n.id}`);
  return new Set(ids).size === ids.length;
}

async function solvePair(a, b, sides) {
  const A = sides.get(a.id);
  const B = sides.get(b.id);
  if ([...A.filmIds].some((id) => B.filmIds.has(id))) return { par: 1 };

  // par 2: ortak ortak-oyuncu. Çözüm için en popüler bağlantı (tanıdık bir yol göstermek).
  const common = [...A.reach.keys()].filter((id) => id !== b.id && B.reach.has(id));
  if (B.reach.has(a.id) || A.reach.has(b.id)) return { par: 1 }; // savunma: veri tutarsızlığı
  if (common.length) {
    common.sort((x, y) => (B.reach.get(y).person.popularity + A.reach.get(y).person.popularity) - (B.reach.get(x).person.popularity + A.reach.get(x).person.popularity));
    for (const xId of common.slice(0, 6)) {
      const via = A.reach.get(xId);
      const back = B.reach.get(xId);
      if (via.film.id === back.film.id) continue;
      const nodes = [personNode(a), filmNode(via.film), personNode(via.person), filmNode(back.film), personNode(b)];
      if (await validatePath(nodes)) return { par: 2, nodes };
    }
    return { par: 2, nodes: null };
  }

  // par 3: X (A tarafı) ile Y (B tarafı) aynı filmde.
  const top = (reach) => [...reach.values()].sort((x, y) => y.person.popularity - x.person.popularity).slice(0, PAR3_SIDE);
  const sideA = top(A.reach);
  const sideB = top(B.reach);
  const filmToX = new Map();
  const filmsA = await mapLimit(sideA, CONCURRENCY, (entry) => filmsOf(entry.person.id));
  sideA.forEach((entry, index) => {
    filmsA[index].forEach((film) => {
      if (!filmToX.has(film.id)) filmToX.set(film.id, { entry, film });
    });
  });
  const filmsB = await mapLimit(sideB, CONCURRENCY, (entry) => filmsOf(entry.person.id));
  for (let index = 0; index < sideB.length; index += 1) {
    const yEntry = sideB[index];
    for (const film of filmsB[index]) {
      const hit = filmToX.get(film.id);
      if (!hit || hit.entry.person.id === yEntry.person.id) continue;
      const nodes = [
        personNode(a), filmNode(hit.entry.film), personNode(hit.entry.person),
        filmNode(hit.film), personNode(yEntry.person), filmNode(yEntry.film), personNode(b),
      ];
      if (await validatePath(nodes)) return { par: 3, nodes };
    }
  }
  return { par: 4, nodes: null }; // 3'te bulunamadı: kesin değil, alınmaz
}

// ── Ana akış ─────────────────────────────────────────────────────────────────

async function main() {
  const unique = [...new Map(POOL.map(([id, name]) => [name, id])).entries()];
  const people = [];
  const seenIds = new Set();
  for (const [expected, givenId] of unique) {
    let person = givenId ? await personOf(givenId) : null;
    if (!person || normalizeName(person.name) !== normalizeName(expected)) {
      const found = await tmdb(`/search/person?query=${encodeURIComponent(expected)}`);
      const hit = (found?.results || []).find(
        (p) => p.known_for_department === "Acting" && normalizeName(p.name) === normalizeName(expected),
      );
      if (!hit) {
        console.warn(`× "${expected}" (${givenId}) TMDB'de bulunamadı — atlandı`);
        continue;
      }
      if (givenId) console.warn(`~ "${expected}": ${givenId} yanlış, aramayla ${hit.id}`);
      person = await personOf(hit.id);
    }
    if (!person || seenIds.has(person.id)) continue;
    seenIds.add(person.id);
    people.push({ id: person.id, name: person.name, profilePath: person.profile_path || null, popularity: person.popularity || 0 });
  }
  console.log(`Havuz: ${people.length} oyuncu`);

  const sides = new Map();
  for (const person of people) {
    sides.set(person.id, await buildSide(person.id));
    process.stdout.write(`  ${person.name}: ${sides.get(person.id).films.length} film, ${sides.get(person.id).reach.size} ortak-oyuncu\n`);
  }

  const results = { 1: 0, 2: 0, 3: 0, 4: 0, invalid: 0 };
  const puzzles = [];
  for (let i = 0; i < people.length; i += 1) {
    for (let j = i + 1; j < people.length; j += 1) {
      const [a, b] = (people[i].id + people[j].id) % 2 ? [people[i], people[j]] : [people[j], people[i]];
      const solved = await solvePair(a, b, sides);
      if (solved.par === 1 || solved.par === 4) { results[solved.par] += 1; continue; }
      if (!solved.nodes) { results.invalid += 1; continue; }
      results[solved.par] += 1;
      puzzles.push({
        id: `${a.id}-${b.id}`,
        start: personNode(a),
        target: personNode(b),
        par: solved.par,
        solution: solved.nodes,
      });
    }
    console.log(`  ${i + 1}/${people.length} · istek ${requests} · bulmaca ${puzzles.length}`);
  }
  console.log("Dağılım:", results);

  // Sıra: par 3'ler seyrek ama düzenli gelsin (yaklaşık her üç günde bir), aynı oyuncu art arda günlerde tekrar etmesin.
  const hash = (s) => [...s].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0), 2166136261);
  const byHash = (list) => [...list].sort((x, y) => hash(x.id) - hash(y.id));
  const par3 = byHash(puzzles.filter((p) => p.par === 3));
  const par2 = byHash(puzzles.filter((p) => p.par === 2));
  const ordered = [];
  const used = (p, k) => ordered.slice(-k).some((q) => [q.start.id, q.target.id].some((id) => id === p.start.id || id === p.target.id));
  while ((par2.length || par3.length) && ordered.length < MAX_PUZZLES) {
    const wantHard = ordered.length % 3 === 2 && par3.length;
    const source = wantHard ? par3 : par2.length ? par2 : par3;
    let index = source.findIndex((p) => !used(p, 4));
    if (index < 0) index = 0;
    ordered.push(source.splice(index, 1)[0]);
  }

  const header = [
    "// data/filmChainPuzzles.js",
    "//",
    "// ÜRETİLMİŞ DOSYA — elle düzenleme. Üretici: scripts/build-film-chain-puzzles.mjs (kural: utils/filmChainRules.js).",
    "// Film Zinciri günlük/serbest bulmacaları: başlangıç → hedef, `par` = KESİN en kısa zincirin film sayısı,",
    "// `solution` = o uzunlukta doğrulanmış bir zincir (Pes et'te gösterilir; başlıklar İngilizce).",
    `// Üretim: ${new Date().toISOString().slice(0, 10)} · ${ordered.length} bulmaca`,
    "",
  ].join("\n");
  // Bulmaca başına tek satır: dosya küçük kalır, yeniden üretimin farkı satır satır okunur.
  const lines = ordered.map((p) => `  ${JSON.stringify(p)},`).join("\n");
  fs.writeFileSync(OUT, `${header}export const FILM_CHAIN_PUZZLES = Object.freeze([\n${lines}\n]);\n`);
  console.log(`Yazıldı: ${path.relative(ROOT, OUT)} (${ordered.length} bulmaca, par3 ${ordered.filter((p) => p.par === 3).length}) · TMDB isteği ${requests}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
