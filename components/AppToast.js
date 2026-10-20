// components/AppToast.js
//
// Uygulama genelinde TEK toast API'si. Eskiden react-native-toast-message üzerine ince
// bir katmandı; şimdi kendi motorumuz var (utils/toastStore.js: kuyruk, öncelik, yineleme
// sayacı, yerinde güncelleme) ve çizim components/toast/* içinde (Reanimated, UI iş
// parçacığı). Bu dosya yalnız API + yan etkiler (titreşim, ekran okuyucu); hafif tutuldu —
// çizim bileşenleri burada İÇE AKTARILMAZ, yoksa toast gösteren her saf modül Reanimated'i
// ve SVG'yi de yüklerdi.
//
// KURULUM (bir kez):
//   App.js        <ToastHost />                      (kök)
//   Modal içleri  <ToastHost scoped enabled={visible} />
//                 BottomSheetModal bunu KENDİSİ yapar; çıplak <Modal> kullanan ekran
//                 <ModalToastHost visible={...} /> eklemeli (components/toast/ModalToastHost.js).
//
// KULLANIM:
//   import { toast } from "@components/AppToast";
//   toast.success("Kaydedildi", "Değişiklikler uygulandı");
//   toast.error("Hata", error);                      // Error nesnesi de olur
//   toast.warning("Depolama dolmak üzere");
//   toast.info("Bilgi");
//   toast.undo("Hatırlatma kaldırıldı", () => geriYaz());   // "Geri Al" düğmeli, 6 sn
//   toast.premium("Premium aktif", "Tüm ayrıcalıklar açıldı");
//   toast.badge("Yeni rozet", "Kâşif", { gorunum, ek, ipucu }, { onPress });
//
//   // Uzun iş: tek kartta yükleniyor → sonuç
//   const id = toast.loading("Yedek alınıyor");
//   toast.update(id, { kind: "success", title: "Yedek alındı" });
//   await toast.promise(yukle(), { loading: "Yükleniyor", success: "Bitti", error: "Olmadı" });
//
// ESKİ İMZA da çalışır (react-native-toast-message ile aynı):
//   import Toast from "@components/AppToast";
//   Toast.show({ type: "error", text1: "Başlık", text2: "Mesaj", visibilityTime, onPress, props: { action } });
//   Toast.hide();

import { AccessibilityInfo, Platform } from "react-native";
import { toastStore } from "../utils/toastStore";
import { triggerHaptic } from "../services/hapticsService";
import { i18nText } from "../utils/i18nText";

// ── Yan etkiler ──────────────────────────────────────────────────────────────
// Bir toast SIRA ALDIĞINDA tam bir kez: titreşim (hata/uyarı/kutlama; başarı yalnız
// `haptic: true` ile — çağıranların çoğu zaten kendi başarı titreşimini verir ve
// titreşim kısması (hapticsService) çift vuruşu tek vuruşa indirir) ve iOS ekran
// okuyucu duyurusu (Android'de kartın `accessibilityLiveRegion`ı yeter).
let installed = false;
function installEffects() {
  if (installed) return;
  installed = true;
  toastStore.setEffects({
    onPresent(item) {
      if (item.haptic) triggerHaptic(item.haptic);
      if (Platform.OS === "ios") {
        AccessibilityInfo.announceForAccessibility?.([item.title, item.message].filter(Boolean).join(". "));
      }
    },
  });
  // Ekran okuyucu açıkken süreler iki katına çıkar (okuma + sesli duyuru + hedefe ulaşma).
  try {
    AccessibilityInfo.isScreenReaderEnabled?.()
      .then((on) => toastStore.setDurationScale(on ? 2 : 1))
      .catch(() => {});
    AccessibilityInfo.addEventListener?.("screenReaderChanged", (on) =>
      toastStore.setDurationScale(on ? 2 : 1),
    );
  } catch {
    // Erişilebilirlik modülü yoksa (test ortamı) sessizce varsayılan süre.
  }
}
installEffects();

// ── API ──────────────────────────────────────────────────────────────────────
/** Tek giriş noktası: yeni (`kind/title/message`) ya da eski (`type/text1/text2`) imza. @returns {string|null} toast kimliği */
export const showToast = (options) => toastStore.show(options);

const byKind = (kind) => (title, message, opts) => toastStore.show({ ...opts, kind, title, message });

function toSpec(value) {
  if (value == null) return null;
  if (typeof value === "string") return { title: value };
  return value;
}

export const toast = {
  show: showToast,
  success: byKind("success"),
  error: byKind("error"),
  warning: byKind("warning"),
  info: byKind("info"),
  premium: byKind("premium"),
  /** Kalıcı "yükleniyor" kartı; kimliğiyle `update` edilir ya da `hide` edilir. */
  loading: byKind("loading"),
  /**
   * Rozet / ödül kutlaması: ödülün kendi rozetini çizer. `props`: { gorunum, ek?, ipucu? }
   * (components/toast/ToastCards.js BadgeCard). Normal toast'tan uzun kalır.
   */
  badge: (title, message, props, opts) =>
    toastStore.show({ ...opts, kind: "badge", title, message, props }),
  /** "Geri Al" düğmeli bilgi/başarı toast'ı (en az 6 sn). */
  undo: (title, onUndo, opts) =>
    toastStore.show({
      kind: "info",
      ...opts,
      title,
      action: {
        label: i18nText("autoI18n.geri_al", "Geri Al"),
        icon: "arrow-undo",
        onPress: onUndo,
      },
    }),
  /** Görünen ya da sırada bekleyen toast'ı yerinde değiştirir (yoksa yeni açar). */
  update: (id, patch) => toastStore.update(id, patch),
  /**
   * Bir işi izler: `loading` kartı gösterir, bitince AYNI kartı başarıya/hataya çevirir.
   * Her alan dizge ya da `(değer|hata) => dizge | { title, message }` olabilir; verilmeyen
   * sonuç için kart sessizce kapanır. Promise sonucu/hatası aynen geçer.
   */
  promise: (work, texts = {}, opts) => {
    const resolve = (spec, arg) => toSpec(typeof spec === "function" ? spec(arg) : spec);
    const loadingSpec = resolve(texts.loading);
    const id = loadingSpec ? toastStore.show({ ...opts, ...loadingSpec, kind: "loading" }) : null;
    const settle = (kind, spec) => {
      if (spec && (spec.title || spec.message)) {
        const next = { ...opts, ...spec, kind };
        if (id != null) toastStore.update(id, next);
        else toastStore.show(next);
      } else if (id != null) {
        toastStore.dismiss(id, "api");
      }
    };
    return Promise.resolve(work).then(
      (value) => {
        settle("success", resolve(texts.success, value));
        return value;
      },
      (error) => {
        settle("error", resolve(texts.error, error));
        throw error;
      },
    );
  },
  /** Görünen toast'ı (ya da `id`liyi) kapatır. */
  // `onPress={toast.hide}` gibi olay nesnesi geçen çağrılar tüm toast'ı kapatır, kimlik sanılmaz.
  hide: (id) => toastStore.dismiss(typeof id === "string" ? id : undefined, "api"),
  /** Görünen ve bekleyen her şeyi kaldırır. */
  clear: () => toastStore.clear(),
};

export default toast;
