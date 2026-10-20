// services/settingsBackupService.js
//
// Ayarlar yedeğinin DEPOLAMAYA bağlı kısmı: mevcut ayarları yedek nesnesine
// toplar, içe aktarma planını uygular, geri alma noktasını yönetir.
// Saf kural/biçim/doğrulama utils/settingsBackup.js'te; dosya, pano ve paylaşım
// (platform G/Ç) services/settingsBackupFiles.js'te.
//
// NEDEN YENİDEN BAŞLATMA GEREKİYOR: ayarların bir kısmı (tema, dil, düzen
// tercihleri…) AppSettingsContext/PetContext'e açılışta SENKRON okunup state'e
// alınıyor; depo sonradan değişince bu state'ler izlemiyor. Servislerin çoğu
// (efekt, yazı tipi, simge, titreşim) depoyu zaten dinliyor ama hepsi değil —
// tek doğru yol, yazımdan sonra uygulamayı yeniden yüklemek (bkz. appReload.js).

import { Keys, get, has, remove, set } from "./storage";
import {
  BACKUP_ENTRIES,
  buildBackup,
  parseBackup,
  planImport,
  summarizeBackupContents,
} from "../utils/settingsBackup";

/** Cihazdaki mevcut ayarların yedek nesnesi (kayıtsız anahtarlar `null`). */
export function collectCurrentBackup(meta = {}) {
  return buildBackup((name) => {
    const descriptor = Keys[name];
    return descriptor && has(descriptor) ? get(descriptor) : null;
  }, meta);
}

const currentThemes = () => {
  const list = get(Keys.customThemes);
  return Array.isArray(list) ? list : [];
};

/** İçe aktarmadan ÖNCE kullanıcıya gösterilecek plan (diske yazmaz). */
export function previewImport(backup, { themeMode = "merge" } = {}) {
  return planImport(backup, { currentThemes: currentThemes(), themeMode });
}

/**
 * Planı uygular. Önce geri alma noktası alınır, sonra her ayar yazılır.
 *
 * @param {ReturnType<typeof planImport>} plan
 * @param {{skipRestorePoint?: boolean}} [options]
 * @returns {Promise<{applied: number, failed: number}>}
 */
export async function applyImport(plan, { skipRestorePoint = false } = {}) {
  if (!skipRestorePoint) {
    // Yazılamazsa içe aktarma yine de sürer: geri alma, kullanıcının
    // dosyasındaki ayarları uygulamasını engellememeli.
    set(Keys.settingsRestorePoint, collectCurrentBackup());
  }

  let failed = 0;
  for (const write of plan.writes) {
    const descriptor = Keys[write.key];
    if (!descriptor) {
      failed += 1;
      continue;
    }
    // null → anahtarı siler (varsayılana dön); set bunu zaten böyle yorumlar.
    if (!set(descriptor, write.value)) failed += 1;
  }

  // Widget tercihleri yalnız depoda değil, yerel widget modüllerinde de tutuluyor:
  // depoya yazmak widget'ı güncellemez. Tembel require → bu modül RN'e bağlı kalmasın.
  if (plan.writes.some((w) => w.id === "widgetPreferences")) {
    try {
      // eslint-disable-next-line global-require
      const { syncWidgetPreferences } = require("./widgetPreferencesService");
      await syncWidgetPreferences(get(Keys.widgetPreferences));
    } catch {
      // Widget senkronu başarısızsa açılışta/ayar ekranında yeniden eşitlenir.
    }
  }

  return { applied: plan.writes.length - failed, failed };
}

/* ───────────────────────── Geri alma noktası ───────────────────────── */

/** Son içe aktarmadan önceki ayarların özeti; yoksa null. */
export function getRestorePoint() {
  const point = get(Keys.settingsRestorePoint);
  if (!point) return null;
  const parsed = parseBackup(JSON.stringify(point));
  if (!parsed.ok) return null;
  const { themeCount } = summarizeBackupContents(parsed.backup);
  const saved = BACKUP_ENTRIES.filter((e) => parsed.backup.settings[e.id] != null).length;
  return { createdAt: parsed.backup.createdAt, themeCount, saved };
}

export function clearRestorePoint() {
  remove(Keys.settingsRestorePoint);
}

/**
 * Geri alma noktasını uygular: özel temalar dahil BİREBİR önceki durum
 * ("değiştir" kipi — içe aktarmayla eklenen temalar kalkar). Sonra nokta silinir.
 *
 * @returns {Promise<{ok: boolean, applied?: number, failed?: number}>}
 */
export async function restoreFromRestorePoint() {
  const point = get(Keys.settingsRestorePoint);
  const parsed = point ? parseBackup(JSON.stringify(point)) : { ok: false };
  if (!parsed.ok) return { ok: false };
  const plan = planImport(parsed.backup, { currentThemes: currentThemes(), themeMode: "replace" });
  const result = await applyImport(plan, { skipRestorePoint: true });
  clearRestorePoint();
  return { ok: true, ...result };
}
