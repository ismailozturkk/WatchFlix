// screens/tabs/profile/listVisibilityCopy.js
//
// "Profilinde görünen listeler" ekranının ve Gizlilik ayarlarındaki giriş satırının
// metinleri (5 dil). Sayı içeren metinler işlev: İngilizce/İspanyolca/Portekizce
// tekil-çoğul ayrımı ister. Beş dilin eşitliğini __tests__/copyTablesSpanish.test.js
// korur.
//
// Metin, ayarın ne YAPTIĞINI söyler (profilde gösterilir/gösterilmez); sunucu
// tarafı erişim sözü VERMEZ — liste-başına ayrım kuralda yok (utils/listVisibility.js).

import { copyLanguage } from "../../../utils/appLanguages";

const tr = {
  title: "Görünen listeler",
  rowTitle: "Profilinde görünen listeler",
  rowSub: (shown, total) => `${shown} / ${total} liste açık`,
  intro:
    "Profiline bakan biri hangi listelerini görebilsin? Kapattığın liste profilinde gösterilmez; sen listelerinin tamamını her zaman görürsün.",
  whoLabel: "KİM GÖREBİLİR?",
  audience: { public: "Herkes", friends: "Arkadaşlar", private: "Yalnız ben" },
  audienceNote: {
    public: "Açık listelerin, profiline bakan herkese görünür.",
    friends: "Açık listelerin yalnızca arkadaşlarına görünür.",
    private: "Şu an listelerin kimseye görünmüyor. Aşağıdaki seçimin, bunu değiştirdiğinde geçerli olur.",
  },
  limitedNote: {
    friends: "Profilin yalnızca arkadaşlarına açık; bu yüzden listelerin de yalnızca onlara görünür.",
    private: "Profilin gizli; bu yüzden listelerin de kimseye görünmüyor.",
  },
  whichLabel: "HANGİ LİSTELER?",
  shownCount: (shown, total) => `${shown} / ${total} açık`,
  showAll: "Tümünü aç",
  hideAll: "Tümünü kapat",
  shownSub: (n) => `${n} içerik · profilinde görünür`,
  emptySub: "Boş · içerik ekleyince profilinde görünür",
  hiddenSub: (n) => `${n} içerik · yalnız sen görürsün`,
  footer:
    "Yeni oluşturduğun listeler açık başlar. Kapattığın listeler, arkadaşlarının seninle zevk uyumu hesabına da girmez. Hiçbir listenin görünmesini istemiyorsan yukarıdan “Yalnız ben”i seç.",
  saveFailed: "Ayar kaydedilemedi",
};

const en = {
  title: "Visible lists",
  rowTitle: "Lists on your profile",
  rowSub: (shown, total) => `${shown} of ${total} ${total === 1 ? "list" : "lists"} shown`,
  intro:
    "Choose which of your lists people can see when they open your profile. A list you turn off isn't shown on your profile; you always see all of your lists.",
  whoLabel: "WHO CAN SEE THEM?",
  audience: { public: "Everyone", friends: "Friends", private: "Only me" },
  audienceNote: {
    public: "Lists you turn on are visible to anyone who views your profile.",
    friends: "Lists you turn on are visible to your friends only.",
    private: "Right now no one can see your lists. Your choices below apply once you change this.",
  },
  limitedNote: {
    friends: "Your profile is visible to friends only, so your lists are too.",
    private: "Your profile is private, so no one can see your lists.",
  },
  whichLabel: "WHICH LISTS?",
  shownCount: (shown, total) => `${shown} of ${total} on`,
  showAll: "Turn all on",
  hideAll: "Turn all off",
  shownSub: (n) => `${n} ${n === 1 ? "title" : "titles"} · shown on your profile`,
  emptySub: "Empty · appears on your profile once you add titles",
  hiddenSub: (n) => `${n} ${n === 1 ? "title" : "titles"} · only you can see it`,
  footer:
    "New lists start out visible. Lists you turn off are also left out of your friends' taste match with you. If you don't want any list to be visible, choose “Only me” above.",
  saveFailed: "Couldn't save the setting",
};

const es = {
  title: "Listas visibles",
  rowTitle: "Listas en tu perfil",
  rowSub: (shown, total) => `${shown} de ${total} ${total === 1 ? "lista visible" : "listas visibles"}`,
  intro:
    "Elige qué listas puede ver quien abra tu perfil. Una lista desactivada no se muestra en tu perfil; tú siempre ves todas tus listas.",
  whoLabel: "¿QUIÉN PUEDE VERLAS?",
  audience: { public: "Todos", friends: "Amigos", private: "Solo yo" },
  audienceNote: {
    public: "Las listas activadas son visibles para cualquiera que vea tu perfil.",
    friends: "Las listas activadas solo son visibles para tus amigos.",
    private: "Ahora mismo nadie puede ver tus listas. Lo que elijas abajo se aplicará cuando cambies esto.",
  },
  limitedNote: {
    friends: "Tu perfil solo es visible para tus amigos, así que tus listas también.",
    private: "Tu perfil es privado, así que nadie puede ver tus listas.",
  },
  whichLabel: "¿QUÉ LISTAS?",
  shownCount: (shown, total) => `${shown} de ${total} activadas`,
  showAll: "Activar todas",
  hideAll: "Desactivar todas",
  shownSub: (n) => `${n} ${n === 1 ? "título" : "títulos"} · visible en tu perfil`,
  emptySub: "Vacía · aparecerá en tu perfil cuando añadas títulos",
  hiddenSub: (n) => `${n} ${n === 1 ? "título" : "títulos"} · solo tú la ves`,
  footer:
    "Las listas nuevas empiezan visibles. Las listas desactivadas tampoco cuentan en la afinidad de gustos de tus amigos contigo. Si no quieres que se vea ninguna lista, elige «Solo yo» arriba.",
  saveFailed: "No se pudo guardar el ajuste",
};

const pt = {
  title: "Listas visíveis",
  rowTitle: "Listas no seu perfil",
  rowSub: (shown, total) => `${shown} de ${total} ${total === 1 ? "lista visível" : "listas visíveis"}`,
  intro:
    "Escolha quais listas as pessoas podem ver ao abrir o seu perfil. Uma lista desativada não aparece no seu perfil; você sempre vê todas as suas listas.",
  whoLabel: "QUEM PODE VER?",
  audience: { public: "Todos", friends: "Amigos", private: "Só eu" },
  audienceNote: {
    public: "As listas ativadas ficam visíveis para quem vê o seu perfil.",
    friends: "As listas ativadas ficam visíveis só para seus amigos.",
    private: "No momento ninguém vê suas listas. O que você escolher abaixo vale quando mudar isso.",
  },
  limitedNote: {
    friends: "Seu perfil é visível só para amigos, então suas listas também.",
    private: "Seu perfil é privado, então ninguém vê suas listas.",
  },
  whichLabel: "QUAIS LISTAS?",
  shownCount: (shown, total) => `${shown} de ${total} ativadas`,
  showAll: "Ativar todas",
  hideAll: "Desativar todas",
  shownSub: (n) => `${n} ${n === 1 ? "título" : "títulos"} · aparece no seu perfil`,
  emptySub: "Vazia · aparece no seu perfil quando você adicionar títulos",
  hiddenSub: (n) => `${n} ${n === 1 ? "título" : "títulos"} · só você vê`,
  footer:
    "Listas novas começam visíveis. Listas desativadas também ficam de fora da afinidade de gostos dos seus amigos com você. Se não quiser que nenhuma lista apareça, escolha “Só eu” acima.",
  saveFailed: "Não foi possível salvar a configuração",
};

const de = {
  title: "Sichtbare Listen",
  rowTitle: "Listen in deinem Profil",
  rowSub: (shown, total) => `${shown} von ${total} ${total === 1 ? "Liste" : "Listen"} sichtbar`,
  intro:
    "Wähle, welche Listen andere sehen, wenn sie dein Profil öffnen. Eine ausgeschaltete Liste wird in deinem Profil nicht angezeigt; du selbst siehst immer alle deine Listen.",
  whoLabel: "WER DARF SIE SEHEN?",
  audience: { public: "Alle", friends: "Freunde", private: "Nur ich" },
  audienceNote: {
    public: "Eingeschaltete Listen sieht jeder, der dein Profil ansieht.",
    friends: "Eingeschaltete Listen sehen nur deine Freunde.",
    private: "Im Moment sieht niemand deine Listen. Deine Auswahl unten gilt, sobald du das änderst.",
  },
  limitedNote: {
    friends: "Dein Profil ist nur für Freunde sichtbar, deshalb auch deine Listen.",
    private: "Dein Profil ist privat, deshalb sieht niemand deine Listen.",
  },
  whichLabel: "WELCHE LISTEN?",
  shownCount: (shown, total) => `${shown} von ${total} an`,
  showAll: "Alle einschalten",
  hideAll: "Alle ausschalten",
  shownSub: (n) => `${n} Titel · in deinem Profil sichtbar`,
  emptySub: "Leer · erscheint in deinem Profil, sobald du Titel hinzufügst",
  hiddenSub: (n) => `${n} Titel · nur für dich sichtbar`,
  footer:
    "Neue Listen sind zunächst sichtbar. Ausgeschaltete Listen zählen auch nicht beim Geschmacks-Match deiner Freunde mit dir. Wenn keine Liste sichtbar sein soll, wähle oben „Nur ich“.",
  saveFailed: "Einstellung konnte nicht gespeichert werden",
};

export const LIST_VISIBILITY_COPY = Object.freeze({ tr, en, es, pt, de });

/** Uygulama diline göre metin tablosu (bilinmeyen dil → İngilizce). */
export const getListVisibilityCopy = (language) =>
  LIST_VISIBILITY_COPY[copyLanguage(language, Object.keys(LIST_VISIBILITY_COPY))];
