// hooks/useFreshPhotoSource.js
//
// Avatar görsel kaynağını, adresi değişmeden yenilenen fotoğrafın (Google
// profil resmi) bilinen son sürümüne bağlar ve vadesi geldiyse arka plan
// denetimini ister. Diğer kaynaklar (hazır avatar, Storage adresi) aynen döner.
// Ayrıntı: utils/photoRevalidation.js.

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  getPhotoVersion,
  requestPhotoCheck,
  subscribePhotoVersions,
} from "../services/photoRevalidation";
import { revalidatedUriOf, withPhotoVersion } from "../utils/photoRevalidation";

/**
 * @param {any} source expo-image kaynağı
 * @param {{maxAgeMs?:number, priority?:boolean}} [options] requestPhotoCheck seçenekleri
 */
export default function useFreshPhotoSource(source, { maxAgeMs, priority = false } = {}) {
  const uri = revalidatedUriOf(source);
  const version = useSyncExternalStore(subscribePhotoVersions, () =>
    uri ? getPhotoVersion(uri) : 0,
  );

  useEffect(() => {
    if (uri) requestPhotoCheck(uri, { ...(maxAgeMs ? { maxAgeMs } : null), priority });
  }, [uri, maxAgeMs, priority]);

  return useMemo(() => withPhotoVersion(source, version), [source, version]);
}
