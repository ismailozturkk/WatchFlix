// utils/posterChoicesCopy.js
//
// Özel afiş ve arka plan seçiminin metinleri (5 dil): galerideki seç/varsayılana dön
// düğmeleri ve geri bildirimleri. Beş dilin eşitliğini
// __tests__/copyTablesSpanish.test.js korur. Premium yükseltme metni kayıtta
// (utils/premiumFeatures.js `custom_posters`).

import { copyLanguage } from "./appLanguages";

const tr = {
  useAsPoster: "Afiş olarak kullan",
  currentPoster: "Afişin bu",
  resetPoster: "Varsayılana dön",
  chosenToast: "Afiş güncellendi",
  chosenToastSub: "Kütüphanende, listelerinde ve profilinde bu afiş görünecek.",
  resetToast: "Varsayılan afişe dönüldü",
  fullToast: (max) => `En çok ${max} afiş seçebilirsin`,
  fullToastSub: "Yenisini seçmek için başka bir yapımda varsayılana dön.",
  signInNeeded: "Afiş seçmek için giriş yap",
  chosenBadge: "Seçili afiş",
  useAsBackdrop: "Arka plan olarak kullan",
  currentBackdrop: "Arka planın bu",
  backdropChosenToast: "Arka plan güncellendi",
  backdropChosenToastSub: "Film ve dizi sayfasında ve aramada bu arka plan görünecek.",
  backdropResetToast: "Varsayılan arka plana dönüldü",
  backdropFullToast: (max) => `En çok ${max} arka plan seçebilirsin`,
  chosenBackdropBadge: "Seçili arka plan",
  premiumTag: "Premium",
};

const en = {
  useAsPoster: "Use as poster",
  currentPoster: "Your poster",
  resetPoster: "Back to default",
  chosenToast: "Poster updated",
  chosenToastSub: "This poster will show in your library, lists and profile.",
  resetToast: "Back to the default poster",
  fullToast: (max) => `You can pick up to ${max} posters`,
  fullToastSub: "Switch another title back to default to pick a new one.",
  signInNeeded: "Sign in to pick a poster",
  chosenBadge: "Selected poster",
  useAsBackdrop: "Use as backdrop",
  currentBackdrop: "Your backdrop",
  backdropChosenToast: "Backdrop updated",
  backdropChosenToastSub: "This backdrop will show on the movie or show page and in search.",
  backdropResetToast: "Back to the default backdrop",
  backdropFullToast: (max) => `You can pick up to ${max} backdrops`,
  chosenBackdropBadge: "Selected backdrop",
  premiumTag: "Premium",
};

const es = {
  useAsPoster: "Usar como póster",
  currentPoster: "Tu póster",
  resetPoster: "Volver al predeterminado",
  chosenToast: "Póster actualizado",
  chosenToastSub: "Este póster se verá en tu biblioteca, tus listas y tu perfil.",
  resetToast: "Volviste al póster predeterminado",
  fullToast: (max) => `Puedes elegir hasta ${max} pósteres`,
  fullToastSub: "Devuelve otro título al predeterminado para elegir uno nuevo.",
  signInNeeded: "Inicia sesión para elegir un póster",
  chosenBadge: "Póster elegido",
  useAsBackdrop: "Usar como fondo",
  currentBackdrop: "Tu fondo",
  backdropChosenToast: "Fondo actualizado",
  backdropChosenToastSub: "Este fondo se verá en la página de la película o serie y en la búsqueda.",
  backdropResetToast: "Volviste al fondo predeterminado",
  backdropFullToast: (max) => `Puedes elegir hasta ${max} fondos`,
  chosenBackdropBadge: "Fondo elegido",
  premiumTag: "Premium",
};

const pt = {
  useAsPoster: "Usar como pôster",
  currentPoster: "Seu pôster",
  resetPoster: "Voltar ao padrão",
  chosenToast: "Pôster atualizado",
  chosenToastSub: "Este pôster vai aparecer na sua biblioteca, nas suas listas e no seu perfil.",
  resetToast: "Você voltou ao pôster padrão",
  fullToast: (max) => `Você pode escolher até ${max} pôsteres`,
  fullToastSub: "Volte outro título ao padrão para escolher um novo.",
  signInNeeded: "Entre para escolher um pôster",
  chosenBadge: "Pôster escolhido",
  useAsBackdrop: "Usar como fundo",
  currentBackdrop: "Seu fundo",
  backdropChosenToast: "Fundo atualizado",
  backdropChosenToastSub: "Este fundo vai aparecer na página do filme ou da série e na busca.",
  backdropResetToast: "Você voltou ao fundo padrão",
  backdropFullToast: (max) => `Você pode escolher até ${max} fundos`,
  chosenBackdropBadge: "Fundo escolhido",
  premiumTag: "Premium",
};

const de = {
  useAsPoster: "Als Poster verwenden",
  currentPoster: "Dein Poster",
  resetPoster: "Zurück zum Standard",
  chosenToast: "Poster aktualisiert",
  chosenToastSub: "Dieses Poster erscheint in deiner Bibliothek, deinen Listen und deinem Profil.",
  resetToast: "Zurück zum Standardposter",
  fullToast: (max) => `Du kannst bis zu ${max} Poster auswählen`,
  fullToastSub: "Setze einen anderen Titel auf Standard zurück, um ein neues zu wählen.",
  signInNeeded: "Melde dich an, um ein Poster auszuwählen",
  chosenBadge: "Ausgewähltes Poster",
  useAsBackdrop: "Als Hintergrund verwenden",
  currentBackdrop: "Dein Hintergrund",
  backdropChosenToast: "Hintergrund aktualisiert",
  backdropChosenToastSub: "Dieser Hintergrund erscheint auf der Film- oder Serienseite und in der Suche.",
  backdropResetToast: "Zurück zum Standardhintergrund",
  backdropFullToast: (max) => `Du kannst bis zu ${max} Hintergründe auswählen`,
  chosenBackdropBadge: "Ausgewählter Hintergrund",
  premiumTag: "Premium",
};
const it = {
  useAsPoster: "Usa come poster",
  currentPoster: "Il tuo poster",
  resetPoster: "Torna alle impostazioni predefinite",
  chosenToast: "Poster aggiornato",
  chosenToastSub: "Questo poster verrà visualizzato nella tua libreria, negli elenchi e nel profilo.",
  resetToast: "Torna al poster predefinito",
  fullToast: max => `Puoi scegliere fino a ${max} poster`,
  fullToastSub: "Riporta un altro titolo a quello predefinito per sceglierne uno nuovo.",
  signInNeeded: "Accedi per scegliere un poster",
  chosenBadge: "Poster selezionato",
  useAsBackdrop: "Utilizza come sfondo",
  currentBackdrop: "Il tuo sfondo",
  backdropChosenToast: "Sfondo aggiornato",
  backdropChosenToastSub: "Questo sfondo verrà visualizzato nella pagina del film o del programma e nella ricerca.",
  backdropResetToast: "Torna allo sfondo predefinito",
  backdropFullToast: max => `Puoi scegliere fino a ${max} sfondi`,
  chosenBackdropBadge: "Sfondo selezionato",
  premiumTag: "Premium"
};
const fr = {
  useAsPoster: "Utiliser comme affiche",
  currentPoster: "Ton affiche",
  resetPoster: "Revenir par défaut",
  chosenToast: "Affiche mise à jour",
  chosenToastSub: "Cette affiche s'affichera dans ta bibliothèque, tes listes et ton profil.",
  resetToast: "Retour à l'affiche par défaut",
  fullToast: (max) => `Tu peux choisir jusqu'à ${max} affiches`,
  fullToastSub: "Remets un autre titre par défaut pour en choisir une nouvelle.",
  signInNeeded: "Connecte-toi pour choisir une affiche",
  chosenBadge: "Affiche sélectionnée",
  useAsBackdrop: "Utiliser comme fond",
  currentBackdrop: "Ton fond",
  backdropChosenToast: "Fond mis à jour",
  backdropChosenToastSub: "Ce fond s'affichera sur la page du film ou de la série et dans la recherche.",
  backdropResetToast: "Retour au fond par défaut",
  backdropFullToast: (max) => `Tu peux choisir jusqu'à ${max} fonds`,
  chosenBackdropBadge: "Fond sélectionné",
  premiumTag: "Premium",
};
const ja = {
  useAsPoster: "ポスターに使う",
  currentPoster: "あなたのポスター",
  resetPoster: "デフォルトに戻す",
  chosenToast: "ポスターを更新しました",
  chosenToastSub: "このポスターはライブラリ、リスト、プロフィールに表示されます。",
  resetToast: "デフォルトのポスターに戻す",
  fullToast: (max) => `選べるポスターは最大${max}枚です`,
  fullToastSub: "新しく選ぶには、別の作品をデフォルトに戻してください。",
  signInNeeded: "ポスターを選ぶにはサインイン",
  chosenBadge: "選択したポスター",
  useAsBackdrop: "背景画像に使う",
  currentBackdrop: "あなたの背景画像",
  backdropChosenToast: "背景画像を更新しました",
  backdropChosenToastSub: "この背景画像は映画・番組のページと検索に表示されます。",
  backdropResetToast: "デフォルトの背景画像に戻す",
  backdropFullToast: (max) => `選べる背景画像は最大${max}枚です`,
  chosenBackdropBadge: "選択した背景画像",
  premiumTag: "Premium",
};

export const POSTER_CHOICES_COPY = Object.freeze({ tr, en, es, pt, de ,
  it: it,
  fr,
  ja});

/** Uygulama diline göre metin tablosu (bilinmeyen dil → İngilizce). */
export const getPosterChoicesCopy = (language) =>
  POSTER_CHOICES_COPY[copyLanguage(language, Object.keys(POSTER_CHOICES_COPY))];
