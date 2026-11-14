// services/libraryImportService.js
//
// Kütüphaneni İçe Aktar — dosya seçimi + geri yükleme işi. Biçim ve doğrulama utils/libraryImport.js'te (saf).
//
// İş üç aşamalıdır ve KALDIĞI YERDEN sürer (bağlantı koparsa / kullanıcı durdurursa aynı `job` ile yeniden çağrılır):
//   1) Kütüphane: services/import/importRunner (Letterboxd/IMDb aktarımıyla AYNI sağlam hat: eşleştirme → kayıt →
//      özel listeler → profil özeti; geçici hatada geri çekilip yeniden dener, tek kaydın kalıcı hatası işi durdurmaz).
//      Seelogd kayıtları TMDB kimliği taşıdığından eşleştirme kesindir; v2 dosyada afiş de olduğu için ağa gidilmez.
//   2) Yorumlar: services/libraryCommentsIO.restoreTitleComments (özgün kimlikle; idempotent).
//   3) Bitti: özet.
// Hiçbir aşama mevcut veriyi silmez ya da ezmez (birleştirme kuralları: services/import/importMerge.js).

import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { createImportJob, runImportJob } from "./import/importRunner";
import { restoreTitleComments } from "./libraryCommentsIO";
import { MAX_IMPORT_CHARS, buildImportPlan, parseLibraryBackup } from "../utils/libraryImport";

/**
 * Sistem dosya seçicisinden yedek JSON'u seçtirir ve doğrular. ASLA fırlatmaz.
 * @returns {Promise<{ ok: true, backup, counts, invalid, fileName } | { ok: false, cancelled?: true, error?: string }>}
 */
export async function pickLibraryBackup() {
  let picked;
  try {
    picked = await DocumentPicker.getDocumentAsync({
      type: ["application/json", "text/plain", "*/*"],
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch {
    return { ok: false, error: "read-failed" };
  }
  if (!picked || picked.canceled) return { ok: false, cancelled: true };
  const asset = picked.assets?.[0];
  if (!asset?.uri) return { ok: false, error: "read-failed" };
  const name = String(asset.name || "");
  if (/\.zip$/i.test(name)) return { ok: false, error: "zip" };
  if (/\.csv$/i.test(name)) return { ok: false, error: "csv" };
  if (typeof asset.size === "number" && asset.size > MAX_IMPORT_CHARS) return { ok: false, error: "too-large" };
  let text;
  try {
    text = await new File(asset.uri).text();
  } catch {
    return { ok: false, error: "read-failed" };
  }
  return { ...parseLibraryBackup(text), fileName: name || null };
}

/**
 * @param {{ uid: string, backup: object, sections: string[], userProfile?: object, language?: string }} input
 */
export function createLibraryRestoreJob({ uid, backup, sections, userProfile = {}, language }) {
  const plan = buildImportPlan(backup, sections);
  return {
    uid,
    plan,
    userProfile,
    library: plan.items.length ? createImportJob({ uid, items: plan.items, userProfile, language }) : null,
    libraryResult: null,
    commentsDone: 0,
    commentStats: { added: 0, existing: 0, duplicate: 0, failed: 0 },
    finished: false,
  };
}

const addStats = (target, stats) => {
  Object.keys(target).forEach((key) => {
    target[key] += Number(stats?.[key]) || 0;
  });
};

/**
 * İşi yürütür ya da kaldığı yerden sürdürür. Kesintide `ImportError` fırlatır (code: cancelled | network |
 * tmdbUnavailable | saveInterrupted); yazılanlar korunur.
 * onEvent: { type: "stage", stage: "matching"|"saving"|"lists"|"finalizing"|"comments", total?, done? }
 *          { type: "match"|"save"|"list"|"comment", done, total }
 */
export async function runLibraryRestore(job, { signal, onEvent } = {}) {
  const emit = (event) => onEvent?.(event);

  if (job.library && !job.libraryResult) {
    job.libraryResult = await runImportJob(job.library, { signal, onEvent: emit, concurrency: 6 });
  }

  const comments = job.plan.comments;
  if (job.commentsDone < comments.length) {
    const offset = job.commentsDone;
    emit({ type: "stage", stage: "comments", total: comments.length, done: offset });
    try {
      const stats = await restoreTitleComments(job.uid, comments.slice(offset), {
        userProfile: job.userProfile,
        signal,
        onProgress: (done) => emit({ type: "comment", done: offset + done, total: comments.length }),
      });
      addStats(job.commentStats, stats);
      job.commentsDone = comments.length;
    } catch (error) {
      addStats(job.commentStats, error?.stats);
      job.commentsDone = offset + (Number(error?.processed) || 0);
      throw error;
    }
  }

  job.finished = true;
  emit({ type: "stage", stage: "done" });
  return restoreSummary(job);
}

/** Bitiş ekranının özeti. */
export function restoreSummary(job) {
  const r = job.libraryResult || {};
  return {
    titles: Number(r.count) || 0,
    watchEvents: Number(r.addedWatchEventsCount) || 0,
    ratings: Number(r.ratingsCount) || 0,
    lists: Number(r.customListsCount) || 0,
    listItems: Number(r.customListItemsCount) || 0,
    unchanged: Number(r.unchangedCount) || 0,
    preservedRatings: Number(r.preservedRatingsCount) || 0,
    failed: (Number(r.failedCount) || 0) + (Number(r.unmatchedCount) || 0) + (Number(r.failedMatchCount) || 0) + job.commentStats.failed,
    comments: job.commentStats.added,
    commentsKept: job.commentStats.existing + job.commentStats.duplicate,
    skippedReplies: job.plan.skipped.replies,
    skippedRatings: job.plan.skipped.orphanRatings,
    posters: Array.isArray(r.posters) ? r.posters : [],
  };
}
