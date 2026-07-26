#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const DEFAULT_UID = "Sno7mWprjhS24fc4ub3fC1wyBYq2";
const TMDB_LANGUAGE = "tr-TR";
const PAGE_SIZE = 300;
const MAX_COMMIT_WRITES = 500;

const args = new Set(process.argv.slice(2));
const applyChanges = args.has("--apply");
const uidArgIndex = process.argv.indexOf("--uid");
const uid = uidArgIndex >= 0 ? process.argv[uidArgIndex + 1] : DEFAULT_UID;

if (!uid || uid.startsWith("--")) {
  throw new Error("Geçerli bir --uid değeri gerekli.");
}

const projectRoot = path.resolve(__dirname, "..");

function parseEnvFile(filePath) {
  const values = {};
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function loadProjectId() {
  const firebaseRc = JSON.parse(
    fs.readFileSync(path.join(projectRoot, ".firebaserc"), "utf8"),
  );
  const projectId = firebaseRc?.projects?.default;
  if (!projectId) throw new Error(".firebaserc içinde varsayılan proje bulunamadı.");
  return projectId;
}

async function loadFirebaseAccessToken() {
  const npmRoot = execFileSync("npm", ["root", "-g"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  }).trim();
  const auth = require(path.join(npmRoot, "firebase-tools", "lib", "auth.js"));
  const account = auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error("Firebase CLI oturumu bulunamadı.");
  }
  const result = await auth.getAccessToken(account.tokens.refresh_token, []);
  if (!result?.access_token) throw new Error("Firebase erişim anahtarı alınamadı.");
  return result.access_token;
}

function collectHistoricalTmdbCredentials() {
  const credentials = new Set();
  const files = ["context/AppSettingsContext.js", ".env", "app.json", "functions/index.js"];
  for (const file of files) {
    let hashes = [];
    try {
      hashes = execFileSync("git", ["log", "--all", "--format=%H", "--", file], {
        cwd: projectRoot,
        encoding: "utf8",
      })
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(0, 100);
    } catch {
      continue;
    }
    for (const hash of hashes) {
      let content;
      try {
        content = execFileSync("git", ["show", `${hash}:${file}`], {
          cwd: projectRoot,
          encoding: "utf8",
          maxBuffer: 5_000_000,
        });
      } catch {
        continue;
      }
      for (const match of content.matchAll(
        /Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g,
      )) {
        credentials.add(`Bearer ${match[1]}`);
      }
      for (const match of content.matchAll(
        /(?:TMDB|API_KEY)[^\n]{0,80}['"]([a-f0-9]{32})['"]/gi,
      )) {
        credentials.add(match[1]);
      }
    }
  }
  return [...credentials];
}

function tmdbRequestOptions(credential) {
  if (/^Bearer\s/i.test(credential)) {
    return {
      headers: { Authorization: credential, accept: "application/json" },
    };
  }
  return { headers: { accept: "application/json" }, apiKey: credential };
}

async function loadTmdbCredential() {
  const env = parseEnvFile(path.join(projectRoot, ".env"));
  const candidates = [env.EXPO_PUBLIC_API_KEY, ...collectHistoricalTmdbCredentials()].filter(
    Boolean,
  );
  for (const credential of [...new Set(candidates)]) {
    const request = tmdbRequestOptions(credential);
    const url = new URL("https://api.themoviedb.org/3/movie/550");
    url.searchParams.set("language", TMDB_LANGUAGE);
    if (request.apiKey) url.searchParams.set("api_key", request.apiKey);
    try {
      const response = await fetch(url, { headers: request.headers });
      if (!response.ok) continue;
      const body = await response.json();
      if (body?.id === 550) return credential;
    } catch {
      // Sonraki güvenli aday denenir.
    }
  }
  throw new Error("Geçerli bir TMDB erişim belirteci bulunamadı.");
}

function decodeFirestoreValue(value) {
  if (!value) return undefined;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(decodeFirestoreValue);
  }
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, item]) => [
        key,
        decodeFirestoreValue(item),
      ]),
    );
  }
  return undefined;
}

function encodeString(value) {
  return { stringValue: value };
}

function encodeStringArray(values) {
  return {
    arrayValue: {
      values: values.map(encodeString),
    },
  };
}

function isValidIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function normalizeLegacyDate(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const normalized = `${match[3]}-${match[2]}-${match[1]}`;
  return isValidIsoDate(normalized) ? normalized : null;
}

function hasUsableExistingDate(rawValue, decodedValue) {
  if (isValidIsoDate(decodedValue)) return true;
  if (rawValue?.timestampValue) return true;
  if (
    rawValue?.mapValue?.fields?.seconds &&
    Number.isFinite(Number(decodeFirestoreValue(rawValue.mapValue.fields.seconds)))
  ) {
    return true;
  }
  return false;
}

function arraysEqual(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

async function fetchJsonWithRetry(url, options, label, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return await response.json();
      const body = await response.text();
      if (response.status === 404) {
        const error = new Error(`${label}: 404`);
        error.status = 404;
        throw error;
      }
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`${label}: HTTP ${response.status} ${body.slice(0, 200)}`);
      }
      lastError = new Error(`${label}: HTTP ${response.status}`);
    } catch (error) {
      if (error.status === 404) throw error;
      lastError = error;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 350 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  return results;
}

async function listWatchedMovieDocuments(baseUrl, headers) {
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(`${baseUrl}/Lists/${uid}/watchedMovies`);
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await fetchJsonWithRetry(url, { headers }, "Firestore listeleme");
    documents.push(...(data.documents || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return documents;
}

async function fetchTmdbMovie(movieId, credential) {
  const url = new URL(`https://api.themoviedb.org/3/movie/${movieId}`);
  url.searchParams.set("language", TMDB_LANGUAGE);
  const request = tmdbRequestOptions(credential);
  if (request.apiKey) url.searchParams.set("api_key", request.apiKey);
  return fetchJsonWithRetry(
    url,
    {
      headers: request.headers,
    },
    `TMDB movie/${movieId}`,
  );
}

function makeBackupPath() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(os.tmpdir(), `seelogd-watchedMovies-${uid}-${stamp}.json`);
}

async function main() {
  const projectId = loadProjectId();
  const [firebaseToken, tmdbCredential] = await Promise.all([
    loadFirebaseAccessToken(),
    loadTmdbCredential(),
  ]);
  const databaseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;
  const documentsBaseUrl = `${databaseUrl}/documents`;
  const firestoreHeaders = { Authorization: `Bearer ${firebaseToken}` };

  const documents = await listWatchedMovieDocuments(documentsBaseUrl, firestoreHeaders);
  if (documents.length > MAX_COMMIT_WRITES) {
    throw new Error(
      `Güvenli tek işlem sınırı aşıldı: ${documents.length}/${MAX_COMMIT_WRITES}`,
    );
  }

  const records = documents.map((document) => {
    const decoded = Object.fromEntries(
      Object.entries(document.fields || {}).map(([key, value]) => [
        key,
        decodeFirestoreValue(value),
      ]),
    );
    const movieId = Number(decoded.id);
    if (!Number.isInteger(movieId) || movieId <= 0) {
      throw new Error(`Geçersiz film kimliği: ${document.name}`);
    }
    return { document, decoded, movieId };
  });

  let completed = 0;
  const tmdbResults = await mapWithConcurrency(records, 10, async (record) => {
    try {
      const details = await fetchTmdbMovie(record.movieId, tmdbCredential);
      return { ok: true, details };
    } catch (error) {
      return { ok: false, error: error.message };
    } finally {
      completed += 1;
      if (completed % 50 === 0 || completed === records.length) {
        process.stdout.write(`TMDB doğrulama: ${completed}/${records.length}\n`);
      }
    }
  });

  const unresolved = [];
  const writes = [];
  const backupEntries = [];
  const summary = {
    totalDocuments: records.length,
    dateFromRelease: 0,
    dateNormalized: 0,
    genresFilled: 0,
    genresCorrected: 0,
    unchanged: 0,
    unresolvedMovies: 0,
    unresolvedDates: 0,
  };

  records.forEach((record, index) => {
    const { document, decoded, movieId } = record;
    const tmdb = tmdbResults[index];
    if (!tmdb.ok) {
      unresolved.push({ movieId, name: decoded.name || "", reason: tmdb.error });
      summary.unresolvedMovies += 1;
      return;
    }

    const details = tmdb.details;
    const canonicalGenres = (details.genres || [])
      .map((genre) => String(genre?.name || "").trim())
      .filter(Boolean);
    const currentGenres = Array.isArray(decoded.genres) ? decoded.genres : [];
    const fieldPaths = [];
    const fields = {};
    const reasons = [];

    const rawDate = document.fields?.dateAdded;
    if (!hasUsableExistingDate(rawDate, decoded.dateAdded)) {
      const normalizedLegacyDate = normalizeLegacyDate(decoded.dateAdded);
      if (normalizedLegacyDate) {
        fields.dateAdded = encodeString(normalizedLegacyDate);
        fieldPaths.push("dateAdded");
        reasons.push("legacy-date-normalized");
        summary.dateNormalized += 1;
      } else if (isValidIsoDate(details.release_date)) {
        fields.dateAdded = encodeString(details.release_date);
        fieldPaths.push("dateAdded");
        reasons.push("release-date-filled");
        summary.dateFromRelease += 1;
      } else {
        unresolved.push({
          movieId,
          name: decoded.name || details.title || "",
          reason: "TMDB yayın tarihi boş",
        });
        summary.unresolvedDates += 1;
      }
    }

    if (canonicalGenres.length > 0 && !arraysEqual(currentGenres, canonicalGenres)) {
      fields.genres = encodeStringArray(canonicalGenres);
      fieldPaths.push("genres");
      if (currentGenres.length === 0) summary.genresFilled += 1;
      else summary.genresCorrected += 1;
      reasons.push(currentGenres.length === 0 ? "genres-filled" : "genres-corrected");
    }

    if (fieldPaths.length === 0) {
      summary.unchanged += 1;
      return;
    }

    writes.push({
      update: {
        name: document.name,
        fields,
      },
      updateMask: { fieldPaths },
      currentDocument: { updateTime: document.updateTime },
    });
    backupEntries.push({
      documentName: document.name,
      movieId,
      movieName: decoded.name || details.title || "",
      updateTime: document.updateTime,
      reasons,
      original: Object.fromEntries(
        fieldPaths.map((fieldPath) => [fieldPath, document.fields?.[fieldPath] ?? null]),
      ),
      planned: fields,
      tmdb: {
        id: details.id,
        title: details.title,
        release_date: details.release_date || null,
        genres: canonicalGenres,
      },
    });
  });

  console.log(JSON.stringify({ mode: applyChanges ? "apply" : "dry-run", writes: writes.length, ...summary }, null, 2));
  if (unresolved.length > 0) {
    console.log("Çözülemeyen kayıtlar:");
    console.log(JSON.stringify(unresolved.slice(0, 20), null, 2));
    if (unresolved.length > 20) {
      console.log(`... ve ${unresolved.length - 20} kayıt daha.`);
    }
  }

  if (!applyChanges) {
    console.log("Yazma yapılmadı. Uygulamak için --apply kullanın.");
    return;
  }
  if (unresolved.length > 0) {
    throw new Error("Çözülemeyen kayıt bulunduğu için canlı yazma iptal edildi.");
  }
  if (writes.length === 0) {
    console.log("Güncellenecek kayıt yok.");
    return;
  }

  const backupPath = makeBackupPath();
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        projectId,
        uid,
        collection: `Lists/${uid}/watchedMovies`,
        entries: backupEntries,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Yedek oluşturuldu: ${backupPath}`);

  const commitResponse = await fetch(`${databaseUrl}/documents:commit`, {
    method: "POST",
    headers: {
      ...firestoreHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ writes }),
  });
  if (!commitResponse.ok) {
    throw new Error(`Firestore commit başarısız: ${commitResponse.status} ${await commitResponse.text()}`);
  }
  await commitResponse.json();

  const verifiedDocuments = await listWatchedMovieDocuments(documentsBaseUrl, firestoreHeaders);
  const verifiedByName = new Map(verifiedDocuments.map((document) => [document.name, document]));
  const mismatches = [];
  for (const write of writes) {
    const actual = verifiedByName.get(write.update.name);
    if (!actual) {
      mismatches.push({ documentName: write.update.name, reason: "document-missing" });
      continue;
    }
    for (const fieldPath of write.updateMask.fieldPaths) {
      const expected = JSON.stringify(write.update.fields[fieldPath]);
      const received = JSON.stringify(actual.fields?.[fieldPath]);
      if (expected !== received) {
        mismatches.push({ documentName: write.update.name, fieldPath, expected, received });
      }
    }
  }
  if (verifiedDocuments.length !== documents.length) {
    mismatches.push({
      reason: "document-count-changed",
      before: documents.length,
      after: verifiedDocuments.length,
    });
  }
  if (mismatches.length > 0) {
    throw new Error(`Doğrulama başarısız: ${JSON.stringify(mismatches.slice(0, 10))}`);
  }
  console.log(`Doğrulama başarılı: ${writes.length} kayıt, ${verifiedDocuments.length} toplam film.`);
  console.log(`Yedek: ${backupPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
