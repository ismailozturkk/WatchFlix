// components/toast/ToastHost.js
//
// Toast'ın çizildiği yer. İKİ KULLANIM:
//
//   Kök (App.js, bir kez):         <ToastHost />
//   Native Modal içi (alt sayfa):  <ToastHost scoped enabled={visible} />
//
// NEDEN MODAL İÇİNDE DE: React Native `Modal` (iOS'ta ayrı UIViewController, Android'de ayrı
// pencere) açıkken kökteki toast onun ARKASINDA kalır; yani her alt sayfadan (kaydet, hata,
// panoya kopyala…) verilen toast kullanıcıya hiç görünmezdi. Her Modal kendi host'unu
// `enabled={visible}` ile kaydeder; toast en son kaydolan host'ta çizilir. Sayfa kapanmaya
// başlayınca (visible=false) host kaydını bırakır ve görünen toast kalan süresiyle kökteki
// host'a devredilir — "kaydet + sayfayı kapat + toast göster" akışı toast'ı kaybetmez.
//
// Bileşen yalnız `toastStore` anlık görüntüsüne abone olur ve host'u etkin değilse hiçbir şey
// çizmez; boştayken maliyeti tek bir şeffaf, dokunuş geçiren görünümdür.

import React, { useEffect, useId, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toastStore } from "../../utils/toastStore";
import { ToastItem } from "./ToastItem";

// Güvenli alanın altına bırakılan boşluk (px). Kart çentik/ada altında başlar, durum çubuğuna yapışmaz.
const TOP_GAP = 8;
const MIN_TOP = 12;

/**
 * @param {object} props
 * @param {boolean} [props.scoped=false]   Native Modal içinde mi (RNGH kökü sarılır).
 * @param {boolean} [props.enabled=true]   Kapalıyken host kayıtsızdır (modal gizliyken).
 * @param {number}  [props.topInset]       Üst boşluğu elle ver (durum çubuğu altından başlayan Modal'lar için 0).
 */
export default function ToastHost({ scoped = false, enabled = true, topInset }) {
  const hostId = useId();
  const insets = useSafeAreaInsets();
  const snapshot = useSyncExternalStore(
    toastStore.subscribe,
    toastStore.getSnapshot,
    toastStore.getSnapshot,
  );

  useEffect(() => {
    if (!enabled) return undefined;
    return toastStore.registerHost(hostId);
  }, [enabled, hostId]);

  const toast = enabled && snapshot.hostId === hostId ? snapshot.toast : null;
  const top = (topInset != null ? topInset : Math.max(insets.top, MIN_TOP)) + TOP_GAP;

  // Kap HER ZAMAN çizilir: çıkış animasyonu, öğe kaldırılırken ebeveynin ayakta olmasına bağlı.
  return (
    <View style={styles.root} pointerEvents="box-none" collapsable={false}>
      {toast ? <ToastItem key={toast.id} toast={toast} topInset={top} scoped={scoped} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 9999, elevation: 9999 },
});
