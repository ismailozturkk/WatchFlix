// Uygulama simgesi kataloğu (utils/appIcons.js) ↔ app.json plugin yapılandırması.
//
// İki taraf ayrışırsa hata sessiz kalır: JS'te listelenen bir simge için native
// tarafta alias/appiconset yoktur, seçim ya hata verir ya hiçbir şey yapmaz.
// Aynı test, simge dosyaları taşındığında app.json'daki yolların kırılmasını da
// yakalar (assets/icon.png → assets/icon_default/icon.png taşınması sırasında
// birincil simge ve bildirim simgesi yolları eski yerde kalmıştı).

import fs from "fs";
import path from "path";
import {
  APP_ICONS,
  APP_ICON_NATIVE_NAMES,
  DEFAULT_APP_ICON_ID,
  DEFAULT_NATIVE_NAME,
  iconIdFromNativeName,
  nativeNameFromIconId,
} from "../utils/appIcons";

const ROOT = path.join(__dirname, "..");
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, "app.json"), "utf8")).expo;

const pluginEntry = (appJson.plugins || []).find(
  (p) => Array.isArray(p) && p[0] === "./plugins/withAlternateAppIcons.js",
);
const altIcons = pluginEntry ? pluginEntry[1].icons : [];

describe("katalog", () => {
  test("kimlikler ve yerel adlar benzersiz", () => {
    expect(new Set(APP_ICONS.map((i) => i.id)).size).toBe(APP_ICONS.length);
    expect(new Set(APP_ICON_NATIVE_NAMES).size).toBe(APP_ICON_NATIVE_NAMES.length);
  });

  test("varsayılan simge katalogun ilki ve 'Default' adını taşır", () => {
    expect(APP_ICONS[0].id).toBe(DEFAULT_APP_ICON_ID);
    expect(APP_ICONS[0].nativeName).toBe(DEFAULT_NATIVE_NAME);
  });

  test("her simgenin çeviri anahtarı ve yedek metni var", () => {
    for (const icon of APP_ICONS) {
      expect(icon.labelKey).toMatch(/^autoI18n\./);
      expect(icon.labelFallback).toBeTruthy();
    }
  });

  test("kimlik ↔ yerel ad dönüşümü gidiş-dönüş tutarlı", () => {
    for (const icon of APP_ICONS) {
      expect(nativeNameFromIconId(icon.id)).toBe(icon.nativeName);
      expect(iconIdFromNativeName(icon.nativeName)).toBe(icon.id);
    }
  });

  test("bilinmeyen/boş ad varsayılana, bilinmeyen kimlik null'a düşer", () => {
    expect(iconIdFromNativeName(null)).toBe(DEFAULT_APP_ICON_ID);
    expect(iconIdFromNativeName(undefined)).toBe(DEFAULT_APP_ICON_ID);
    expect(iconIdFromNativeName("Yok")).toBe(DEFAULT_APP_ICON_ID);
    expect(nativeNameFromIconId("yok")).toBeNull();
  });
});

describe("app.json plugin eşliği", () => {
  test("plugin tanımlı ve en az bir alternatif içeriyor", () => {
    expect(pluginEntry).toBeTruthy();
    expect(altIcons.length).toBeGreaterThan(0);
  });

  test("plugin'deki adlar + Default = JS kataloğu", () => {
    const fromConfig = [DEFAULT_NATIVE_NAME, ...altIcons.map((i) => i.name)].sort();
    expect([...APP_ICON_NATIVE_NAMES].sort()).toEqual(fromConfig);
  });

  test("alternatif adlar PascalCase ve 'Default' değil", () => {
    for (const icon of altIcons) {
      expect(icon.name).toMatch(/^[A-Z][A-Za-z0-9]*$/);
      expect(icon.name).not.toBe(DEFAULT_NATIVE_NAME);
    }
  });
});

describe("app.json görsel yolları gerçekten var", () => {
  const paths = [
    ["expo.icon", appJson.icon],
    ["android.adaptiveIcon.foregroundImage", appJson.android.adaptiveIcon.foregroundImage],
    ["android.adaptiveIcon.backgroundImage", appJson.android.adaptiveIcon.backgroundImage],
    ["android.adaptiveIcon.monochromeImage", appJson.android.adaptiveIcon.monochromeImage],
    ["web.favicon", appJson.web.favicon],
  ];
  for (const p of appJson.plugins) {
    if (Array.isArray(p) && p[0] === "expo-splash-screen") paths.push(["splash.image", p[1].image]);
    if (Array.isArray(p) && p[0] === "expo-notifications") paths.push(["notification.icon", p[1].icon]);
  }
  for (const icon of altIcons) {
    paths.push([`${icon.name}.ios`, icon.ios]);
    paths.push([`${icon.name}.android.foreground`, icon.android.foregroundImage]);
    paths.push([`${icon.name}.android.background`, icon.android.backgroundImage]);
    if (icon.android.monochromeImage) {
      paths.push([`${icon.name}.android.monochrome`, icon.android.monochromeImage]);
    }
  }

  test.each(paths)("%s", (_label, rel) => {
    expect(typeof rel).toBe("string");
    expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
  });

  test("ayar kartının önizleme görselleri var", () => {
    expect(fs.existsSync(path.join(ROOT, "assets/icon_default/icon.png"))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, "assets/icon_glass/icon.png"))).toBe(true);
  });
});
