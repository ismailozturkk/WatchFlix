// Uyarı/onay kutularının saf mantığı (utils/alertPresentation.js) + kaynak bekçisi.
//
// Arka plan: appAlert kökte ayrı bir native pencere; iOS başka bir Modal açıkken
// onu sunamaz, AppAlertHost "görünür" sanıp takılırdı. Modal içinden sorular
// useInlineConfirm ile pencerenin İÇİNDE çizilir; kaçan olursa sunum bekçisi
// kuyruğu serbest bırakır. Bkz. memory/ios-modal-sequencing.md.

const fs = require("fs");
const path = require("path");
import {
  ALERT_TYPES,
  alertButtonsToActions,
  backdropBehavior,
  createPresentWatchdog,
  resolveAlertType,
} from "../utils/alertPresentation";

describe("resolveAlertType", () => {
  test("açık tür önceliklidir, bilinmeyen tür yok sayılır", () => {
    expect(resolveAlertType({ type: "success" }, [])).toBe("success");
    expect(resolveAlertType({ type: "nope" }, [{ text: "A" }])).toBe("info");
  });

  test("destructive → warning, 2+ düğme → confirm, aksi halde info", () => {
    expect(resolveAlertType({}, [{ text: "Sil", style: "destructive" }])).toBe("warning");
    expect(resolveAlertType({}, [{ text: "A" }, { text: "B" }])).toBe("confirm");
    expect(resolveAlertType(undefined, [{ text: "A" }])).toBe("info");
    expect(resolveAlertType(undefined, undefined)).toBe("info");
  });

  test("her türün ikonu ve degradesi var", () => {
    for (const meta of Object.values(ALERT_TYPES)) {
      expect(typeof meta.icon).toBe("string");
      expect(meta.gradient).toHaveLength(2);
    }
  });
});

describe("alertButtonsToActions", () => {
  test("sıra korunur, stil tona çevrilir", () => {
    const edit = jest.fn();
    const del = jest.fn();
    const actions = alertButtonsToActions(
      [
        { text: "Düzenle", onPress: edit },
        { text: "Sil", style: "destructive", onPress: del },
        { text: "İptal", style: "cancel" },
      ],
      "Tamam",
    );
    expect(actions.map((a) => [a.label, a.tone, a.cancel])).toEqual([
      ["Düzenle", "primary", false],
      ["Sil", "danger", false],
      ["İptal", "neutral", true],
    ]);
    expect(actions[0].onPress).toBe(edit);
    expect(actions[2].onPress).toBeUndefined();
    expect(new Set(actions.map((a) => a.key)).size).toBe(3);
  });

  test("düğme yoksa tek 'Tamam' düğmesi", () => {
    expect(alertButtonsToActions(undefined, "Tamam")).toEqual([
      { key: "0-Tamam", label: "Tamam", tone: "primary", onPress: undefined, cancel: false },
    ]);
    expect(alertButtonsToActions([], "OK")[0].label).toBe("OK");
  });
});

describe("backdropBehavior", () => {
  const cancelCb = jest.fn();
  const actions = alertButtonsToActions(
    [
      { text: "İptal", style: "cancel", onPress: cancelCb },
      { text: "Çıkar", style: "destructive" },
    ],
    "Tamam",
  );

  test("boşluk/geri tuşu iptal düğmesinin callback'ini çalıştırır", () => {
    expect(backdropBehavior(actions, {})).toEqual({ onPress: cancelCb });
  });

  test("iptal düğmesi yoksa yalnız kapanır", () => {
    const only = alertButtonsToActions([{ text: "Tamam" }], "Tamam");
    expect(backdropBehavior(only, undefined)).toEqual({ onPress: undefined });
  });

  test("cancelable:false → boşluk hiçbir şey yapmaz", () => {
    expect(backdropBehavior(actions, { cancelable: false })).toBeNull();
  });
});

describe("createPresentWatchdog", () => {
  const fakeClock = () => {
    const timers = new Map();
    let id = 0;
    return {
      schedule: (fn, ms) => {
        id += 1;
        timers.set(id, { fn, ms });
        return id;
      },
      cancel: (t) => timers.delete(t),
      fireAll: () => {
        const list = [...timers.values()];
        timers.clear();
        list.forEach((t) => t.fn());
      },
      size: () => timers.size,
      timers,
    };
  };

  test("onShow gelmezse süre sonunda bir kez tetiklenir", () => {
    const clock = fakeClock();
    const onTimeout = jest.fn();
    const w = createPresentWatchdog({ timeoutMs: 2000, onTimeout, ...clock });
    w.arm();
    expect([...clock.timers.values()][0].ms).toBe(2000);
    expect(w.pending).toBe(true);
    clock.fireAll();
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(w.pending).toBe(false);
  });

  test("onShow gelirse tetiklenmez", () => {
    const clock = fakeClock();
    const onTimeout = jest.fn();
    const w = createPresentWatchdog({ timeoutMs: 2000, onTimeout, ...clock });
    w.arm();
    w.confirm();
    expect(clock.size()).toBe(0);
    clock.fireAll();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  test("zamanlayıcı confirm'den SONRA kaçsa bile (iptal yarışı) tetiklenmez", () => {
    const clock = fakeClock();
    const onTimeout = jest.fn();
    // cancel hiçbir şey yapmasın: zamanlayıcı yine de çalışır.
    const w = createPresentWatchdog({
      timeoutMs: 2000,
      onTimeout,
      schedule: clock.schedule,
      cancel: () => {},
    });
    w.arm();
    w.confirm();
    clock.fireAll();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  test("disarm bekleyeni iptal eder; yeniden arm önceki bekleyeni siler", () => {
    const clock = fakeClock();
    const onTimeout = jest.fn();
    const w = createPresentWatchdog({ timeoutMs: 2000, onTimeout, ...clock });
    w.arm();
    w.disarm();
    clock.fireAll();
    expect(onTimeout).not.toHaveBeenCalled();

    w.arm();
    w.arm();
    expect(clock.size()).toBe(1);
    clock.fireAll();
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  test("önceki kutu gösterildiyse yeni arm 'gösterildi' bayrağını sıfırlar", () => {
    const clock = fakeClock();
    const onTimeout = jest.fn();
    const w = createPresentWatchdog({ timeoutMs: 2000, onTimeout, ...clock });
    w.arm();
    w.confirm();
    w.arm(); // sıradaki kutu; bu sefer sunulamadı
    clock.fireAll();
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });
});

// Kendi native Modal'ı AÇIKKEN soru soran bileşenler appAlert'e dönmesin.
describe("modal içi sorular appAlert kullanmaz", () => {
  const ROOT = path.join(__dirname, "..");
  const FILES = [
    "components/CacheManagerModal.js",
    "components/modals/ChatModal.js",
    "components/modals/PostCommentSheetModal.js",
    "components/chat/GroupInfoModal.js",
    "components/modals/CreatePostModal.js",
  ];

  test.each(FILES)("%s", (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
    expect(src).not.toMatch(/from\s+["'][^"']*AppAlert["']/);
    expect(src).not.toMatch(/\bappAlert\s*\(/);
  });
});
