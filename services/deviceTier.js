// services/deviceTier.js
//
// utils/deviceTier.js'teki saf karar tablosunu native sabitlerle besleyen ince
// sarmalayıcı. expo-device alanlarının hepsi SENKRON sabittir (native modül
// başlarken okunur), bu yüzden değer modül yüklenirken bir kez hesaplanır —
// hook/state gerekmez, render sırasında bedava okunur.
import { Platform } from "react-native";
import * as Device from "expo-device";
import { resolveDeviceTier, getTierPreset } from "../utils/deviceTier";

const osMajorVersion = (() => {
  // Android'de Platform.Version sayı, iOS'ta "17.4" gibi string gelir.
  const raw = Platform.Version ?? Device.osVersion;
  const major = parseInt(String(raw), 10);
  return Number.isNaN(major) ? null : major;
})();

// GELİŞTİRME KOLAYLIĞI: emülatör her zaman "high" döndüğü (ve geliştiricinin
// telefonu genelde mid/high olduğu) için düşük katman görünümü normalde hiç
// görülemez. Düşük katmanı denemek için burayı geçici olarak "low" yapın.
// Yalnız __DEV__'de dikkate alınır — sürüm derlemesinde etkisizdir.
const DEV_TIER_OVERRIDE = null; // "low" | "mid" | "high" | null

const detectedTier = resolveDeviceTier({
  totalMemoryBytes: Device.totalMemory ?? null,
  deviceYearClass: Device.deviceYearClass ?? null,
  osMajorVersion,
  platform: Platform.OS,
  // Device.isDevice sadece gerçek cihazda true; emülatörde efektleri kısmıyoruz
  // ki geliştirme sırasında görsel fark oluşmasın.
  isDevice: Device.isDevice !== false,
});

export const deviceTier =
  __DEV__ && DEV_TIER_OVERRIDE ? DEV_TIER_OVERRIDE : detectedTier;

// Katmanın önerdiği bütçe. UYGULANAN bütçe artık burada DEĞİL: kullanıcı
// Ayarlar'dan efekt modunu seçebiliyor ve modül yüklenirken dondurulmuş bir
// nesne o seçimi göremez. Bileşenler `useEffectPreset()` kullanır
// (bkz. services/effectSettings.js); bu değer yalnız varsayılanın ne olduğunu
// söyler (teşhis/analitik).
export const perfPreset = getTierPreset(deviceTier);

export default perfPreset;
