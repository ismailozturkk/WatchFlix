// hooks/useOwnProfileEditor.js
//
// Profil önizlemesindeki (FriendProfileScreen, kendi uid'in + preview) DÜZENLEME
// MODU. Eskiden ayrı "Profili Düzenle" ekranı vardı; artık profil, arkadaşın
// gördüğü düzenin AYNISI üzerinde yerinde düzenleniyor. Bu kanca yalnız taslağı
// ve kaydetmeyi yönetir, çizim ekranındır.
//
// Taslak: ad, kullanıcı adı, hakkında, avatar, kapak (banner), dört favori, sosyal hesaplar,
// vitrin rozetleri ve profilde görünen listeler. Hepsi Kaydet'e kadar yalnız
// yerelde durur; Vazgeç taslağı atar.
//
// Kaydetme kuralları eski ekranla BİREBİR aynı (boş ad yok, kullanıcı adı biçim +
// müsaitlik denetimi, geçersiz sosyal kullanıcı adı kaydı durdurur, ad/avatar
// değişimi günde bir — utils/profileIdentityCooldown). Doğum tarihi ve hesap
// silme/sıfırlama "Hesap bilgileri" ekranında kaldı (EditProfileScreen).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Toast from "@components/AppToast";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { useUserProfile } from "@context/UserProfileContext";
import { useProfileUi } from "@context/ProfileUiContext";
import useBadgeShowcase from "./useBadgeShowcase";
import {
  formatUsernameInput,
  isUsernameAvailable,
  isValidUsername,
  normalizeUsername,
  setListVisibility,
} from "@services/userService";
import { saveSocialLinks } from "@services/socialLinksService";
import { propagateProfileChange } from "@services/profilePropagation";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import { normalizeAppLanguage } from "@utils/appLanguages";
import { profileAvatarChoice, sameAvatarChoice, toAvatarChoice } from "@utils/avatarPhotos";
import {
  countFavorites,
  favoritesEqual,
  readProfileFavorites,
  toProfilePayload,
} from "@utils/fourFavorites";
import {
  readProfileSocialLinks,
  resolveSocialDraft,
  socialLinksEqual,
  toSocialPayload,
} from "@utils/socialLinks";
import { SOCIAL_NAMES, getSocialCopy } from "@utils/socialLinksCopy";
import { normalizeListVisible } from "@utils/listVisibility";
import { profileBannersEqual, readProfileBanner, toBannerPayload } from "@utils/profileBanner";
import { normalizeShowcaseBadges } from "@utils/badgeShowcase";
import {
  isProfileEditDirty,
  listVisibilityChanges,
  showcaseIdsEqual,
} from "@utils/profileEdit";
import { cooldownRemainingMs } from "@utils/profileIdentityCooldown";
import { identityCooldownToast } from "@utils/profileIdentityCooldownCopy";
import { i18nText } from "@utils/i18nText";

export const NAME_MAX = 40;
export const USERNAME_MAX = 20;
export const BIO_MAX = 160;

// Kullanıcı adı denetiminin bekleme süresi (her tuşta sorgu atılmasın).
const USERNAME_DEBOUNCE_MS = 500;

/** Kullanıcı adı durum satırı: { text, tone: "error" | "muted" | "success" } ya da null. */
function usernameHintFor(status, username, language) {
  const lang = normalizeAppLanguage(language);
  const un = normalizeUsername(username);
  switch (status) {
    case "invalid":
      if (un.length > 0 && un.length < 3) {
        return {
          tone: "error",
          text: i18nText("autoI18n.en_az_3_karakter_yalnizca_a_z_0_9", "En az 3 karakter · yalnızca a–z, 0–9, _"),
        };
      }
      if (un.length >= 3 && /^[0-9_]+$/.test(un)) {
        return {
          tone: "error",
          text:
            lang === "tr"
              ? "Kullanıcı adı sadece rakamlardan veya alt çizgiden oluşamaz (en az bir harf içermelidir)."
              : lang === "es"
                ? "El nombre de usuario no puede ser solo números o guiones bajos (debe contener al menos una letra)."
                : lang === "pt"
                  ? "O nome de usuário não pode ser só números ou sublinhados (deve conter pelo menos uma letra)."
                  : lang === "de"
                    ? "Der Benutzername darf nicht nur aus Zahlen oder Unterstrichen bestehen (mindestens ein Buchstabe ist nötig)."
                    : "Username cannot be only numbers or underscores (must contain at least one letter).",
        };
      }
      return {
        tone: "error",
        text: i18nText(
          "autoI18n.gecersiz_kullanici_adi_3_20_karakter_a_z_0_9",
          "3-20 karakter · yalnızca a-z, 0-9, _ (en az bir harf)",
        ),
      };
    case "checking":
      return { tone: "muted", text: i18nText("autoI18n.kontrol_ediliyor", "Kontrol ediliyor…") };
    case "taken":
      return { tone: "error", text: i18nText("autoI18n.bu_kullanici_adi_alinmis_2", "Bu kullanıcı adı alınmış") };
    case "available":
      return { tone: "success", text: i18nText("autoI18n.kullanilabilir", "Kullanılabilir") };
    default:
      return null;
  }
}

export default function useOwnProfileEditor({ enabled = true } = {}) {
  const { user } = useAuth() || {};
  const { language } = useLanguage();
  const { profile, uid, updateField, changeUsername } = useUserProfile() || {};
  const { selectAvatarIndex, selectAvatar } = useProfileUi() || {};
  const { showcaseIds, replaceShowcase } = useBadgeShowcase();
  const socialCopy = getSocialCopy(language);

  // Kayıtlı avatar, seçim biçiminde ({ avatarIndex, photoURL, photoSource }).
  const savedAvatar = useMemo(
    () =>
      profile
        ? profileAvatarChoice(profile, {
            fallbackIndex: selectAvatarIndex,
            authPhotoURL: user?.photoURL,
          })
        : null,
    [profile, selectAvatarIndex, user?.photoURL],
  );
  const savedFavorites = useMemo(() => readProfileFavorites(profile), [profile]);
  const savedSocial = useMemo(() => readProfileSocialLinks(profile), [profile]);
  const savedBanner = useMemo(() => readProfileBanner(profile), [profile]);
  const savedListVisible = useMemo(() => normalizeListVisible(profile?.listVisible), [profile?.listVisible]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [socialInvalid, setSocialInvalid] = useState([]);
  const [usernameStatus, setUsernameStatus] = useState("idle"); // idle|same|invalid|checking|available|taken
  const [saving, setSaving] = useState(false);

  const start = useCallback(() => {
    if (!enabled || !profile || !savedAvatar) return false;
    setDraft({
      displayName: profile.displayName || "",
      username: profile.username || "",
      bio: profile.bio || "",
      avatar: savedAvatar,
      favorites: savedFavorites,
      banner: savedBanner,
      social: { ...savedSocial },
      showcase: normalizeShowcaseBadges(showcaseIds),
      listVisible: { ...savedListVisible },
    });
    setSocialInvalid([]);
    setUsernameStatus("same");
    setEditing(true);
    return true;
  }, [enabled, profile, savedAvatar, savedFavorites, savedBanner, savedSocial, showcaseIds, savedListVisible]);

  const cancel = useCallback(() => {
    setEditing(false);
    setDraft(null);
    setSocialInvalid([]);
    setUsernameStatus("idle");
  }, []);

  const setField = useCallback((key, value) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = typeof value === "function" ? value(prev[key]) : value;
      return next === prev[key] ? prev : { ...prev, [key]: next };
    });
  }, []);

  const setDisplayName = useCallback((v) => setField("displayName", String(v ?? "").slice(0, NAME_MAX)), [setField]);
  const setUsername = useCallback((v) => setField("username", formatUsernameInput(v)), [setField]);
  const setBio = useCallback((v) => setField("bio", String(v ?? "").slice(0, BIO_MAX)), [setField]);
  const setAvatar = useCallback((choice) => setField("avatar", toAvatarChoice(choice)), [setField]);
  const setFavorites = useCallback((next) => setField("favorites", next), [setField]);
  const setBanner = useCallback((next) => setField("banner", toBannerPayload(next)), [setField]);
  const setShowcase = useCallback((next) => setField("showcase", normalizeShowcaseBadges(next)), [setField]);
  const setSocial = useCallback(
    (key, value) => {
      setField("social", (prev) => ({ ...(prev || {}), [key]: value }));
      setSocialInvalid((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : prev));
    },
    [setField],
  );
  const toggleList = useCallback(
    (name) => setField("listVisible", (prev) => ({ ...(prev || {}), [name]: prev?.[name] !== true })),
    [setField],
  );

  // Kullanıcı adı: biçim + müsaitlik (bekletmeli). Yalnız düzenleme modunda.
  const draftUsername = draft?.username;
  useEffect(() => {
    if (!editing || draftUsername == null) return undefined;
    const u = normalizeUsername(draftUsername);
    if (u === normalizeUsername(profile?.username || "")) {
      setUsernameStatus("same");
      return undefined;
    }
    if (!isValidUsername(u)) {
      setUsernameStatus("invalid");
      return undefined;
    }
    setUsernameStatus("checking");
    let alive = true;
    const id = setTimeout(async () => {
      try {
        const ok = await isUsernameAvailable(u);
        if (alive) setUsernameStatus(ok ? "available" : "taken");
      } catch {
        if (alive) setUsernameStatus("idle");
      }
    }, USERNAME_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [editing, draftUsername, profile?.username]);

  const usernameBlocked =
    usernameStatus === "invalid" || usernameStatus === "taken" || usernameStatus === "checking";

  const socialResolved = useMemo(() => resolveSocialDraft(draft?.social || {}), [draft?.social]);
  const listChanges = useMemo(
    () => (draft ? listVisibilityChanges(savedListVisible, draft.listVisible) : {}),
    [draft, savedListVisible],
  );
  const showcaseChanged = !!draft && !showcaseIdsEqual(draft.showcase, normalizeShowcaseBadges(showcaseIds));
  const bannerChanged = !!draft && !profileBannersEqual(draft.banner, savedBanner);

  const dirty =
    !!draft &&
    (isProfileEditDirty({
      ready: editing,
      saved: profile && savedAvatar
        ? {
            displayName: profile.displayName || "",
            username: normalizeUsername(profile.username || ""),
            bio: profile.bio || "",
            avatarIndex: savedAvatar.avatarIndex,
            avatarPhotoURL: savedAvatar.photoURL,
            birthDate: null,
            fourFavorites: savedFavorites,
            socialLinks: savedSocial,
          }
        : null,
      draft: {
        displayName: draft.displayName,
        username: normalizeUsername(draft.username),
        bio: draft.bio,
        avatarIndex: draft.avatar?.avatarIndex,
        avatarPhotoURL: draft.avatar?.photoURL,
        birthDate: null,
        fourFavorites: draft.favorites,
        socialLinks: socialResolved.links,
        socialInvalid: socialResolved.invalid,
      },
    }) ||
      showcaseChanged ||
      bannerChanged ||
      Object.keys(listChanges).length > 0);

  const canSave = dirty && !usernameBlocked && !saving;

  // Aynı anda iki Kaydet (çift dokunuş) iki yazım başlatmasın.
  const savingRef = useRef(false);

  /** true: kaydedildi (ya da kaydedilecek bir şey yoktu) ve mod kapandı. */
  const save = useCallback(async () => {
    if (!draft || savingRef.current) return false;
    if (!dirty) {
      cancel();
      return true;
    }
    const lang = normalizeAppLanguage(language);
    const dn = draft.displayName.trim();
    const un = normalizeUsername(draft.username);
    const bo = draft.bio.trim();

    if (!dn) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.isim_bos_olamaz", "İsim boş olamaz") });
      return false;
    }
    const usernameChanged = un !== normalizeUsername(profile?.username || "");
    if (usernameChanged && !isValidUsername(un)) {
      const isAllDigits = /^[0-9]+$/.test(un);
      Toast.show({
        type: "error",
        text1: isAllDigits
          ? lang === "tr"
            ? "Kullanıcı adı sadece rakamlardan oluşamaz (en az bir harf içermelidir)."
            : lang === "es"
              ? "El nombre de usuario no puede ser solo números (debe contener al menos una letra)."
              : lang === "pt"
                ? "O nome de usuário não pode ser só números (deve conter pelo menos uma letra)."
                : lang === "de"
                  ? "Der Benutzername darf nicht nur aus Zahlen bestehen (mindestens ein Buchstabe ist nötig)."
                  : "Username cannot consist only of numbers (must contain at least one letter)."
          : i18nText(
              "autoI18n.gecersiz_kullanici_adi_3_20_karakter_a_z_0_9",
              "Geçersiz kullanıcı adı (3-20 karakter, en az bir harf, a-z 0-9 _)",
            ),
      });
      return false;
    }
    if (usernameChanged && usernameStatus !== "available") {
      if (usernameStatus === "checking") {
        Toast.show({
          type: "info",
          text1:
            lang === "tr"
              ? "Kullanıcı adı kontrol ediliyor, lütfen bekleyin…"
              : lang === "es"
                ? "Comprobando la disponibilidad del nombre de usuario, espera un momento…"
                : lang === "pt"
                  ? "Verificando a disponibilidade do nome de usuário, aguarde um instante…"
                  : lang === "de"
                    ? "Verfügbarkeit des Benutzernamens wird geprüft, bitte warten…"
                    : "Checking username availability, please wait…",
        });
        return false;
      }
      Toast.show({
        type: "error",
        text1:
          usernameStatus === "taken"
            ? i18nText("autoI18n.bu_kullanici_adi_alinmis_2", "Bu kullanıcı adı alınmış")
            : i18nText(
                "autoI18n.gecersiz_kullanici_adi_3_20_karakter_a_z_0_9",
                "Geçersiz kullanıcı adı (3-20 karakter, en az bir harf, a-z 0-9 _)",
              ),
      });
      return false;
    }

    // Geçersiz sosyal kullanıcı adı: kaydı durdur, hatalı platformu işaretle
    // (yarım kayıt olmasın diye kullanıcı adı değişiminden ÖNCE).
    if (socialResolved.invalid.length) {
      setSocialInvalid(socialResolved.invalid);
      Toast.show({ type: "error", text1: socialCopy.invalid(SOCIAL_NAMES[socialResolved.invalid[0]]) });
      return false;
    }

    // Ad/avatar değişimi tüm kopyaları yeniden yazdırır — günde bir.
    const wantsNameChange = dn !== (profile?.displayName || "");
    const wantsAvatarChange = !sameAvatarChoice(draft.avatar, savedAvatar);
    if (wantsNameChange || wantsAvatarChange) {
      const remaining = cooldownRemainingMs(profile?.identityChangedAt);
      if (remaining > 0) {
        Toast.show(identityCooldownToast(remaining));
        return false;
      }
    }

    savingRef.current = true;
    setSaving(true);
    try {
      if (usernameChanged) await changeUsername(un);
      const patch = {};
      if (wantsNameChange) patch.displayName = dn;
      if (bo !== (profile?.bio || "")) patch.bio = bo;
      // Favoriler yalnız değiştiyse; hepsini kaldırmak da bir değişikliktir.
      if (!favoritesEqual(draft.favorites, savedFavorites)) {
        patch.fourFavorites = toProfilePayload(draft.favorites);
      }
      // Kapak: kaldırmak null yazar (alan silinmez; kural null'ı kabul eder).
      if (bannerChanged) patch.profileBanner = toBannerPayload(draft.banner);
      if (Object.keys(patch).length) await updateField(patch, { stampIdentity: wantsNameChange });
      if (!socialLinksEqual(socialResolved.links, savedSocial)) {
        await saveSocialLinks(uid, toSocialPayload(socialResolved.links));
      }
      if (Object.keys(listChanges).length) {
        // Eski dizi biçimi tek alan yazımında haritaya dönerken diğer bayrakları
        // düşürürdü; o durumda haritanın tamamı yazılır (ListVisibilityScreen ile aynı).
        await setListVisibility(
          uid,
          Array.isArray(profile?.listVisible) ? { ...savedListVisible, ...listChanges } : listChanges,
        );
      }
      if (showcaseChanged) replaceShowcase(draft.showcase);
      if (patch.fourFavorites) {
        trackEvent(ANALYTICS_EVENTS.FOUR_FAVORITES_SAVED, {
          movies: countFavorites(draft.favorites, "movies"),
          shows: countFavorites(draft.favorites, "shows"),
          people: countFavorites(draft.favorites, "people"),
          total: countFavorites(draft.favorites),
        });
      }
      // Avatar kopyalarını selectAvatar → userService.setAvatarIndex tazeler.
      if (wantsAvatarChange) await selectAvatar(draft.avatar);
      if ((wantsNameChange || usernameChanged) && profile?.uid) {
        propagateProfileChange(profile.uid, {
          displayName: wantsNameChange ? dn : undefined,
          username: usernameChanged ? un : undefined,
        }).catch(() => {});
      }
      Toast.show({ type: "success", text1: i18nText("autoI18n.profil_guncellendi", "Profil güncellendi") });
      cancel();
      return true;
    } catch (e) {
      Toast.show({ type: "error", text1: e?.message || i18nText("autoI18n.guncellenemedi", "Güncellenemedi") });
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [
    draft,
    dirty,
    cancel,
    language,
    profile,
    usernameStatus,
    socialResolved,
    socialCopy,
    savedAvatar,
    savedFavorites,
    bannerChanged,
    savedSocial,
    savedListVisible,
    listChanges,
    showcaseChanged,
    replaceShowcase,
    changeUsername,
    updateField,
    selectAvatar,
    uid,
  ]);

  return {
    editing,
    draft,
    dirty,
    canSave,
    saving,
    usernameStatus,
    usernameHint: editing ? usernameHintFor(usernameStatus, draft?.username || "", language) : null,
    socialInvalid,
    start,
    cancel,
    save,
    setDisplayName,
    setUsername,
    setBio,
    setAvatar,
    setFavorites,
    setBanner,
    setShowcase,
    setSocial,
    toggleList,
  };
}
