#!/usr/bin/env node

/**
 * TvComment kapsam (scope) backfill'i.
 *
 * Dizi yorumlarına kapsam alanları eklendi (utils/commentScope.js):
 *   scope, seasonNumber, episodeNumber, scopeKey, scopeTitle
 * Bu alanlardan ÖNCE yazılmış yorumlarda hiçbiri yok. İstemci onları
 * normalizeScope() ile "dizi geneli" sayıyor, dolayısıyla UYGULAMA BUGÜN
 * DOĞRU ÇALIŞIYOR — bu script davranış düzeltmiyor.
 *
 * NEDEN VAR: filtreleme bugün istemcide (tek onSnapshot + client-side süzme).
 * İleride sunucu tarafına taşınırsa (where("scopeKey","==","show")) ALANI
 * OLMAYAN doküman sorguya hiç girmez ve eski yorumlar aniden kaybolur.
 * Bu script o kapıyı kapatır.
 *
 * NE YAZAR: yalnız kapsam alanı OLMAYAN dokümanlara, updateMask ile, tam olarak
 * beş alan:  scope:"show", seasonNumber:null, episodeNumber:null,
 *            scopeKey:"show", scopeTitle:null
 * Kapsamı olan (özellik sonrası yazılmış) dokümanlara DOKUNMAZ. Tahmin
 * üretmez: eski yorumlar yazılırken sezon/bölüm hiç sorulmadı, hangisine ait
 * olduğu bilinemez — hepsi "dizi geneli" olur.
 *
 * NEYİ YAZMAZ: Users/{uid}/myComments aynaları. O koleksiyon hiçbir zaman
 * scopeKey'e göre SORGULANMIYOR (bütünü çekilip listeleniyor), oraya "show"
 * yazmak sıfır davranış değişikliğiyle bütün kullanıcıları taramak demekti.
 *
 * KİMLİK: Firebase CLI oturumu kullanılır (servis hesabı dosyası gerekmez).
 *   firebase login   →   sonra bu script.
 *
 * KULLANIM:
 *   node scripts/backfill-comment-scope.cjs                  # kuru çalışma (varsayılan)
 *   node scripts/backfill-comment-scope.cjs --show 1396      # tek diziyle dene
 *   node scripts/backfill-comment-scope.cjs --apply          # gerçekten yaz
 *   node scripts/backfill-comment-scope.cjs --apply --no-precondition
 *
 * TEKRAR ÇALIŞTIRILABİLİR: yazılmış dokümanlar ikinci turda atlanır, bu yüzden
 * yarıda kalan/kısmen başarısız bir koşuyu düzeltmenin yolu scripti yeniden
 * çalıştırmaktır.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const PAGE_SIZE = 300;
const MAX_COMMIT_WRITES = 500; // Firestore :commit tek istekte en fazla 500 yazma
const LIST_CONCURRENCY = 8;
const BATCH_GET_SIZE = 300;

// Yazılacak alanlar — normalizeScope(null)'ın Firestore karşılığı.
const SCOPE_FIELD_PATHS = [
  "scope",
  "seasonNumber",
  "episodeNumber",
  "scopeKey",
  "scopeTitle",
];
const SHOW_SCOPE_FIELDS = {
  scope: { stringValue: "show" },
  seasonNumber: { nullValue: null },
  episodeNumber: { nullValue: null },
  scopeKey: { stringValue: "show" },
  scopeTitle: { nullValue: null },
};

const argv = process.argv.slice(2);
const args = new Set(argv);
const applyChanges = args.has("--apply");
const usePrecondition = !args.has("--no-precondition");
const showArgIndex = argv.indexOf("--show");
const onlyShowId = showArgIndex >= 0 ? argv[showArgIndex + 1] : null;

if (showArgIndex >= 0 && (!onlyShowId || onlyShowId.startsWith("--"))) {
  throw new Error("--show bayrağı bir dizi kimliği bekliyor (ör. --show 1396).");
}

const projectRoot = path.resolve(__dirname, "..");

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
    throw new Error("Firebase CLI oturumu bulunamadı. Önce `firebase login` çalıştırın.");
  }
  const result = await auth.getAccessToken(account.tokens.refresh_token, []);
  if (!result?.access_token) throw new Error("Firebase erişim anahtarı alınamadı.");
  return result.access_token;
}

async function fetchJsonWithRetry(url, options, label, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return await response.json();
      const body = await response.text();
      // 4xx (429 hariç) kalıcı hatadır — tekrar denemek anlamsız.
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`${label}: HTTP ${response.status} ${body.slice(0, 300)}`);
      }
      lastError = new Error(`${label}: HTTP ${response.status}`);
    } catch (error) {
      if (/HTTP 4\d\d/.test(error.message) && !/HTTP 429/.test(error.message)) throw error;
      lastError = error;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

/** Bir koleksiyonun tüm dokümanlarını sayfalayarak getirir. */
async function listCollection(collectionUrl, headers, label, extraParams = {}) {
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(collectionUrl);
    url.searchParams.set("pageSize", String(PAGE_SIZE));
    for (const [key, value] of Object.entries(extraParams)) {
      url.searchParams.set(key, value);
    }
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await fetchJsonWithRetry(url, { headers }, label);
    documents.push(...(data.documents || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return documents;
}

/**
 * TvComment altındaki dizi kimlikleri.
 * showMissing=true şart: TvComment/{tvId} çoğu zaman GERÇEK bir doküman
 * değildir (istemci doğrudan alt koleksiyona yazar), yalnız alt koleksiyonun
 * atası olarak var olur. Bayraksız liste boş döner.
 */
async function listShowIds(documentsBaseUrl, headers) {
  const documents = await listCollection(
    `${documentsBaseUrl}/TvComment`,
    headers,
    "TvComment listeleme",
    // mask: yalnız kimlik lazım, alan yükü taşınmasın. Firestore "__" ile
    // başlayan alan adlarını rezerve sayıp reddettiği için gerçek bir alan adı
    // veriliyor (TvComment/{tvId} zaten çoğunlukla alansız/eksik bir doküman).
    { showMissing: "true", "mask.fieldPaths": "scopeKey" },
  );
  return documents
    .map((document) => String(document.name || "").split("/").pop())
    .filter(Boolean);
}

const needsScope = (document) => !document?.fields?.scopeKey;

function makeWrite(document) {
  const write = {
    update: { name: document.name, fields: { ...SHOW_SCOPE_FIELDS } },
    updateMask: { fieldPaths: [...SCOPE_FIELD_PATHS] },
  };
  // Precondition: aramızda sahibi yorumu düzenleyip gerçek bir sezon/bölüm
  // kapsamı atadıysa yazmayı reddet (yoksa onu "show"a geri ezerdik).
  // Doküman "eksik" (yalnız ata) ise updateTime yoktur — o durumda atlanır.
  if (usePrecondition && document.updateTime) {
    write.currentDocument = { updateTime: document.updateTime };
  }
  return write;
}

async function commitWrites(databaseUrl, headers, writes) {
  const response = await fetch(`${databaseUrl}/documents:commit`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ writes }),
  });
  if (!response.ok) {
    throw new Error(`commit ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
  await response.json();
}

/** Yazılan dokümanları tek tek geri okuyup scopeKey'i doğrular. */
async function verifyWritten(databaseUrl, headers, documentNames) {
  const missing = [];
  for (let i = 0; i < documentNames.length; i += BATCH_GET_SIZE) {
    const chunk = documentNames.slice(i, i + BATCH_GET_SIZE);
    const response = await fetch(`${databaseUrl}/documents:batchGet`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        documents: chunk,
        mask: { fieldPaths: ["scopeKey"] },
      }),
    });
    if (!response.ok) {
      throw new Error(`batchGet ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    for (const entry of await response.json()) {
      if (!entry.found) {
        missing.push({ name: entry.missing, reason: "document-missing" });
      } else if (entry.found.fields?.scopeKey?.stringValue !== "show") {
        missing.push({ name: entry.found.name, reason: "scopeKey-not-written" });
      }
    }
  }
  return missing;
}

async function main() {
  const projectId = loadProjectId();
  const token = await loadFirebaseAccessToken();
  const databaseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;
  const documentsBaseUrl = `${databaseUrl}/documents`;
  const headers = { Authorization: `Bearer ${token}` };

  const showIds = onlyShowId
    ? [onlyShowId]
    : await listShowIds(documentsBaseUrl, headers);
  console.log(
    `Proje: ${projectId} · dizi sayısı: ${showIds.length}` +
      (onlyShowId ? " (tek dizi kipi)" : ""),
  );

  const pending = []; // yazılacak dokümanlar
  const summary = {
    shows: showIds.length,
    comments: 0,
    replies: 0,
    commentsToWrite: 0,
    repliesToWrite: 0,
    alreadyScoped: 0,
  };
  const perShow = [];

  let scanned = 0;
  await mapWithConcurrency(showIds, LIST_CONCURRENCY, async (showId) => {
    const comments = await listCollection(
      `${documentsBaseUrl}/TvComment/${encodeURIComponent(showId)}/comments`,
      headers,
      `comments listeleme (${showId})`,
    );

    // Yanıtlar üst yorum başına ayrı alt koleksiyonda. replyCount'a GÜVENİLMEZ:
    // addDoc başarılı olup sayaç artışı reddedilmiş olabilir (Comment.js'te bu
    // yol tek try içinde), yani 0 sayaçlı yorumun da yanıtı olabilir.
    const replyLists = await mapWithConcurrency(comments, 4, (comment) =>
      listCollection(
        `${documentsBaseUrl}/${comment.name.split("/documents/")[1]}/replies`,
        headers,
        `replies listeleme (${showId})`,
      ),
    );

    const replies = replyLists.flat();
    const commentsNeeding = comments.filter(needsScope);
    const repliesNeeding = replies.filter(needsScope);

    summary.comments += comments.length;
    summary.replies += replies.length;
    summary.commentsToWrite += commentsNeeding.length;
    summary.repliesToWrite += repliesNeeding.length;
    summary.alreadyScoped +=
      comments.length + replies.length - commentsNeeding.length - repliesNeeding.length;

    pending.push(...commentsNeeding, ...repliesNeeding);
    if (commentsNeeding.length + repliesNeeding.length > 0) {
      perShow.push({
        showId,
        comments: commentsNeeding.length,
        replies: repliesNeeding.length,
      });
    }

    scanned += 1;
    if (scanned % 25 === 0 || scanned === showIds.length) {
      process.stdout.write(`Tarama: ${scanned}/${showIds.length} dizi\n`);
    }
  });

  perShow.sort((a, b) => b.comments + b.replies - (a.comments + a.replies));

  console.log(
    JSON.stringify(
      {
        mode: applyChanges ? "apply" : "dry-run",
        precondition: usePrecondition,
        ...summary,
        totalWrites: pending.length,
      },
      null,
      2,
    ),
  );
  if (perShow.length > 0) {
    console.log("Etkilenen diziler (ilk 15):");
    console.log(JSON.stringify(perShow.slice(0, 15), null, 2));
    if (perShow.length > 15) console.log(`... ve ${perShow.length - 15} dizi daha.`);
  }

  if (pending.length === 0) {
    console.log("Kapsam alanı eksik doküman yok — yapılacak bir şey kalmadı.");
    return;
  }
  if (!applyChanges) {
    console.log("Yazma yapılmadı. Uygulamak için --apply kullanın.");
    return;
  }

  // Yedek: geri almak için bu dosyadaki isimlere BOŞ fields + aynı updateMask
  // ile commit atmak yeterlidir (updateMask'teki alanlar silinir).
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(os.tmpdir(), `seelogd-comment-scope-${stamp}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        projectId,
        fieldPaths: SCOPE_FIELD_PATHS,
        note:
          "Geri alma: aşağıdaki her documentName için fields:{} ve aynı updateMask ile commit atın.",
        documents: pending.map((document) => ({
          name: document.name,
          updateTime: document.updateTime || null,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`Yedek oluşturuldu: ${backupPath}`);

  const chunks = [];
  for (let i = 0; i < pending.length; i += MAX_COMMIT_WRITES) {
    chunks.push(pending.slice(i, i + MAX_COMMIT_WRITES));
  }

  const failedChunks = [];
  let written = 0;
  for (const [index, chunk] of chunks.entries()) {
    try {
      await commitWrites(databaseUrl, headers, chunk.map(makeWrite));
      written += chunk.length;
    } catch (error) {
      // Commit atomiktir: precondition tek dokümanda düşse bütün parça geri
      // alınır. Diğer parçalar yine de işlensin; script yeniden çalıştırıldığında
      // yazılmış dokümanlar atlanacağı için düşen parça kendiliğinden toparlanır.
      failedChunks.push({ index, size: chunk.length, error: error.message });
    }
    process.stdout.write(`Yazma: ${index + 1}/${chunks.length} parça\n`);
  }

  const mismatches = await verifyWritten(
    databaseUrl,
    headers,
    pending.map((document) => document.name),
  );

  console.log(
    JSON.stringify(
      {
        attempted: pending.length,
        committed: written,
        failedChunks: failedChunks.length,
        unverified: mismatches.length,
      },
      null,
      2,
    ),
  );
  if (failedChunks.length > 0) {
    console.log("Başarısız parçalar:");
    console.log(JSON.stringify(failedChunks, null, 2));
  }
  if (mismatches.length > 0) {
    console.log("Doğrulanamayan dokümanlar (ilk 10):");
    console.log(JSON.stringify(mismatches.slice(0, 10), null, 2));
    throw new Error(
      `${mismatches.length} doküman doğrulanamadı — scripti tekrar çalıştırın.`,
    );
  }
  console.log(`Doğrulama başarılı: ${written} doküman kapsam alanlarını aldı.`);
  console.log(`Yedek: ${backupPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
