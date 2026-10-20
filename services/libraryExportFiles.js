// services/libraryExportFiles.js
//
// Kütüphane dışa aktarmasının PLATFORM G/Ç'si: dosyaya yaz + sistem paylaşım sayfası. Biçim ve içerik
// utils/libraryExport.js'te (saf). Hata sözleşmesi services/settingsBackupFiles.js ile aynı: ASLA fırlatmaz,
// `{ ok: false, error: <kod> }` döner; ekran kodu metne çevirir.
//
// Hata kodları: empty | write-failed | zip-failed | sharing-unavailable.
//
// Dosya önbellek klasörüne yazılır (kalıcı değil): paylaşım sayfası kopyayı alır, sistem önbelleği temizler.
// Aynı adlı eski dosya silinip yeniden yazılır.

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import JSZip from "jszip";
import {
  buildCsvBundle,
  buildLibrarySnapshot,
  exportFileName,
  isSnapshotEmpty,
  serializeSnapshot,
} from "../utils/libraryExport";

const appMeta = () => ({
  appVersion: Constants?.expoConfig?.version ?? null,
  platform: Platform.OS,
});

/** Listelerden anlık görüntüyü kurar (ekran önizleme sayıları için de kullanır). */
export const snapshotFromLibrary = (input) => buildLibrarySnapshot(input, appMeta());

function writeCacheFile(name, content) {
  const file = new File(Paths.cache, name);
  // utils/cacheStore.js ile aynı kalıp: write() dosyayı kendisi oluşturur.
  if (file.exists) file.delete();
  file.write(content);
  return file;
}

async function share(file, { mimeType, UTI, dialogTitle }) {
  try {
    if (!(await Sharing.isAvailableAsync())) return { ok: false, error: "sharing-unavailable" };
    await Sharing.shareAsync(file.uri, { mimeType, UTI, dialogTitle });
    return { ok: true };
  } catch {
    return { ok: false, error: "sharing-unavailable" };
  }
}

/** Tam yedek: tek JSON dosyası. */
export async function exportLibraryJson(snapshot, { dialogTitle } = {}) {
  if (isSnapshotEmpty(snapshot)) return { ok: false, error: "empty" };
  const fileName = exportFileName("json");
  let file;
  try {
    file = writeCacheFile(fileName, serializeSnapshot(snapshot));
  } catch {
    return { ok: false, error: "write-failed" };
  }
  const shared = await share(file, { mimeType: "application/json", UTI: "public.json", dialogTitle });
  return shared.ok ? { ok: true, fileName } : shared;
}

/** library.csv + Letterboxd CSV'leri + README.txt: tek ZIP. */
export async function exportLibraryZip(snapshot, { dialogTitle, readme = "" } = {}) {
  if (isSnapshotEmpty(snapshot)) return { ok: false, error: "empty" };
  const fileName = exportFileName("zip");
  let bytes;
  try {
    const zip = new JSZip();
    for (const { name, text } of buildCsvBundle(snapshot, { readme })) zip.file(name, text);
    bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  } catch {
    return { ok: false, error: "zip-failed" };
  }
  let file;
  try {
    file = writeCacheFile(fileName, bytes);
  } catch {
    return { ok: false, error: "write-failed" };
  }
  const shared = await share(file, { mimeType: "application/zip", UTI: "public.zip-archive", dialogTitle });
  return shared.ok ? { ok: true, fileName } : shared;
}
