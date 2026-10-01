// utils/appIcons.js
//
// Seçilebilir uygulama simgelerinin KATALOĞU. Saf modül (RN importu yok).
//
// Adlar iki yerde birebir aynı olmak zorunda:
//   • app.json → "./plugins/withAlternateAppIcons.js" → icons[].name
//     ("Default" hariç — o, `expo.icon`'dan gelen birincil simge)
//   • yerel modül modules/app-icon (Android alias adı `MainActivity<Ad>`,
//     iOS `<Ad>.appiconset`)
// __tests__/appIcons.test.js bu eşliği ve app.json'daki görsel yollarını doğrular.
//
// Görseller (assets/icon_default, assets/icon_glass) bileşende require edilir;
// burada tutulmaz ki katalog jest'te görsel yükleyiciye ihtiyaç duymasın.

/** Birincil (varsayılan) simgenin yerel adı. iOS'ta `setAlternateIconName(null)`. */
export const DEFAULT_NATIVE_NAME = "Default";

export const DEFAULT_APP_ICON_ID = "default";

export const APP_ICONS = Object.freeze([
  Object.freeze({
    id: "default",
    nativeName: DEFAULT_NATIVE_NAME,
    labelKey: "autoI18n.uygulama_simgesi_varsayilan",
    labelFallback: "Varsayılan",
  }),
  Object.freeze({
    id: "glass",
    nativeName: "Glass",
    labelKey: "autoI18n.uygulama_simgesi_cam",
    labelFallback: "Cam",
  }),
]);

export const APP_ICON_NATIVE_NAMES = Object.freeze(APP_ICONS.map((i) => i.nativeName));

/** Yerel ad → katalog kimliği. Bilinmeyen/boş ad varsayılana düşer. */
export function iconIdFromNativeName(nativeName) {
  const found = APP_ICONS.find((i) => i.nativeName === nativeName);
  return found ? found.id : DEFAULT_APP_ICON_ID;
}

/** Katalog kimliği → yerel ad. Bilinmeyen kimlik null döner (çağıran reddetmeli). */
export function nativeNameFromIconId(id) {
  const found = APP_ICONS.find((i) => i.id === id);
  return found ? found.nativeName : null;
}
