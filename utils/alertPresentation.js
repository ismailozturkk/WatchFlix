// utils/alertPresentation.js
//
// Uyarı/onay kutularının SAF mantığı — iki çizim yolu aynı kuralı paylaşsın diye:
//   • components/AppAlert.js          → kökteki AppAlertHost (ayrı native pencere)
//   • hooks/useInlineConfirm.js        → açık bir Modal'ın İÇİNDE çizilen katman
//
// NEDEN İKİ YOL: iOS, başka bir native Modal açıkken kökten ikinci bir pencere
// sunamaz (UIKit "already presenting" der, pencere hiç çizilmez ama React onu
// açık sanır). Modal içinden soru sorulacaksa appAlert değil useInlineConfirm
// kullanılır. Bkz. memory/ios-modal-sequencing.md, components/common/BottomSheetModal.js.

// Tür → ikon + vurgu geçişi. 'confirm' rengi çizimde theme.accent olur.
export const ALERT_TYPES = {
  info: {
    icon: "information-circle-outline",
    gradient: ["#60A5FA", "#2563EB"],
  },
  success: {
    icon: "checkmark-circle-outline",
    gradient: ["#4ADE80", "#16A34A"],
  },
  warning: {
    icon: "warning-outline",
    gradient: ["#FBBF24", "#F97316"],
  },
  error: {
    icon: "alert-circle-outline",
    gradient: ["#F87171", "#DC2626"],
  },
  confirm: {
    icon: "help-circle-outline",
    gradient: ["#8B5CF6", "#6D5DFB"],
  },
};

// options.type açıkça verilmişse onu kullan; yoksa butonlardan çıkar:
// destructive varsa 'warning', 2+ buton varsa 'confirm', aksi halde 'info'.
export function resolveAlertType(options, buttons) {
  if (options?.type && ALERT_TYPES[options.type]) return options.type;
  const list = Array.isArray(buttons) ? buttons : [];
  if (list.some((b) => b?.style === "destructive")) return "warning";
  if (list.length >= 2) return "confirm";
  return "info";
}

/**
 * Alert.alert biçimindeki düğmeleri katman eylemlerine çevirir.
 * Sıra korunur. style: cancel → "neutral", destructive → "danger", diğer → "primary".
 * Düğme yoksa tek bir `fallbackLabel` düğmesi ("Tamam") üretilir.
 *
 * @param {Array<{text:string,onPress?:Function,style?:string}>} [buttons]
 * @param {string} fallbackLabel
 * @returns {Array<{key:string,label:string,tone:"primary"|"danger"|"neutral",onPress?:Function,cancel:boolean}>}
 */
export function alertButtonsToActions(buttons, fallbackLabel) {
  const list =
    Array.isArray(buttons) && buttons.length ? buttons : [{ text: fallbackLabel }];
  return list.map((b, i) => {
    const cancel = b?.style === "cancel";
    const tone = cancel ? "neutral" : b?.style === "destructive" ? "danger" : "primary";
    return {
      key: `${i}-${b?.text ?? ""}`,
      label: b?.text ?? "",
      tone,
      onPress: typeof b?.onPress === "function" ? b.onPress : undefined,
      cancel,
    };
  });
}

/**
 * Boşluğa dokunma / geri tuşu ne yapar? Alert.alert ile aynı: `cancelable:false`
 * ise hiçbir şey (null), aksi halde kapatılır ve varsa "cancel" düğmesinin
 * callback'i çalışır.
 * @returns {null | { onPress?: Function }}
 */
export function backdropBehavior(actions, options) {
  if (options?.cancelable === false) return null;
  const cancel = (actions || []).find((a) => a.cancel);
  return { onPress: cancel?.onPress };
}

/**
 * Sunum bekçisi: pencere sunumu istendikten sonra `timeoutMs` içinde "göründü"
 * sinyali (Modal onShow) gelmezse `onTimeout` bir kez çağrılır.
 *
 * NEDEN: iOS'ta sunum sessizce başarısız olursa (başka Modal açık) AppAlertHost
 * kutuyu açık sanar ve sonraki tüm uyarılar kuyrukta takılır. Bekçi kuyruğu
 * serbest bırakır; görünmeyen kutu düşer.
 *
 * Yanlış alarm değerlendirmesi: onShow, native sunumun tamamlanma bloğundan
 * gelir; JS meşgul olsa bile olay zamanlayıcıdan ÖNCE kuyruğa girer (önce o
 * işlenir). Yanlış alarm ancak native sunumun KENDİSİ `timeoutMs`ten uzun
 * sürerse olur — bu yüzden süre cömert tutulur.
 *
 * @param {{ timeoutMs:number, onTimeout:Function, schedule?:Function, cancel?:Function }} opts
 */
export function createPresentWatchdog({
  timeoutMs,
  onTimeout,
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  let timer = null;
  let shown = false;

  const clear = () => {
    if (timer != null) cancel(timer);
    timer = null;
  };

  return {
    /** Yeni bir sunum başladı. Önceki bekleme iptal edilir. */
    arm() {
      clear();
      shown = false;
      timer = schedule(() => {
        timer = null;
        if (!shown) onTimeout();
      }, timeoutMs);
    },
    /** Pencere göründü (onShow). */
    confirm() {
      shown = true;
      clear();
    },
    /** Kutu kapandı / host söküldü. */
    disarm() {
      clear();
    },
    get pending() {
      return timer != null;
    },
  };
}
