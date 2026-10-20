// services/settingsBackupFiles.js
//
// Ayarlar yedeğinin PLATFORM G/Ç'si: dosyaya yaz + paylaşım sayfası, panoya kopyala,
// dosya seç, panodan oku. Biçim/doğrulama utils/settingsBackup.js'te, depolama
// services/settingsBackupService.js'te. Hata sözleşmesi: ASLA fırlatmaz,
// `{ ok: false, error: <kod> }` döner; ekran kodu metne çevirir.
//
// Hata kodları: sharing-unavailable | write-failed | clipboard-failed | read-failed |
// (parseBackup'ın) empty | too-large | not-json | not-backup | too-new.

import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import {
  MAX_BACKUP_CHARS,
  backupFileName,
  parseBackup,
  serializeBackup,
} from "../utils/settingsBackup";
import { collectCurrentBackup } from "./settingsBackupService";

const appMeta = () => ({
  appVersion: Constants?.expoConfig?.version ?? null,
  platform: Platform.OS,
});

/** Dosya olarak yazar ve sistem paylaşım sayfasını açar ("Dosyalara kaydet" dahil). */
export async function exportToFile({ dialogTitle } = {}) {
  let file;
  let fileName;
  try {
    fileName = backupFileName();
    const text = serializeBackup(collectCurrentBackup(appMeta()));
    file = new File(Paths.cache, fileName);
    // utils/cacheStore.js ile aynı kalıp: write() dosyayı kendisi oluşturur.
    if (file.exists) file.delete();
    file.write(text);
  } catch {
    return { ok: false, error: "write-failed" };
  }

  try {
    if (!(await Sharing.isAvailableAsync())) return { ok: false, error: "sharing-unavailable" };
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      UTI: "public.json",
      dialogTitle,
    });
    return { ok: true, fileName };
  } catch {
    return { ok: false, error: "sharing-unavailable" };
  }
}

/** Yedek metnini panoya kopyalar (dosya paylaşamayan ya da hızlı aktarmak isteyen için). */
export async function exportToClipboard() {
  try {
    await Clipboard.setStringAsync(serializeBackup(collectCurrentBackup(appMeta())));
    return { ok: true };
  } catch {
    return { ok: false, error: "clipboard-failed" };
  }
}

/** Sistem dosya seçicisinden bir yedek dosyası seçtirir ve ayrıştırır. */
export async function pickBackupFile() {
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
  // Dosyayı belleğe almadan önce boyut: devasa bir dosya seçilirse uygulama donmasın.
  if (typeof asset.size === "number" && asset.size > MAX_BACKUP_CHARS * 4) {
    return { ok: false, error: "too-large" };
  }
  let text;
  try {
    text = new File(asset.uri).textSync();
  } catch {
    return { ok: false, error: "read-failed" };
  }
  return { ...parseBackup(text), fileName: asset.name || null };
}

/** Panodaki metni yedek olarak ayrıştırır. */
export async function readClipboardBackup() {
  let text;
  try {
    text = await Clipboard.getStringAsync();
  } catch {
    return { ok: false, error: "clipboard-failed" };
  }
  return parseBackup(text);
}
