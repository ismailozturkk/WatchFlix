import React, {
  createContext, useContext, useMemo,
} from "react";
import { useAuth } from "./AuthContext";
import Toast from "@components/AppToast";
import { i18nText } from "../utils/i18nText";
import { pickByLanguage } from "../utils/appLanguages";
import { usePremiumGate } from "../hooks/usePremiumGate";
import useUserDataDomain from "../hooks/useUserDataDomain";
import { mediaNotesDomain } from "../services/userData";
import { useLanguage } from "./LanguageContext";

// Film/dizi detay sayfasından yazılan, TEK bir medya öğesine bağlı kişisel not.
// Genel "Notlar" (context/ProfileNotesContext.js, Notes/{uid}/items) koleksiyonundan
// BİLİNÇLİ olarak ayrı: bu notların mediaId/mediaType/poster gibi ekstra alanları
// var ve düz not/todo şemasına zorlanması NotesScreen'in kart/düzenleme UI'ını
// karmaşıklaştırırdı (docs: Notlar ekranındaki Notlar/Yapılacaklar sekme deseni
// aynen korunuyor, üçüncü bir "Film/Dizi" sekmesi bu context'ten besleniyor).
//
// Firestore: MediaNotes/{uid}/items/{itemKey}, itemKey = "{type}_{mediaId}" —
// listItemsService.js'teki `type_id` doc-id kuralıyla aynı: bir medyanın en
// fazla bir notu olur, detay sayfası ekstra sorgu yapmadan doğrudan okuyabilir.
export const mediaNoteItemKey = (type, mediaId) => `${type === "tv" ? "tv" : "movie"}_${mediaId}`;

const MediaNotesContext = createContext();
export const useMediaNotes = () => useContext(MediaNotesContext);

export const MediaNotesProvider = ({ children }) => {
  const { user } = useAuth();
  const uid = user?.uid;

  // YEREL-ÖNCELİKLİ (bkz. ProfileNotesContext.js): okuma yerel kopyadan senkron,
  // yazma yerelde + kalıcı günlükte anında, buluttan çekim yalnız kopya yokken
  // tek seferlik.
  const view = useUserDataDomain(mediaNotesDomain);
  const mediaNotes = view.lists.items;
  const loadingMediaNotes = !view.ready && view.hydrating;

  // Film ve dizi notu SAYISI ücretsiz planda ayrı ayrı sınırlı (registry:
  // movie_notes, tv_notes). Her yapımın tek notu olduğu için sayılan şey
  // not yazılmış farklı yapım sayısıdır. Yalnız YENİ yapım hak harcar:
  // mevcut notu düzenlemek ve silmek serbest, abonelik bitince notlar silinmez.
  const { language } = useLanguage();
  const movieNotesGate = usePremiumGate("movie_notes");
  const tvNotesGate = usePremiumGate("tv_notes");
  const mediaNoteCounts = useMemo(() => {
    let tv = 0;
    for (const n of mediaNotes) if (n?.type === "tv") tv += 1;
    return { movie: mediaNotes.length - tv, tv };
  }, [mediaNotes]);

  const gateFor = (type) => (type === "tv" ? tvNotesGate : movieNotesGate);
  const countFor = (type) => (type === "tv" ? mediaNoteCounts.tv : mediaNoteCounts.movie);
  const hasNoteFor = (type, mediaId) =>
    mediaNotes.some((n) => n.id === mediaNoteItemKey(type, mediaId));
  /** Bu yapıma not yazılabilir mi? Notu varsa (düzenleme) her zaman evet. */
  const canCreateMediaNote = (type, mediaId) =>
    hasNoteFor(type, mediaId) || gateFor(type).allows(countFor(type));
  /** Yazılabilirse true; doluysa yükseltme sayfasını gösterip false döner. */
  const checkCanCreateMediaNote = (type, mediaId, options) =>
    hasNoteFor(type, mediaId) || gateFor(type).check(countFor(type), options);

  const saveMediaNote = async ({ type, mediaId, title, posterPath, text }) => {
    if (!uid || !mediaId) return false;
    const key = mediaNoteItemKey(type, mediaId);
    const existing = mediaNotesDomain.getSnapshot(uid).get("items", key);
    const now = Date.now();
    const cleanText = String(text || "").trim();
    if (!cleanText) return false;

    // Son savunma hattı: detay sayfaları limiti sayfayı açmadan önce denetler,
    // ama başka cihazdan eklenen not sayıyı aradan değiştirmiş olabilir. Not
    // sayfası bir Modal; yükseltme sayfası üstüne açılamaz, bu yüzden toast.
    if (!existing && !canCreateMediaNote(type === "tv" ? "tv" : "movie", mediaId)) {
      Toast.show({
        type: "warning",
        text1: pickByLanguage(
          language,
          type === "tv"
            ? {
                tr: "Dizi notu limitin doldu",
                en: "You've reached your show notes limit",
                es: "Has alcanzado tu límite de notas de series",
                pt: "Você atingiu seu limite de notas de séries",
                de: "Du hast dein Limit für Serien-Notizen erreicht",
              }
            : {
                tr: "Film notu limitin doldu",
                en: "You've reached your movie notes limit",
                es: "Has alcanzado tu límite de notas de películas",
                pt: "Você atingiu seu limite de notas de filmes",
                de: "Du hast dein Limit für Film-Notizen erreicht",
              },
        ),
      });
      return false;
    }

    const finalNote = {
      id: key,
      type: type === "tv" ? "tv" : "movie",
      mediaId,
      title: title || existing?.title || "",
      posterPath: posterPath ?? existing?.posterPath ?? null,
      text: cleanText,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    try {
      // Yerel kopya + kalıcı günlük anında; buluta arka planda gider.
      mediaNotesDomain.apply(uid, [{ kind: "items", doc: finalNote }]);
      return true;
    } catch (err) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.not_kaydedilemedi", "Not kaydedilemedi") });
      return false;
    }
  };

  const deleteMediaNote = async (type, mediaId) => {
    if (!uid || !mediaId) return;
    const key = mediaNoteItemKey(type, mediaId);
    try {
      mediaNotesDomain.apply(uid, [{ kind: "items", key }]);
    } catch (err) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.not_silinemedi", "Not silinemedi") });
    }
  };

  const value = useMemo(() => ({
    // `mediaNotes` reaktif dizi olarak dışarı veriliyor (ref değil): tüketiciler
    // render sırasında `mediaNotes.find(n => n.id === mediaNoteItemKey(...))`
    // ile "bu medyanın notu var mı" diye SENKRON ve her zaman güncel sorabilir.
    mediaNotes, loadingMediaNotes,
    saveMediaNote, deleteMediaNote,
    mediaNoteCounts, canCreateMediaNote, checkCanCreateMediaNote,
  }), [mediaNotes, loadingMediaNotes, uid, language, mediaNoteCounts, movieNotesGate, tvNotesGate]);

  return (
    <MediaNotesContext.Provider value={value}>
      {children}
    </MediaNotesContext.Provider>
  );
};
