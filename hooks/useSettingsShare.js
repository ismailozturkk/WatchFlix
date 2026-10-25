// hooks/useSettingsShare.js
//
// "Görünümümü paylaş"ın React'e bağlı kısmı: cihazdaki görünüm ayarlarını okur
// (paylaşım gövdesi ve "Zaten aynı" karşılaştırması için) ve sohbetten gelen
// ayarları CANLI uygular — yeniden başlatma yok.
//
// NEDEN CONTEXT SETTER'LARI (depoya doğrudan yazmak yerine): tema, efekt ve liste
// tercihleri AppSettingsContext / ProfileUiContext state'inde; depo sonradan
// değişince izlemiyorlar (ayar yedeği bu yüzden uygulamayı yeniden başlatıyor).
// Setter'lar hem state'i hem depoyu günceller ve Premium'un İKİNCİ kapısını taşır
// (Free'de kar/ambiyans/ikon arka planı açılamaz, kilitli font seçilemez).
// Yazı tipi servisi ve bölüm görünürlüğü depoya abone; onlar kendi API'leriyle.
//
// GERİ AL: uygulamadan önce aynı bölümlerin mevcut değerleri aynı biçimde alınır;
// `undo()` onları aynı yoldan geri yazar ve bu işlemle EKLENEN özel temayı siler.
// Saf kurallar utils/settingsShare.js'te.

import { useCallback, useRef } from "react";
import { Keys, get, remove, set } from "../services/storage";
import { useTheme } from "../context/ThemeContext";
import {
  useAmbientBackgroundSettings,
  useDecorScopeSettings,
  useIconBackgroundSettings,
  useListLayoutSettings,
  useSnowSettings,
} from "../context/AppSettingsContext";
import { useProfileUi } from "../context/ProfileUiContext";
import { setFontRole, useTypographyState } from "../services/typographySettings";
import { DEFAULT_FONT_ROLES, TEXT_ROLES, normalizeFontRoles } from "../utils/typographyRoles";
import { normalizeSectionVisibility, toStoredSectionVisibility } from "../utils/sectionVisibility";
import { buildSettingsShare, SETTINGS_SHARE_SECTION_IDS } from "../utils/settingsShare";

const orDefault = (value, key) => (value === null || value === undefined ? Keys[key].default : value);

export default function useSettingsShare() {
  const themeCtx = useTheme();
  const snow = useSnowSettings();
  const ambient = useAmbientBackgroundSettings();
  const iconBackground = useIconBackgroundSettings();
  const decor = useDecorScopeSettings();
  const layout = useListLayoutSettings();
  const profileUi = useProfileUi();
  const typography = useTypographyState();

  // Uygulama sayfa kapandıktan sonra, geri alma ise saniyeler sonra toast'tan
  // çalışır: o anki (bayat olmayan) setter ve değerler bu ref'ten okunur.
  const latest = useRef(null);
  latest.current = { themeCtx, snow, ambient, iconBackground, decor, layout, profileUi, typography };

  /**
   * Ayarın şu anki değeri. `effective`: GÖNDEREN için kullanıcının GÖRDÜĞÜ tema ve
   * yazı tipi (Free'de kilitli özel tema/font yerine çizilen); aksi halde kayıtlı
   * seçim (alıcıda karşılaştırma ve geri alma).
   */
  const read = useCallback((key, { effective = false } = {}) => {
    const c = latest.current;
    switch (key) {
      case "theme":
        return effective ? c.themeCtx.appliedTheme : c.themeCtx.selectedTheme;
      case "fontRoles": {
        const t = c.typography;
        return effective ? { heading: t.heading, body: t.body, numeric: t.numeric } : { ...t.selected };
      }
      // Premium efektlerinin ham bayrağı kapıyı atlayarak okunmaz (bekçi:
      // decorScopes.test.js); iki kipte de ETKİN değer. Free'de zaten açılamazlar.
      case "showSnow":
        return c.snow.showSnow;
      case "showAmbientBackground":
        return c.ambient.showAmbientBackground;
      case "showIconBackground":
        return c.iconBackground.showIconBackground;
      case "iconBackgroundMode":
        return c.iconBackground.iconBackgroundMode;
      case "iconBackgroundOpacity":
        return c.iconBackground.iconBackgroundOpacity;
      case "decorScopes":
        return c.decor.decorHidden;
      case "allCornersRounded":
        return !!c.profileUi?.allCornersRounded;
      case "listGridStyle":
        return c.profileUi?.gridStyle ?? get(Keys.listGridStyle);
      case "sectionVisibility":
        return normalizeSectionVisibility(get(Keys.sectionVisibility));
      default:
        // Kalan liste/afiş tercihleri ListLayout context'inde aynı adla duruyor.
        return key in c.layout ? c.layout[key] : get(Keys[key]);
    }
  }, []);

  const currentThemes = () => {
    const list = latest.current.themeCtx.customThemes;
    return Array.isArray(list) ? list : [];
  };

  /** Gönderilecek gövde (gönderenin GÖRDÜĞÜ ayarlar). */
  const buildMine = useCallback(
    (sections, owner) =>
      buildSettingsShare({
        read: (key) => read(key, { effective: true }),
        customThemes: currentThemes(),
        sections,
        owner,
      }),
    [read],
  );

  /** Bir bölümü yazar; yazılamadıysa false. */
  const writeSection = (id, values) => {
    const c = latest.current;
    const has = (key) => key in values;
    switch (id) {
      case "theme": {
        if (values.custom) c.themeCtx.saveCustomTheme(values.custom);
        c.themeCtx.changeTheme(values.theme);
        return true;
      }
      case "fonts": {
        const roles = normalizeFontRoles(values.fontRoles ?? DEFAULT_FONT_ROLES);
        // setFontRole kilitli (Premium) ya da role uygun olmayan fontu reddeder.
        return TEXT_ROLES.map((role) => setFontRole(role, roles[role])).every(Boolean);
      }
      case "effects": {
        if (has("showSnow")) c.snow.changeShowSnow(values.showSnow === true);
        if (has("showAmbientBackground")) c.ambient.changeShowAmbientBackground(values.showAmbientBackground === true);
        if (has("showIconBackground")) c.iconBackground.changeShowIconBackground(values.showIconBackground === true);
        if (has("iconBackgroundMode")) {
          c.iconBackground.changeIconBackgroundMode(orDefault(values.iconBackgroundMode, "iconBackgroundMode"));
        }
        if (has("iconBackgroundOpacity")) {
          c.iconBackground.changeIconBackgroundOpacity(orDefault(values.iconBackgroundOpacity, "iconBackgroundOpacity"));
        }
        if (has("decorScopes")) c.decor.replaceDecorScopes(values.decorScopes);
        return true;
      }
      case "posters": {
        if (has("allCornersRounded")) c.profileUi?.saveAllCornersRounded?.(values.allCornersRounded === true);
        if (has("listsPosterRadius")) c.layout.changeListsPosterRadius(orDefault(values.listsPosterRadius, "listsPosterRadius"));
        if (has("seeAllPosterRadius")) c.layout.changeSeeAllPosterRadius(orDefault(values.seeAllPosterRadius, "seeAllPosterRadius"));
        if (has("railPosterRadius")) c.layout.changeRailPosterRadius(orDefault(values.railPosterRadius, "railPosterRadius"));
        if (has("railPosterSize")) c.layout.changeRailPosterSize(orDefault(values.railPosterSize, "railPosterSize"));
        if (has("postListPosterLayout")) {
          c.layout.changePostListPosterLayout(orDefault(values.postListPosterLayout, "postListPosterLayout"));
        }
        return true;
      }
      case "lists": {
        if (has("listsGridColumns")) c.layout.changeListsGridColumns(orDefault(values.listsGridColumns, "listsGridColumns"));
        if (has("seeAllGridColumns")) c.layout.changeSeeAllGridColumns(orDefault(values.seeAllGridColumns, "seeAllGridColumns"));
        if (has("listGridStyle")) c.profileUi?.saveListGridStyle?.(orDefault(values.listGridStyle, "listGridStyle"));
        if (values.listPosterInfo && typeof values.listPosterInfo === "object") {
          // Bilinmeyen anahtarı context zaten yok sayar.
          for (const [key, value] of Object.entries(values.listPosterInfo)) c.layout.changeListPosterInfo(key, value === true);
        }
        if (has("posterBadges")) c.layout.changePosterBadges(values.posterBadges);
        return true;
      }
      case "home": {
        const stored = toStoredSectionVisibility(values.sectionVisibility);
        return stored === null ? remove(Keys.sectionVisibility) : set(Keys.sectionVisibility, stored);
      }
      default:
        return false;
    }
  };

  /**
   * Bölümleri uygular (planSettingsApply çıktısının `sections`'ı).
   * @returns {{applied: string[], failed: string[], undo: () => void}}
   */
  const apply = useCallback(
    (sections) => {
      const ids = SETTINGS_SHARE_SECTION_IDS.filter((id) => sections && sections[id]);
      // Önceki hâl: aynı bölümler, aynı biçimde (kayıtlı seçimler).
      const before = buildSettingsShare({ read: (key) => read(key), customThemes: currentThemes(), sections: ids });
      const knownThemeIds = new Set(currentThemes().map((theme) => theme.id));
      const addedThemeId =
        sections.theme?.custom && !knownThemeIds.has(sections.theme.custom.id) ? sections.theme.custom.id : null;

      const applied = [];
      const failed = [];
      for (const id of ids) {
        let ok = false;
        try {
          ok = writeSection(id, sections[id]);
        } catch {
          ok = false;
        }
        (ok ? applied : failed).push(id);
      }

      const undo = () => {
        const previous = before?.sections || {};
        for (const id of applied) {
          if (!previous[id]) continue;
          try {
            writeSection(id, previous[id]);
          } catch {
            // Geri yazılamayan bölüm olduğu gibi kalır; diğerleri yine döner.
          }
        }
        if (addedThemeId) latest.current.themeCtx.deleteCustomTheme(addedThemeId);
      };

      return { applied, failed, undo };
    },
    [read],
  );

  return { read, buildMine, apply, customThemes: themeCtx.customThemes || [] };
}
