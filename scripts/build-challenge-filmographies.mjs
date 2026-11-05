// scripts/build-challenge-filmographies.mjs
//
// Meydan Okumalar'daki (docs/ozellikler/MEYDAN_OKUMALAR.md) kişi görevlerinin ("Bir yönetmenin tüm filmleri",
// "Bir oyuncunun başrol filmleri") film listelerini ÖNCEDEN üretir ve data/challengeFilmographies.js'i yazar.
//
// Neden önceden: TMDB'nin `movie_credits` yanıtında süre yok; kısa film, derleme ve belgesel ancak her filmin
// ayrıntısı okunarak ayıklanır. Bunu her kullanıcının cihazında yapmak ağır olurdu; liste de sabit kalmalı
// (hedef "15 film" iken ertesi gün 16 olmasın — yeni film çıkınca script yeniden çalıştırılır).
//
// Çalıştırma (PowerShell):
//   $env:TMDB_READ_TOKEN = "..."   # yoksa .env'deki EXPO_PUBLIC_API_KEY okunur
//   node scripts/build-challenge-filmographies.mjs
// Film ayrıntıları node_modules/.cache/challenge-filmographies.json'da tutulur (yeniden çalıştırma hızlı).
//
// KURAL
//   Yönetmen: iş = "Director".
//   Oyuncu  : oyuncu kadrosunda İLK 4 sırada (başrol / ana kadro); "Himself / Herself", arşiv görüntüsü ve
//             isimsiz (uncredited) rol sayılmaz.
//   Ortak   : yayınlanmış (NOW'dan önce), yetişkin değil, belgesel değil, süre ≥ 60 dk, en az `minVotes` oy,
//             EXCLUDED'da değil. Türk sineması (`tr`) TMDB'de az oy aldığı için eşiği düşük.
//   Üst sınır: MAX_FILMS'ten fazlaysa EN ÇOK OY ALAN MAX_FILMS film kalır ve kişi `capped` işaretlenir
//             (metin "tüm filmleri" yerine "en bilinen N filmi" der). 3'ten az film kalan kişi yazılmaz.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "challengeFilmographies.js");
const CACHE = path.join(ROOT, "node_modules", ".cache", "challenge-filmographies.json");
const NOW = "2026-11-05";
const MIN_RUNTIME = 60;
const MAX_FILMS = 40;
const MIN_FILMS = 3;
const ACTOR_MAX_ORDER = 3; // 0-tabanlı: ilk 4 isim
const DOCUMENTARY = 99;
const MIN_VOTES = { director: 50, actor: 80 };
const MIN_VOTES_TR = 4;
// Kurala uyup yine de "o kişinin bir filmi" sayılmaması gerekenler: antoloji (yönetmen bir bölümü çekti),
// yeniden kurgu / çift gösterim ve klip derlemesi.
const EXCLUDED = new Set([
  5, // Four Rooms (antoloji)
  285923, // Grindhouse (çift gösterim; Death Proof ayrıca listede)
  414419, // Kill Bill: The Whole Bloody Affair (yeniden kurgu)
  284582, // Madonna: The Immaculate Collection (klip derlemesi)
  8938, // Tokyo! (antoloji)
]);
const SELF_ROLE = /^(him|her|them)?sel(f|ves)\b|\(archive|\(uncredited\)|^narrator$/i;

// Sıra = ekrandaki varsayılan sıra. `id` TMDB kişi kimliği; yoksa adla aranır (çıktıda kimlik yazılır, sabitlenir).
// `tr`: Türk sineması (ekrandaki "Türk sineması" süzgeci + düşük oy eşiği).
const PEOPLE = [
  // ── Yönetmenler ──
  { role: "director", id: 525 }, // Christopher Nolan
  { role: "director", id: 240 }, // Stanley Kubrick
  { role: "director", id: 608 }, // Hayao Miyazaki
  { role: "director", id: 138 }, // Quentin Tarantino
  { role: "director", id: 137427 }, // Denis Villeneuve
  { role: "director", id: 56214, tr: true }, // Nuri Bilge Ceylan
  { role: "director", id: 7467 }, // David Fincher
  { role: "director", id: 21684 }, // Bong Joon Ho
  { role: "director", id: 5655 }, // Wes Anderson
  { role: "director", id: 5026 }, // Akira Kurosawa
  { role: "director", name: "Zeki Demirkubuz", tr: true },
  { role: "director", name: "Steven Spielberg" },
  { role: "director", name: "Martin Scorsese" },
  { role: "director", name: "Alfred Hitchcock" },
  { role: "director", name: "Francis Ford Coppola" },
  { role: "director", name: "Ridley Scott" },
  { role: "director", name: "James Cameron" },
  { role: "director", name: "Tim Burton" },
  { role: "director", name: "Guy Ritchie" },
  { role: "director", name: "Paul Thomas Anderson" },
  { role: "director", name: "Joel Coen" },
  { role: "director", name: "David Lynch" },
  { role: "director", id: 10099 }, // Park Chan-wook (adla arama "Park Chan Wook" adlı başka kişiyi buluyor)
  { role: "director", name: "Wong Kar-wai" },
  { role: "director", name: "Andrei Tarkovsky" },
  { role: "director", name: "Ingmar Bergman" },
  { role: "director", name: "Federico Fellini" },
  { role: "director", name: "Sergio Leone" },
  { role: "director", name: "Krzysztof Kieślowski" },
  { role: "director", name: "Pedro Almodóvar" },
  { role: "director", name: "Guillermo del Toro" },
  { role: "director", name: "Alfonso Cuarón" },
  { role: "director", name: "Alejandro González Iñárritu" },
  { role: "director", name: "Hirokazu Kore-eda" },
  { role: "director", name: "Satoshi Kon" },
  { role: "director", name: "Yorgos Lanthimos" },
  { role: "director", name: "Darren Aronofsky" },
  { role: "director", name: "Edgar Wright" },
  { role: "director", name: "Damien Chazelle" },
  { role: "director", name: "Greta Gerwig" },
  { role: "director", name: "Jordan Peele" },
  { role: "director", name: "Ari Aster" },
  { role: "director", name: "Michael Haneke" },
  { role: "director", name: "Asghar Farhadi" },
  { role: "director", name: "Lars von Trier" },
  { role: "director", name: "Clint Eastwood" },
  { role: "director", name: "Yılmaz Güney", tr: true },
  { role: "director", name: "Ferzan Özpetek", tr: true },
  { role: "director", name: "Fatih Akin", tr: true },
  { role: "director", name: "Semih Kaplanoğlu", tr: true },
  { role: "director", name: "Yavuz Turgul", tr: true },
  { role: "director", name: "Çağan Irmak", tr: true },
  { role: "director", name: "Reha Erdem", tr: true },
  { role: "director", name: "Ömer Kavur", tr: true },
  { role: "director", name: "Ertem Eğilmez", tr: true },
  { role: "director", name: "Atıf Yılmaz", tr: true },
  // ── Oyuncular ──
  { role: "actor", name: "Aamir Khan" },
  { role: "actor", name: "Shah Rukh Khan" },
  { role: "actor", name: "Leonardo DiCaprio" },
  { role: "actor", name: "Tom Hanks" },
  { role: "actor", name: "Brad Pitt" },
  { role: "actor", name: "Meryl Streep" },
  { role: "actor", name: "Keanu Reeves" },
  { role: "actor", name: "Tom Cruise" },
  { role: "actor", name: "Denzel Washington" },
  { role: "actor", name: "Cillian Murphy" },
  { role: "actor", name: "Joaquin Phoenix" },
  { role: "actor", name: "Christian Bale" },
  { role: "actor", name: "Robert De Niro" },
  { role: "actor", name: "Al Pacino" },
  { role: "actor", name: "Daniel Day-Lewis" },
  { role: "actor", name: "Morgan Freeman" },
  { role: "actor", name: "Johnny Depp" },
  { role: "actor", name: "Jim Carrey" },
  { role: "actor", name: "Anthony Hopkins" },
  { role: "actor", name: "Ryan Gosling" },
  { role: "actor", name: "Natalie Portman" },
  { role: "actor", name: "Scarlett Johansson" },
  { role: "actor", name: "Kate Winslet" },
  { role: "actor", name: "Cate Blanchett" },
  { role: "actor", name: "Emma Stone" },
  { role: "actor", name: "Audrey Hepburn" },
  { role: "actor", name: "Marlon Brando" },
  { role: "actor", name: "Jack Nicholson" },
  { role: "actor", name: "Jackie Chan" },
  { role: "actor", name: "Song Kang-ho" },
  { role: "actor", name: "Toshiro Mifune" },
  { role: "actor", name: "Kemal Sunal", tr: true },
  { role: "actor", name: "Şener Şen", tr: true },
  { role: "actor", name: "Türkan Şoray", tr: true },
  { role: "actor", name: "Tarık Akan", tr: true },
  { role: "actor", name: "Cüneyt Arkın", tr: true },
  { role: "actor", name: "Hülya Koçyiğit", tr: true },
  { role: "actor", name: "Münir Özkul", tr: true },
  { role: "actor", name: "Haluk Bilginer", tr: true },
  { role: "actor", name: "Cem Yılmaz", tr: true },
  { role: "actor", name: "Yılmaz Erdoğan", tr: true },
  { role: "actor", name: "Adile Naşit", tr: true },
  { role: "actor", name: "Kadir İnanır", tr: true },
];

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

const AUTH = readToken();

async function tmdb(p) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(`https://api.themoviedb.org/3${p}`, { headers: { Authorization: AUTH } });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} ${p}`);
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw new Error(`retry ${p}`);
}

let cache = {};
try {
  cache = JSON.parse(fs.readFileSync(CACHE, "utf8"));
} catch {}
const saveCache = () => {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(cache));
};

async function detailOf(id) {
  const key = String(id);
  if (cache[key]) return cache[key];
  const d = await tmdb(`/movie/${id}?language=en-US`);
  cache[key] = { runtime: d.runtime || 0, title: d.title, posterPath: d.poster_path || null };
  return cache[key];
}

/** En çok `limit` paralel iş. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function resolvePerson(entry) {
  if (entry.id) return entry.id;
  const department = entry.role === "director" ? "Directing" : "Acting";
  const res = await tmdb(`/search/person?query=${encodeURIComponent(entry.name)}&language=en-US`);
  const hits = res.results || [];
  // Önce TAM ad (aksan/tire/büyük harf yok sayılır), sonra alan, sonra ilk sonuç.
  const fold = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const exact = hits.filter((p) => fold(p.name) === fold(entry.name));
  const hit =
    exact.find((p) => p.known_for_department === department) ||
    exact[0] ||
    hits.find((p) => p.known_for_department === department) ||
    hits[0];
  if (!hit) throw new Error(`kişi bulunamadı: ${entry.name}`);
  return hit.id;
}

function isCandidate(m, entry) {
  if (m.adult || !m.release_date || m.release_date > NOW || EXCLUDED.has(m.id)) return false;
  if ((m.genre_ids || []).includes(DOCUMENTARY)) return false;
  const minVotes = entry.tr ? MIN_VOTES_TR : MIN_VOTES[entry.role];
  if ((m.vote_count || 0) < minVotes) return false;
  if (entry.role === "director") return m.job === "Director";
  return Number.isInteger(m.order) && m.order <= ACTOR_MAX_ORDER && !SELF_ROLE.test(String(m.character || "").trim());
}

async function filmographyOf(entry) {
  const personId = await resolvePerson(entry);
  const person = await tmdb(`/person/${personId}?language=en-US`);
  const credits = await tmdb(`/person/${personId}/movie_credits?language=en-US`);
  const candidates = new Map();
  for (const m of entry.role === "director" ? credits.crew || [] : credits.cast || []) {
    if (isCandidate(m, entry)) candidates.set(m.id, m);
  }
  const details = await pool([...candidates.values()], 8, async (m) => ({ m, d: await detailOf(m.id) }));
  let films = details
    .filter(({ d }) => d.runtime >= MIN_RUNTIME)
    .map(({ m, d }) => ({
      id: m.id,
      title: d.title || m.title,
      year: Number(m.release_date.slice(0, 4)),
      posterPath: d.posterPath || m.poster_path || null,
      votes: m.vote_count || 0,
    }));
  const capped = films.length > MAX_FILMS;
  if (capped) films = [...films].sort((a, b) => b.votes - a.votes).slice(0, MAX_FILMS);
  films.sort((a, b) => a.year - b.year || a.id - b.id);
  return {
    id: person.id,
    name: person.name,
    role: entry.role,
    ...(entry.tr ? { tr: true } : {}),
    ...(capped ? { capped: true } : {}),
    profilePath: person.profile_path || null,
    films: films.map(({ votes, ...film }) => film),
  };
}

const rows = [];
const seen = new Set();
for (const entry of PEOPLE) {
  try {
    const row = await filmographyOf(entry);
    const key = `${row.role}_${row.id}`;
    const tag = `${row.role === "director" ? "Y" : "O"} ${row.id} ${row.name}${entry.name && entry.name !== row.name ? ` (aranan: ${entry.name})` : ""}`;
    if (seen.has(key)) {
      console.log(`ATLANDI (yinelenen) ${tag}`);
      continue;
    }
    if (row.films.length < MIN_FILMS) {
      console.log(`ATLANDI (${row.films.length} film) ${tag}`);
      continue;
    }
    seen.add(key);
    console.log(`${tag}: ${row.films.length} film${row.capped ? " (sınırlı)" : ""}`);
    rows.push(row);
  } catch (error) {
    console.log(`HATA ${entry.name || entry.id}: ${error.message}`);
  }
  saveCache();
}

const body = rows.map((row) => `  ${JSON.stringify(row)},`).join("\n");
const directors = rows.filter((r) => r.role === "director").length;
fs.writeFileSync(
  OUT,
  `// data/challengeFilmographies.js
//
// ÜRETİLMİŞ DOSYA — elle düzenleme. Üretici: scripts/build-challenge-filmographies.mjs.
// Kişi meydan okumalarının film listeleri: yönetmenin filmleri / oyuncunun başrol filmleri (uzun metraj, belgesel
// hariç; başlıklar İngilizce). \`capped\`: en bilinen ${MAX_FILMS} film. \`tr\`: Türk sineması süzgeci.
// Üretim: ${NOW} · ${directors} yönetmen · ${rows.length - directors} oyuncu
export const CHALLENGE_FILMOGRAPHIES = Object.freeze([
${body}
]);
`,
);
console.log(`→ ${path.relative(ROOT, OUT)}`);
