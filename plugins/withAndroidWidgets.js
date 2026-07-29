// Seelogd Android ana ekran widget'ları (Yaklaşanlar / Listelerim / İstatistikler)
// için Expo config plugin'i.
//
// Native kaynak tek yerde yaşar: native/android-widgets/
//   java/com/smlztrk/seelogd/widget/*.kt  → 9 Kotlin dosyası (3 modül, 3 provider,
//                                           2 RemoteViewsService, 1 ReactPackage)
//   res/{xml,layout,drawable,values}/     → appwidget info + layout + drawable +
//                                           widget string'leri
//
// prebuild sırasında bu plugin:
//   1. Kotlin ve res dosyalarını üretilen android/ projesine kopyalar,
//   2. AndroidManifest'e 2 RemoteViewsService + 3 receiver kaydını ekler,
//   3. MainApplication.kt'ye SeelogdWidgetPackage kaydını enjekte eder.
//
// Böylece android/ dizini repoda tutulmaz (CNG); EAS bulut build'leri ve yerel
// `expo prebuild` aynı çıktıyı üretir. Widget'ların JS köprüsü:
// services/widgetBridge.js (NativeModules.{Lists,Reminder,Stats}WidgetModule).

const { withAndroidManifest, withMainApplication, withDangerousMod, AndroidConfig } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Kotlin dosyaları ve LISTS_CYCLE action'ı bu paket adına gömülü. Paket adı
// değişirse native/android-widgets altındaki kaynaklar da güncellenmeli;
// sessizce bozuk build üretmemek için burada kilitliyoruz.
const WIDGET_PACKAGE = "com.smlztrk.seelogd";
const SRC_DIR = path.join(__dirname, "..", "native", "android-widgets");

const SERVICES = ["ReminderWidgetRemoteViewsService", "ListsWidgetRemoteViewsService"];

const RECEIVERS = [
  {
    name: "ReminderWidgetProvider",
    label: "@string/reminder_widget_name",
    info: "@xml/reminder_widget_info",
    actions: ["android.appwidget.action.APPWIDGET_UPDATE"],
  },
  {
    name: "ListsWidgetProvider",
    label: "@string/lists_widget_name",
    info: "@xml/lists_widget_info",
    // Liste değiştirme okları (‹ ›) APPWIDGET_UPDATE dışında özel bir
    // broadcast ile çalışır — filtreden düşerse oklar sessizce ölür.
    actions: ["android.appwidget.action.APPWIDGET_UPDATE", `${WIDGET_PACKAGE}.widget.LISTS_CYCLE`],
  },
  {
    name: "StatsWidgetProvider",
    label: "@string/stats_widget_name",
    info: "@xml/stats_widget_info",
    actions: ["android.appwidget.action.APPWIDGET_UPDATE"],
  },
];

function assertPackage(config) {
  const pkg = config.android && config.android.package;
  if (pkg !== WIDGET_PACKAGE) {
    throw new Error(
      `withAndroidWidgets: android.package "${pkg}" bekleneni (${WIDGET_PACKAGE}) tutmuyor. ` +
        "Widget Kotlin kaynakları pakete gömülü — native/android-widgets güncellenmeden paket değiştirilemez.",
    );
  }
}

// 1) Kotlin + res dosyalarını üretilen projeye kopyala.
function withWidgetSources(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const root = config.modRequest.platformProjectRoot;
      fs.cpSync(path.join(SRC_DIR, "java"), path.join(root, "app", "src", "main", "java"), {
        recursive: true,
        force: true,
      });
      fs.cpSync(path.join(SRC_DIR, "res"), path.join(root, "app", "src", "main", "res"), {
        recursive: true,
        force: true,
      });
      return config;
    },
  ]);
}

// 2) Manifest: servisler + receiver'lar (idempotent) ve eski bare projeyle
// davranış eşitliği için requestLegacyExternalStorage (API 29 altı cihaz
// davranışı; 30+ yok sayar).
function withWidgetManifest(config) {
  return withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    app.$["android:requestLegacyExternalStorage"] = "true";

    app.service = app.service || [];
    for (const name of SERVICES) {
      const androidName = `.widget.${name}`;
      if (!app.service.some((s) => s.$["android:name"] === androidName)) {
        app.service.push({
          $: {
            "android:name": androidName,
            "android:exported": "false",
            "android:permission": "android.permission.BIND_REMOTEVIEWS",
          },
        });
      }
    }

    app.receiver = app.receiver || [];
    for (const r of RECEIVERS) {
      const androidName = `.widget.${r.name}`;
      if (app.receiver.some((x) => x.$["android:name"] === androidName)) continue;
      app.receiver.push({
        $: {
          "android:name": androidName,
          "android:exported": "false",
          "android:label": r.label,
        },
        "intent-filter": [
          { action: r.actions.map((a) => ({ $: { "android:name": a } })) },
        ],
        "meta-data": [
          { $: { "android:name": "android.appwidget.provider", "android:resource": r.info } },
        ],
      });
    }
    return config;
  });
}

// 3) MainApplication.kt: SeelogdWidgetPackage kaydı (idempotent).
function withWidgetPackageRegistration(config) {
  return withMainApplication(config, (config) => {
    let src = config.modResults.contents;
    const importLine = `import ${WIDGET_PACKAGE}.widget.SeelogdWidgetPackage`;
    const addLine = "add(SeelogdWidgetPackage())";
    const anchor = "PackageList(this).packages.apply {";

    if (!src.includes(importLine)) {
      // İlk import satırının hemen önüne ekle — şablonun package satırı ile
      // import bloğu arasındaki boşluk düzeni ne olursa olsun çalışır.
      src = src.replace(/^import /m, `${importLine}\nimport `);
    }
    if (!src.includes(addLine)) {
      if (!src.includes(anchor)) {
        throw new Error(
          "withAndroidWidgets: MainApplication.kt içinde 'PackageList(this).packages.apply {' çapası bulunamadı — Expo şablonu değişmiş olabilir, plugin güncellenmeli.",
        );
      }
      src = src.replace(anchor, `${anchor}\n              ${addLine}`);
    }
    config.modResults.contents = src;
    return config;
  });
}

module.exports = function withAndroidWidgets(config) {
  assertPackage(config);
  config = withWidgetSources(config);
  config = withWidgetManifest(config);
  config = withWidgetPackageRegistration(config);
  return config;
};
