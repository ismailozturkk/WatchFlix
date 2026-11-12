// utils/premiumFeatures.js
//
// PREMIUM YETKİLERİNİN TEK KAYNAĞI.
//
// Neden tek dosya: 12 Ağustos'ta (P0.2) ödeme ekranı, uygulamada karşılığı
// olmayan vaatler ("reklamsız", "tüm Wrapped yılları", "sınırsız liste")
// gösterdiği için temizlenmişti; bir sonraki tasarım turunda aynı vaatler geri
// geldi. Kök neden vaat metni ile yetki kapısının ayrı yerlerde yaşamasıydı.
// Artık:
//   • Her ücretli fark burada BİR girdi: plan başına limit + ekranda görünen metin.
//   • Kapılar (hooks/usePremiumGate.js) limiti buradan okur.
//   • Ödeme ekranı, Ayarlar kartı ve Hakkında SSS'i metni buradan üretir.
// Burada olmayan bir şey satılamaz; burada olan her şeyin bir kapısı vardır.
//
// Sunucuda zorlanan limitlerin (AI kotası, platform bildirimleri) aynası
// functions/ altındadır; eşitliği __tests__/premiumFeatures.test.js doğrular.
//
// Bu modül SAF: React, depolama veya ağ import etmez (testlerde doğrudan
// çalışır, typographySettings gibi React dışı store'lar da kullanabilir).

import {
  AI_PLAN_LIMITS,
  PREMIUM_PLAN,
  getPremiumPlanDisplayName,
} from "./premium";
import {
  copyLanguage,
  intlLocaleOf,
  normalizeAppLanguage,
  pickByLanguage,
} from "./appLanguages";

export const UNLIMITED = Infinity;

const PLAN_ORDER = Object.freeze([
  PREMIUM_PLAN.FREE,
  PREMIUM_PLAN.PREMIUM,
  PREMIUM_PLAN.UNLIMITED,
]);

export const PLANS = PLAN_ORDER;

export function normalizePlan(plan) {
  return PLAN_ORDER.includes(plan) ? plan : PREMIUM_PLAN.FREE;
}

export function planRank(plan) {
  return PLAN_ORDER.indexOf(normalizePlan(plan));
}

/** İki plandan yüksek olanı döner (bilinmeyen değer free sayılır). */
export function higherPlan(left, right) {
  return planRank(left) >= planRank(right)
    ? normalizePlan(left)
    : normalizePlan(right);
}

export const FEATURE_KIND = Object.freeze({
  /** Aç/kapa: minPlan ve üstü kullanır. */
  ACCESS: "access",
  /**
   * Toplam adet: sahip olunan liste/arkadaş/grup sayısı. `window: true` olan
   * girdi (Wrapped arşivi) harcanan bir miktar değil geriye doğru görülebilen
   * yıl penceresidir: sayaç/gösterge çizilmez, etiketi `planValue`dan gelir.
   * `perItem: true` olan girdi (not / madde uzunluğu) TEK kaydın tavanıdır: kapı
   * `used` olarak o anki metnin uzunluğunu sorar; Kullanım ekranında sayaç yok.
   */
  COUNT: "count",
  /** Günlük hak: yerel gün değişince sıfırlanır. */
  DAILY: "daily",
  // COUNT/DAILY'de bir planın limiti 0 olabilir: özellik o planda KAPALIDIR
  // (ör. Free'de oyun). Kapalılık `isLockedFor` ile sorulur; ekranlar "limit
  // doldu" yerine "Premium özelliği" konuşur.
  /** Günlük + aylık mesaj kotası; sunucuda (functions/aiQuota.js) zorlanır. */
  AI_QUOTA: "ai_quota",
});

const { ACCESS, COUNT, DAILY, AI_QUOTA } = FEATURE_KIND;

export const FEATURE_CATEGORIES = Object.freeze([
  {
    id: "ai",
    icon: "sparkles",
    color: "#8B5CF6",
    title: { tr: "CineMatch AI", en: "CineMatch AI", es: "CineMatch IA", pt: "CineMatch IA", de: "CineMatch KI" , it: "CineMatch AI"},
  },
  {
    id: "social",
    icon: "people",
    color: "#EC4899",
    title: { tr: "Sosyal", en: "Social", es: "Social", pt: "Social", de: "Soziales" , it: "Social"},
  },
  {
    id: "library",
    icon: "albums",
    color: "#10B981",
    title: { tr: "Kütüphane", en: "Library", es: "Biblioteca", pt: "Biblioteca", de: "Bibliothek" , it: "La mia libreria"},
  },
  {
    id: "notes",
    icon: "document-text",
    color: "#14B8A6",
    title: { tr: "Notlar", en: "Notes", es: "Notas", pt: "Notas", de: "Notizen" , it: "Note"},
  },
  {
    id: "play",
    icon: "game-controller",
    color: "#3B82F6",
    title: { tr: "Oyun, CineSwipe & Turnuva", en: "Games, CineSwipe & Tournament", es: "Juegos, CineSwipe y torneo", pt: "Jogos, CineSwipe e torneio", de: "Spiele, CineSwipe & Turnier" , it: "Giochi, CineSwipe e tornei"},
  },
  {
    id: "personal",
    icon: "color-palette",
    color: "#F59E0B",
    title: { tr: "Kişiselleştirme", en: "Personalization", es: "Personalización", pt: "Personalização", de: "Personalisierung" , it: "Personalizzazione"},
  },
  {
    id: "alerts",
    icon: "notifications",
    color: "#06B6D4",
    title: { tr: "Bildirim & Arşiv", en: "Alerts & Archive", es: "Avisos y archivo", pt: "Avisos e arquivo", de: "Benachrichtigungen & Archiv" , it: "Avvisi e archivio"},
  },
  {
    id: "support",
    icon: "chatbubble-ellipses",
    color: "#EF4444",
    title: { tr: "Destek & Geri bildirim", en: "Support & Feedback", es: "Soporte y comentarios", pt: "Suporte e feedback", de: "Support & Feedback" , it: "Supporto e feedback"},
  },
]);

/**
 * Ücretsiz yazı tipleri: her rol (başlık / gövde / rakam) için en az iki
 * okunaklı seçenek. Geri kalan katalog Premium'dadır.
 */
export const FREE_FONT_PRESET_IDS = Object.freeze([
  "system",
  "barlow",
  "lexend",
  "bitter",
  "spaceMono",
  "oswald",
  "playfairDisplay",
]);

/** Katalogdaki toplam yazı tipi sayısı (utils/typographyRoles.js FONT_PRESETS). */
export const FONT_CATALOG_SIZE = 56;

/**
 * Free'nin seçebildiği hazır tema sayısı: 3 aile (Varsayılan, Mavi, Yeşil) x 5 ton
 * (çok açık · açık · orta · koyu · AMOLED) — theme/colors.js `FAMILY_THEME_KEYS`,
 * theme/toneModel.js `TONES`. Gece Moru / Kızıl Sinema artık Tema Stüdyosu'nun
 * (Premium) "Hazır temalar" bölümünde.
 */
export const PRESET_THEME_COUNT = 15;

/**
 * Wrapped arşivinde GÖRÜLEBİLEN yıl sayısı, bu yıl DAHİL: Free yalnız bu yılı,
 * Premium son 5 yılı görür; Premium Max'te sınır yok. Kayıttaki `wrapped_archive`
 * limitleri ve karşılaştırma metinleri buradan türer.
 */
export const WRAPPED_YEARS_VISIBLE = Object.freeze({ free: 1, premium: 5 });

/** "1.000" / "1,000" — dört basamaklı limitler (harf sınırları) dilin biçiminde. */
const grouped = (n, language) =>
  Number.isFinite(n) ? n.toLocaleString(intlLocaleOf(normalizeAppLanguage(language))) : String(n);

const feature = (definition) =>
  Object.freeze({
    note: null,
    detail: null,
    // Yükseltme sayfasının (components/premium) özelliğe özel metni. Her girdi
    // için zorunlu — bkz. __tests__/premiumFeatures.test.js.
    upsell: null,
    enforcedBy: "client",
    ...definition,
  });

export const PREMIUM_FEATURES = Object.freeze({
  ai_messages: feature({
    id: "ai_messages",
    kind: AI_QUOTA,
    category: "ai",
    icon: "sparkles",
    enforcedBy: "server",
    limits: AI_PLAN_LIMITS,
    title: { tr: "CineMatch AI mesajı", en: "CineMatch AI messages", es: "Mensajes de CineMatch IA", pt: "Mensagens do CineMatch IA", de: "CineMatch-KI-Nachrichten" , it: "Messaggi CineMatch AI"},
    upsell: {
      title: { tr: "Bugünkü AI mesaj hakkın bitti", en: "You're out of AI messages for today", es: "Se te han acabado los mensajes de IA de hoy", pt: "Suas mensagens de IA de hoje acabaram", de: "Du hast keine KI-Nachrichten mehr für heute" , it: "Hai esaurito i messaggi AI per oggi"},
    },
    detail: {
      tr: "Ruh haline ve izleme geçmişine göre film/dizi önerileri",
      en: "Movie and TV picks based on your mood and watch history",
      es: "Recomendaciones de películas y series según tu estado de ánimo y tu historial",
      pt: "Recomendações de filmes e séries de acordo com o seu humor e o seu histórico",
      de: "Film- und Serientipps nach deiner Stimmung und deinem Sehverlauf",

  it: "Scelte di film e TV in base al tuo umore e alla cronologia visualizzazioni"},
    phrase: {
      tr: (n) => `günde ${n} CineMatch AI mesajı gönderebilirsin`,
      en: (n) => `you can send ${n} CineMatch AI messages per day`,
      es: (n) => `puedes enviar ${n} mensajes de IA de CineMatch al día`,
      pt: (n) => `você pode enviar ${n} mensagens de IA do CineMatch por dia`,
      de: (n) => `du kannst ${n} CineMatch-KI-Nachrichten pro Tag senden`,

  it: n => `puoi inviare ${n} messaggi AI CineMatch al giorno`},
  }),
  identity_badge: feature({
    id: "identity_badge",
    kind: ACCESS,
    category: "social",
    icon: "diamond",
    enforcedBy: "server",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Profil kimlik rozeti", en: "Profile identity badge", es: "Insignia de identidad del perfil", pt: "Emblema de identidade do perfil", de: "Profil-Identitätsabzeichen" , it: "Badge identità del profilo"},
    upsell: {
      title: { tr: "Profil rozeti Premium'da", en: "The profile badge is a Premium perk", es: "La insignia del perfil es una ventaja Premium", pt: "O emblema do perfil é um benefício Premium", de: "Das Profilabzeichen ist ein Premium-Vorteil" , it: "Il badge del profilo è un vantaggio Premium"},
      message: {
        tr: "Profilinde ve arkadaşlarının gördüğü sayfada parlayan bir kimlik rozeti kazan.",
        en: "Get a badge that shines on your profile and on the page your friends see.",
        es: "Consigue una insignia que luce en tu perfil y en la página que ven tus amigos.",
        pt: "Ganhe um emblema que brilha no seu perfil e na página que seus amigos veem.",
        de: "Hol dir ein Abzeichen, das in deinem Profil und auf der Seite deiner Freunde glänzt.",

  it: "Ricevi un badge che risalta sul tuo profilo e sulla pagina visualizzata dai tuoi amici."},
    },
    detail: {
      tr: "Profilinde ve arkadaşlarının gördüğü profil sayfanda",
      en: "On your profile and on the profile your friends see",
      es: "En tu perfil y en el perfil que ven tus amigos",
      pt: "No seu perfil e no perfil que seus amigos veem",
      de: "In deinem Profil und auf dem Profil, das deine Freunde sehen",

  it: "Sul tuo profilo e sul profilo visualizzato dai tuoi amici"},
    planValue: {
      [PREMIUM_PLAN.PREMIUM]: { tr: "Epik rozet", en: "Epic badge", es: "Insignia épica", pt: "Emblema épico", de: "Episches Abzeichen" , it: "Badge Epic"},
      [PREMIUM_PLAN.UNLIMITED]: { tr: "Efsanevi rozet", en: "Legendary badge", es: "Insignia legendaria", pt: "Emblema lendário", de: "Legendäres Abzeichen" , it: "Badge leggendario"},
    },
  }),
  friends: feature({
    id: "friends",
    kind: COUNT,
    category: "social",
    icon: "person-add",
    limits: { free: 2, premium: 150, unlimited: UNLIMITED },
    title: { tr: "Arkadaş", en: "Friends", es: "Amigos", pt: "Amigos", de: "Freunde" , it: "Amici"},
    upsell: {
      title: { tr: "Arkadaş listen doldu", en: "Your friends list is full", es: "Tu lista de amigos está llena", pt: "Sua lista de amigos está cheia", de: "Deine Freundesliste ist voll" , it: "La tua lista di amici è piena"},
    },
    unit: { tr: "arkadaş", en: "friends", es: "amigos", pt: "amigos", de: "Freunde" , it: "amici"},
    note: {
      tr: "Gelen istekleri kabul etmek her zaman serbest",
      en: "Accepting incoming requests is always free",
      es: "Aceptar las solicitudes recibidas siempre es gratis",
      pt: "Aceitar os pedidos recebidos é sempre grátis",
      de: "Eingehende Anfragen anzunehmen ist immer kostenlos",

  it: "Accettare le richieste in arrivo è sempre gratuito"},
    phrase: {
      tr: (n) => `en fazla ${n} arkadaş ekleyebilirsin`,
      en: (n) => `you can add up to ${n} friends`,
      es: (n) => `puedes añadir hasta ${n} amigos`,
      pt: (n) => `você pode adicionar até ${n} amigos`,
      de: (n) => `du kannst bis zu ${n} Freunde hinzufügen`,

  it: n => `puoi aggiungere fino a ${n} amici`},
  }),
  chat_groups: feature({
    id: "chat_groups",
    kind: COUNT,
    category: "social",
    icon: "chatbubbles",
    limits: { free: 1, premium: 10, unlimited: UNLIMITED },
    title: { tr: "Kurduğun sohbet grubu", en: "Group chats you create", es: "Chats de grupo que creas", pt: "Conversas em grupo que você cria", de: "Von dir erstellte Gruppenchats" , it: "Chat di gruppo create da te"},
    upsell: {
      title: { tr: "Grup kurma limitin doldu", en: "You've reached your group limit", es: "Has alcanzado tu límite de grupos", pt: "Você atingiu seu limite de grupos", de: "Du hast dein Gruppenlimit erreicht" , it: "Hai raggiunto il limite del tuo gruppo"},
    },
    unit: { tr: "grup", en: "groups", es: "grupos", pt: "grupos", de: "Gruppen" , it: "gruppi"},
    note: {
      tr: "Birebir mesajlaşmak ve gruplara katılmak serbest",
      en: "Direct messages and joining groups are free",
      es: "Los mensajes directos y unirte a grupos son gratis",
      pt: "Mensagens diretas e entrar em grupos são grátis",
      de: "Direktnachrichten und das Beitreten zu Gruppen sind kostenlos",

  it: "I messaggi diretti e l'iscrizione ai gruppi sono gratuiti"},
    phrase: {
      tr: (n) => `en fazla ${n} sohbet grubu kurabilirsin`,
      en: (n) => `you can create up to ${n} group chat${n === 1 ? "" : "s"}`,
      es: (n) => `puedes crear hasta ${n} ${n === 1 ? "chat de grupo" : "chats de grupo"}`,
      pt: (n) => `você pode criar até ${n} ${n === 1 ? "conversa em grupo" : "conversas em grupo"}`,
      de: (n) => `du kannst bis zu ${n} ${n === 1 ? "Gruppenchat" : "Gruppenchats"} erstellen`,

  it: n => `puoi creare fino a ${n} chat di gruppo${n === 1 ? "" : "s"}`},
  }),
  // Film Kulübü (docs/ozellikler/FILM_KULUBU.md) — 30 Eki kullanıcı kararı: kulüp KURMAK Premium; katılmak, oy
  // vermek, izledim/puan ve tartışma herkese açık (KURAL: işi başlatan sayılır). Kurulu kulübün turları kurucunun
  // planı düşse de sürer; kapatmak her planda serbest. Sunucu aynası: firestore.rules groups/{gid}.club dalı
  // (isPaidPlan).
  film_club: feature({
    id: "film_club",
    kind: ACCESS,
    category: "social",
    icon: "ticket",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Film Kulübü", en: "Film Club", es: "Club de Cine", pt: "Clube de Cinema", de: "Filmclub" , it: "Film Club"},
    upsell: {
      title: { tr: "Film Kulübü Premium'da", en: "Film Club is a Premium perk", es: "Club de Cine es una ventaja Premium", pt: "O Clube de Cinema é um benefício Premium", de: "Filmclub ist ein Premium-Vorteil" , it: "Film Club è un vantaggio Premium"},
      message: {
        tr: "Grubunu kulübe çevir: her tur adayları oylayın, kazanan filmi izleyin, izleyenler spoiler'sız tartışsın. Üyeler ücretsiz katılır.",
        en: "Turn your group into a club: vote on picks each round, watch the winner and discuss it spoiler-free. Members join for free.",
        es: "Convierte tu grupo en un club: votad candidatas cada ronda, ved la ganadora y debatid sin spoilers. Los miembros entran gratis.",
        pt: "Transforme seu grupo num clube: votem nos indicados a cada rodada, assistam ao vencedor e debatam sem spoiler. Membros entram de graça.",
        de: "Mach deine Gruppe zum Club: Stimmt jede Runde ab, schaut den Gewinner und diskutiert spoilerfrei. Mitglieder machen kostenlos mit.",

  it: "Trasforma il tuo gruppo in un club: vota le scelte a ogni turno, guarda il vincitore e discuti senza spoiler. I membri si iscrivono gratuitamente."},
    },
    detail: {
      tr: "Grup için oylama, izleme turu, puan ve tartışma",
      en: "Group votes, watch rounds, ratings and discussion",
      es: "Votaciones de grupo, rondas, notas y debate",
      pt: "Votações em grupo, rodadas, notas e debate",
      de: "Gruppenabstimmung, Filmrunden, Bewertungen und Diskussion",

  it: "Votazioni di gruppo, turni di visione, valutazioni e discussioni"},
    freeValue: { tr: "Katılım", en: "Join only", es: "Solo unirse", pt: "Só participar", de: "Nur mitmachen" , it: "Solo iscrizione"},
    paidValue: { tr: "Kulüp kur", en: "Start clubs", es: "Crear clubes", pt: "Criar clubes", de: "Clubs gründen" , it: "Crea club"},
  }),
  custom_lists: feature({
    id: "custom_lists",
    kind: COUNT,
    category: "library",
    icon: "list",
    limits: { free: 1, premium: 25, unlimited: UNLIMITED },
    title: { tr: "Özel liste", en: "Custom lists", es: "Listas personalizadas", pt: "Listas personalizadas", de: "Eigene Listen" , it: "Elenchi personalizzati"},
    upsell: {
      title: { tr: "Liste limitin doldu", en: "You've reached your list limit", es: "Has alcanzado tu límite de listas", pt: "Você atingiu seu limite de listas", de: "Du hast dein Listenlimit erreicht" , it: "Hai raggiunto il limite della tua lista"},
    },
    unit: { tr: "liste", en: "lists", es: "listas", pt: "listas", de: "Listen" , it: "elenchi"},
    note: {
      tr: "İzleme listesi, izlenenler (film/dizi) ve favoriler her planda sınırsız",
      en: "Watchlist, watched (movies/shows) and favorites are unlimited on every plan",
      es: "La lista de seguimiento, lo visto (películas y series) y los favoritos son ilimitados en todos los planes",
      pt: "A lista para assistir, os assistidos (filmes e séries) e os favoritos são ilimitados em todos os planos",
      de: "Merkliste, Gesehenes (Filme/Serien) und Favoriten sind in jedem Plan unbegrenzt",

  it: "Lista di titoli, guardati (film/serie TV) e preferiti sono illimitati su ogni piano"},
    phrase: {
      tr: (n) => `en fazla ${n} özel liste oluşturabilirsin`,
      en: (n) => `you can create up to ${n} custom list${n === 1 ? "" : "s"}`,
      es: (n) => `puedes crear hasta ${n} ${n === 1 ? "lista personalizada" : "listas personalizadas"}`,
      pt: (n) => `você pode criar até ${n} ${n === 1 ? "lista personalizada" : "listas personalizadas"}`,
      de: (n) => `du kannst bis zu ${n} ${n === 1 ? "eigene Liste" : "eigene Listen"} erstellen`,

  it: n => `puoi creare fino a ${n} elenco personalizzato${n === 1 ? "" : "s"}`},
  }),
  shared_lists: feature({
    id: "shared_lists",
    kind: COUNT,
    category: "library",
    icon: "people-circle",
    limits: { free: 2, premium: 10, unlimited: UNLIMITED },
    title: { tr: "Kurduğun ortak liste", en: "Shared lists you create", es: "Listas compartidas que creas", pt: "Listas compartilhadas que você cria", de: "Von dir erstellte gemeinsame Listen" , it: "Elenchi condivisi creati da te"},
    upsell: {
      title: { tr: "Ortak liste limitin doldu", en: "You've reached your shared list limit", es: "Has alcanzado tu límite de listas compartidas", pt: "Você atingiu seu limite de listas compartilhadas", de: "Du hast dein Limit für gemeinsame Listen erreicht" , it: "Hai raggiunto il limite di elenchi condivisi"},
    },
    unit: { tr: "liste", en: "lists", es: "listas", pt: "listas", de: "Listen" , it: "elenchi"},
    note: {
      tr: "Davet edildiğin listelere katılmak serbest",
      en: "Joining lists you're invited to is free",
      es: "Unirte a las listas a las que te inviten es gratis",
      pt: "Entrar nas listas para as quais você é convidado é grátis",
      de: "Das Beitreten zu Listen, zu denen du eingeladen wirst, ist kostenlos",

  it: "La partecipazione agli elenchi a cui sei stato invitato è gratuita"},
    phrase: {
      tr: (n) => `en fazla ${n} ortak liste kurabilirsin`,
      en: (n) => `you can create up to ${n} shared lists`,
      es: (n) => `puedes crear hasta ${n} listas compartidas`,
      pt: (n) => `você pode criar até ${n} listas compartilhadas`,
      de: (n) => `du kannst bis zu ${n} gemeinsame Listen erstellen`,

  it: n => `puoi creare fino a ${n} elenchi condivisi`},
  }),
  notes: feature({
    id: "notes",
    kind: COUNT,
    category: "notes",
    icon: "document-text",
    limits: { free: 5, premium: 50, unlimited: UNLIMITED },
    title: { tr: "Not", en: "Notes", es: "Notas", pt: "Notas", de: "Notizen" , it: "Note"},
    upsell: {
      title: { tr: "Not limitin doldu", en: "You've reached your notes limit", es: "Has alcanzado tu límite de notas", pt: "Você atingiu seu limite de notas", de: "Du hast dein Notizen-Limit erreicht" , it: "Hai raggiunto il limite di note"},
    },
    unit: { tr: "not", en: "notes", es: "notas", pt: "notas", de: "Notizen" , it: "note"},
    note: {
      tr: "Mevcut notlarını düzenlemek ve silmek her zaman serbest",
      en: "Editing and deleting your notes is always free",
      es: "Editar y eliminar tus notas siempre es gratis",
      pt: "Editar e excluir suas notas é sempre grátis",
      de: "Das Bearbeiten und Löschen deiner Notizen ist immer kostenlos",

  it: "La modifica e l'eliminazione delle tue note sono sempre gratuite"},
    phrase: {
      tr: (n) => `en fazla ${n} not tutabilirsin`,
      en: (n) => `you can keep up to ${n} notes`,
      es: (n) => `puedes guardar hasta ${n} notas`,
      pt: (n) => `você pode guardar até ${n} notas`,
      de: (n) => `du kannst bis zu ${n} Notizen behalten`,

  it: n => `puoi conservare fino a ${n} note`},
  }),
  todos: feature({
    id: "todos",
    kind: COUNT,
    category: "notes",
    icon: "checkbox",
    limits: { free: 5, premium: 50, unlimited: UNLIMITED },
    title: { tr: "Yapılacaklar listesi", en: "To-do lists", es: "Listas de tareas", pt: "Listas de tarefas", de: "Aufgabenlisten" , it: "elenchi di cose da fare"},
    upsell: {
      title: { tr: "Yapılacaklar limitin doldu", en: "You've reached your to-do limit", es: "Has alcanzado tu límite de tareas", pt: "Você atingiu seu limite de tarefas", de: "Du hast dein Aufgaben-Limit erreicht" , it: "Hai raggiunto il limite di cose da fare"},
    },
    unit: { tr: "liste", en: "lists", es: "listas", pt: "listas", de: "Listen" , it: "elenchi"},
    note: {
      tr: "Bir listedeki madde sayısı sınırsız",
      en: "The number of items inside a list is unlimited",
      es: "El número de elementos dentro de una lista es ilimitado",
      pt: "O número de itens dentro de uma lista é ilimitado",
      de: "Die Anzahl der Einträge in einer Liste ist unbegrenzt",

  it: "Il numero di elementi all'interno di un elenco è illimitato"},
    phrase: {
      tr: (n) => `en fazla ${n} yapılacaklar listesi tutabilirsin`,
      en: (n) => `you can keep up to ${n} to-do lists`,
      es: (n) => `puedes tener hasta ${n} listas de tareas`,
      pt: (n) => `você pode ter até ${n} listas de tarefas`,
      de: (n) => `du kannst bis zu ${n} Aufgabenlisten behalten`,

  it: n => `puoi conservare fino a ${n} elenchi di cose da fare`},
  }),
  // Harf sınırları: TEK notun metni ve TEK yapılacak maddesi (başlık her planda 120).
  // Sınır yalnız büyümeyi durdurur; plan düşünce daha uzun eski kayıtlar kısalmaz
  // (utils/noteTextLimits.js). Max'te de sayı var: metin kutusu sınırsız uzunlukta
  // akıcı kalmaz, "Sınırsız" yazıp gizli bir tavan koymak vaadi bozardı.
  note_length: feature({
    id: "note_length",
    kind: COUNT,
    perItem: true,
    category: "notes",
    icon: "reader",
    limits: { free: 500, premium: 2000, unlimited: 20000 },
    title: { tr: "Not uzunluğu", en: "Note length", es: "Longitud de la nota", pt: "Tamanho da nota", de: "Notizlänge" , it: "Lunghezza della nota"},
    upsell: {
      title: { tr: "Not uzunluk sınırına ulaştın", en: "You've reached the note length limit", es: "Has alcanzado el límite de longitud de la nota", pt: "Você atingiu o limite de tamanho da nota", de: "Du hast die maximale Notizlänge erreicht" , it: "Hai raggiunto il limite di lunghezza della nota"},
    },
    unit: { tr: "karakter", en: "characters", es: "caracteres", pt: "caracteres", de: "Zeichen" , it: "caratteri"},
    note: {
      tr: "Daha uzun eski notların kısaltılmaz; düzenlemek her zaman serbest",
      en: "Longer existing notes are never cut; editing them is always free",
      es: "Las notas existentes más largas nunca se recortan; editarlas siempre es gratis",
      pt: "Notas existentes mais longas nunca são cortadas; editá-las é sempre grátis",
      de: "Längere vorhandene Notizen werden nie gekürzt; sie zu bearbeiten ist immer kostenlos",

  it: "Le note esistenti più lunghe non vengono mai tagliate; modificarli è sempre gratuito"},
    phrase: {
      tr: (n) => `bir not en fazla ${grouped(n, "tr")} karakter olabilir`,
      en: (n) => `a note can be up to ${grouped(n, "en")} characters long`,
      es: (n) => `una nota puede tener hasta ${grouped(n, "es")} caracteres`,
      pt: (n) => `uma nota pode ter até ${grouped(n, "pt")} caracteres`,
      de: (n) => `eine Notiz kann bis zu ${grouped(n, "de")} Zeichen lang sein`,

  it: n => `una nota può contenere fino a ${grouped(n, "en")} caratteri`},
  }),
  todo_item_length: feature({
    id: "todo_item_length",
    kind: COUNT,
    perItem: true,
    category: "notes",
    icon: "create",
    limits: { free: 180, premium: 360, unlimited: 1000 },
    title: { tr: "Yapılacak maddesi uzunluğu", en: "To-do item length", es: "Longitud de cada tarea", pt: "Tamanho de cada item", de: "Länge eines Aufgabeneintrags" , it: "Lunghezza elemento Cose da fare"},
    upsell: {
      title: { tr: "Madde uzunluk sınırına ulaştın", en: "You've reached the item length limit", es: "Has alcanzado el límite de longitud de la tarea", pt: "Você atingiu o limite de tamanho do item", de: "Du hast die maximale Eintragslänge erreicht" , it: "Hai raggiunto il limite di lunghezza dell'elemento"},
    },
    unit: { tr: "karakter", en: "characters", es: "caracteres", pt: "caracteres", de: "Zeichen" , it: "caratteri"},
    note: {
      tr: "Daha uzun eski maddeler kısaltılmaz; düzenlemek her zaman serbest",
      en: "Longer existing items are never cut; editing them is always free",
      es: "Las tareas existentes más largas nunca se recortan; editarlas siempre es gratis",
      pt: "Itens existentes mais longos nunca são cortados; editá-los é sempre grátis",
      de: "Längere vorhandene Einträge werden nie gekürzt; sie zu bearbeiten ist immer kostenlos",

  it: "Gli elementi esistenti più lunghi non vengono mai tagliati; modificarli è sempre gratuito"},
    phrase: {
      tr: (n) => `bir yapılacak maddesi en fazla ${grouped(n, "tr")} karakter olabilir`,
      en: (n) => `a to-do item can be up to ${grouped(n, "en")} characters long`,
      es: (n) => `cada tarea puede tener hasta ${grouped(n, "es")} caracteres`,
      pt: (n) => `cada item da lista pode ter até ${grouped(n, "pt")} caracteres`,
      de: (n) => `ein Aufgabeneintrag kann bis zu ${grouped(n, "de")} Zeichen lang sein`,

  it: n => `una cosa da fare può contenere fino a ${grouped(n, "en")} caratteri`},
  }),
  // Not / yapılacak HATIRLATICISI (gün + saat, cihaz bildirimi, yüzen bildirim, kutu).
  // Kapı yalnız KURMAYI durdurur: yeni hatırlatıcı, günü/saati değiştirmek ve
  // ertelemek. Kaldırmak her planda serbest; plan düşünce kurulu hatırlatıcılar
  // silinmez ve çalmaya devam eder (ProfileNotesContext saveNote ikinci kapı).
  note_reminders: feature({
    id: "note_reminders",
    kind: ACCESS,
    category: "notes",
    icon: "alarm",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Not hatırlatıcısı", en: "Note reminders", es: "Recordatorios de notas", pt: "Lembretes de notas", de: "Notiz-Erinnerungen" , it: "Promemoria note"},
    upsell: {
      title: { tr: "Hatırlatıcılar Premium'da", en: "Reminders are a Premium perk", es: "Los recordatorios son una ventaja Premium", pt: "Os lembretes são um benefício Premium", de: "Erinnerungen sind ein Premium-Vorteil" , it: "I promemoria sono un vantaggio Premium"},
      message: {
        tr: "Notlarına ve yapılacak listelerine gün ve saat seç; zamanı gelince yüzen bildirimde ve bildirim kutunda görünsün.",
        en: "Pick a day and time for your notes and to-do lists; see reminders in a floating notification and your inbox.",
        es: "Elige día y hora para tus notas y listas de tareas; verás los recordatorios en un aviso flotante y en tu bandeja.",
        pt: "Escolha dia e horário para suas notas e listas de tarefas; veja os lembretes em um aviso flutuante e na sua caixa de entrada.",
        de: "Wähle Tag und Uhrzeit für deine Notizen und Aufgabenlisten; sieh Erinnerungen als schwebende Benachrichtigung und im Posteingang.",

  it: "Scegli un giorno e un'ora per le tue note e le tue liste di cose da fare; visualizza i promemoria in una notifica mobile e nella tua casella di posta."},
    },
    detail: {
      tr: "Notlara ve yapılacaklara gün + saatli bildirim",
      en: "Notifications on a day and time for notes and to-dos",
      es: "Avisos con día y hora para notas y tareas",
      pt: "Avisos com dia e horário para notas e tarefas",
      de: "Benachrichtigungen mit Tag und Uhrzeit für Notizen und Aufgaben",

  it: "Notifiche su giorno e ora per note e cose da fare"},
    note: {
      tr: "Kurduğun hatırlatıcılar abonelik bitince de çalar; kaldırmak her zaman serbest",
      en: "Reminders you've set still go off if your subscription ends; removing them is always free",
      es: "Los recordatorios que creaste siguen sonando si termina tu suscripción; quitarlos siempre es gratis",
      pt: "Os lembretes que você criou continuam tocando se a assinatura acabar; removê-los é sempre grátis",
      de: "Gesetzte Erinnerungen bleiben aktiv, wenn dein Abo endet; sie zu entfernen ist immer kostenlos",

  it: "I promemoria che hai impostato si attivano anche se l'abbonamento scade; rimuoverli è sempre gratuito"},
    freeValue: { tr: "Kapalı", en: "Off", es: "Desactivado", pt: "Desativado", de: "Aus" , it: "Spento"},
    paidValue: { tr: "Gün ve saatle", en: "Day and time", es: "Día y hora", pt: "Dia e horário", de: "Tag und Uhrzeit" , it: "Giorno e ora"},
  }),
  movie_notes: feature({
    id: "movie_notes",
    kind: COUNT,
    category: "notes",
    icon: "film",
    limits: { free: 20, premium: 200, unlimited: UNLIMITED },
    title: { tr: "Film notu", en: "Movie notes", es: "Notas de películas", pt: "Notas de filmes", de: "Film-Notizen" , it: "Appunti sul film"},
    upsell: {
      title: { tr: "Film notu limitin doldu", en: "You've reached your movie notes limit", es: "Has alcanzado tu límite de notas de películas", pt: "Você atingiu seu limite de notas de filmes", de: "Du hast dein Limit für Film-Notizen erreicht" , it: "Hai raggiunto il limite delle note sul film"},
    },
    unit: { tr: "film", en: "movies", es: "películas", pt: "filmes", de: "Filme" , it: "film"},
    note: {
      tr: "Her film için tek not; mevcut notu düzenlemek serbest",
      en: "One note per movie; editing an existing note is free",
      es: "Una nota por película; editar una nota existente es gratis",
      pt: "Uma nota por filme; editar uma nota existente é grátis",
      de: "Eine Notiz pro Film; das Bearbeiten einer vorhandenen Notiz ist kostenlos",

  it: "Una nota per film; la modifica di una nota esistente è gratuita"},
    phrase: {
      tr: (n) => `en fazla ${n} filme not yazabilirsin`,
      en: (n) => `you can write notes for up to ${n} movies`,
      es: (n) => `puedes escribir notas para hasta ${n} películas`,
      pt: (n) => `você pode escrever notas para até ${n} filmes`,
      de: (n) => `du kannst Notizen für bis zu ${n} Filme schreiben`,

  it: n => `puoi scrivere note per un massimo di ${n} film`},
  }),
  tv_notes: feature({
    id: "tv_notes",
    kind: COUNT,
    category: "notes",
    icon: "tv",
    limits: { free: 20, premium: 200, unlimited: UNLIMITED },
    title: { tr: "Dizi notu", en: "Show notes", es: "Notas de series", pt: "Notas de séries", de: "Serien-Notizen" , it: "Mostra note"},
    upsell: {
      title: { tr: "Dizi notu limitin doldu", en: "You've reached your show notes limit", es: "Has alcanzado tu límite de notas de series", pt: "Você atingiu seu limite de notas de séries", de: "Du hast dein Limit für Serien-Notizen erreicht" , it: "Hai raggiunto il limite di note dello serie TV"},
    },
    unit: { tr: "dizi", en: "shows", es: "series", pt: "séries", de: "Serien" , it: "serie TV"},
    note: {
      tr: "Her dizi için tek not; mevcut notu düzenlemek serbest",
      en: "One note per show; editing an existing note is free",
      es: "Una nota por serie; editar una nota existente es gratis",
      pt: "Uma nota por série; editar uma nota existente é grátis",
      de: "Eine Notiz pro Serie; das Bearbeiten einer vorhandenen Notiz ist kostenlos",

  it: "Una nota per serie TV; la modifica di una nota esistente è gratuita"},
    phrase: {
      tr: (n) => `en fazla ${n} diziye not yazabilirsin`,
      en: (n) => `you can write notes for up to ${n} shows`,
      es: (n) => `puedes escribir notas para hasta ${n} series`,
      pt: (n) => `você pode escrever notas para até ${n} séries`,
      de: (n) => `du kannst Notizen für bis zu ${n} Serien schreiben`,

  it: n => `puoi scrivere note per un massimo di ${n} serie TV`},
  }),
  games: feature({
    id: "games",
    kind: DAILY,
    category: "play",
    icon: "game-controller",
    limits: { free: 0, premium: 20, unlimited: UNLIMITED },
    title: { tr: "Sahne tahmin oyunu", en: "Scene guess games", es: "Juegos de adivinar escenas", pt: "Jogos de adivinhar cenas", de: "Szenenraten-Spiele" , it: "Giochi di ipotesi di scene"},
    upsell: {
      // `title`: limit dolunca (Premium'da günlük hak bitti); `lockedTitle` +
      // `message`: planda hiç yokken (Free). Bkz. utils/premiumUpsellContent.js.
      title: { tr: "Bugünkü oyun hakkın bitti", en: "You're out of games for today", es: "Se te han acabado las partidas de hoy", pt: "Suas partidas de hoje acabaram", de: "Du hast keine Spiele mehr für heute" , it: "Per oggi hai finito i giochi"},
      lockedTitle: { tr: "Oyunlar Premium'da", en: "Games are a Premium perk", es: "Los juegos son una ventaja Premium", pt: "Os jogos são um benefício Premium", de: "Spiele sind ein Premium-Vorteil" , it: "I giochi sono un vantaggio Premium"},
      message: {
        tr: "Sahne tahmin oyunlarını, liderlik tablosunu ve istatistiklerini Premium ile aç.",
        en: "Unlock the scene guess games, leaderboards and stats with Premium.",
        es: "Desbloquea los juegos de adivinar escenas, las clasificaciones y las estadísticas con Premium.",
        pt: "Desbloqueie os jogos de adivinhar cenas, os rankings e as estatísticas com o Premium.",
        de: "Schalte mit Premium die Szenenraten-Spiele, Bestenlisten und Statistiken frei.",

  it: "Sblocca i giochi di ipotesi, le classifiche e le statistiche della scena con Premium."},
    },
    unit: { tr: "oyun", en: "games", es: "partidas", pt: "partidas", de: "Spiele" , it: "giochi"},
    phrase: {
      tr: (n) => `günde ${n} oyun oynayabilirsin`,
      en: (n) => `you can play ${n} games per day`,
      es: (n) => `puedes jugar ${n} partidas al día`,
      pt: (n) => `você pode jogar ${n} partidas por dia`,
      de: (n) => `du kannst ${n} Spiele pro Tag spielen`,

  it: n => `puoi giocare a ${n} giochi al giorno`},
  }),
  cineswipe_rooms: feature({
    id: "cineswipe_rooms",
    kind: DAILY,
    category: "play",
    icon: "people",
    limits: { free: 0, premium: 10, unlimited: UNLIMITED },
    title: { tr: "CineSwipe odası kurma", en: "CineSwipe rooms you host", es: "Salas de CineSwipe que creas", pt: "Salas do CineSwipe que você cria", de: "CineSwipe-Räume, die du hostest" , it: "Stanze CineSwipe che ospiti"},
    upsell: {
      title: { tr: "Bugünkü oda hakkın bitti", en: "You've hosted all of today's rooms", es: "Has creado todas las salas de hoy", pt: "Você criou todas as salas de hoje", de: "Du hast alle heutigen Räume gehostet" , it: "Hai ospitato tutte le stanze di oggi"},
      lockedTitle: { tr: "Arkadaşınla CineSwipe Premium'da", en: "CineSwipe with friends is a Premium perk", es: "CineSwipe con amigos es una ventaja Premium", pt: "O CineSwipe com amigos é um benefício Premium", de: "CineSwipe mit Freunden ist ein Premium-Vorteil" , it: "CineSwipe con gli amici è un vantaggio Premium"},
      message: {
        tr: "Arkadaşınla ortak oda kur, kaydırdıkça eşleşin ve bu akşamki filmi birlikte seçin.",
        en: "Host a shared room with a friend, match as you swipe and pick tonight's movie together.",
        es: "Crea una sala compartida con un amigo, haced match mientras deslizáis y elegid juntos la película de esta noche.",
        pt: "Crie uma sala compartilhada com um amigo, deem match enquanto deslizam e escolham juntos o filme da noite.",
        de: "Hoste einen gemeinsamen Raum mit einem Freund, matche beim Wischen und wähle gemeinsam den Film für heute Abend.",

  it: "Ospita una stanza condivisa con un amico, abbina mentre scorri e scegli insieme il film di stasera."},
    },
    unit: { tr: "oda", en: "rooms", es: "salas", pt: "salas", de: "Räume" , it: "stanze"},
    phrase: {
      tr: (n) => `günde ${n} CineSwipe odası kurabilirsin`,
      en: (n) => `you can host ${n} CineSwipe rooms per day`,
      es: (n) => `puedes crear ${n} salas de CineSwipe al día`,
      pt: (n) => `você pode criar ${n} salas do CineSwipe por dia`,
      de: (n) => `du kannst ${n} CineSwipe-Räume pro Tag hosten`,

  it: n => `puoi ospitare ${n} stanze CineSwipe al giorno`},
  }),
  cineswipe_swipes: feature({
    id: "cineswipe_swipes",
    kind: DAILY,
    category: "play",
    icon: "swap-horizontal",
    limits: { free: 0, premium: 300, unlimited: UNLIMITED },
    title: { tr: "Tek başına CineSwipe", en: "Solo CineSwipe", es: "CineSwipe en solitario", pt: "CineSwipe solo", de: "Solo-CineSwipe" , it: "Solo CineSwipe"},
    upsell: {
      title: { tr: "Bugünkü kaydırma hakkın bitti", en: "You're out of swipes for today", es: "Se te han acabado los deslizamientos de hoy", pt: "Seus deslizes de hoje acabaram", de: "Du hast keine Swipes mehr für heute" , it: "Hai finito i passaggi per oggi"},
      lockedTitle: { tr: "CineSwipe Premium'da", en: "CineSwipe is a Premium perk", es: "CineSwipe es una ventaja Premium", pt: "O CineSwipe é um benefício Premium", de: "CineSwipe ist ein Premium-Vorteil" , it: "CineSwipe è un vantaggio Premium"},
      message: {
        tr: "Kartları kaydırarak sana uygun film ve dizileri keşfet.",
        en: "Swipe through cards to discover movies and shows you'll like.",
        es: "Desliza tarjetas para descubrir películas y series que te gustarán.",
        pt: "Deslize cards para descobrir filmes e séries de que você vai gostar.",
        de: "Wische durch Karten, um Filme und Serien zu entdecken, die dir gefallen.",

  it: "Scorri le carte per scoprire film e programmi che ti piaceranno."},
    },
    unit: { tr: "kart", en: "cards", es: "tarjetas", pt: "cards", de: "Karten" , it: "carte"},
    phrase: {
      tr: (n) => `günde ${n} kart kaydırabilirsin`,
      en: (n) => `you can swipe ${n} cards per day`,
      es: (n) => `puedes deslizar ${n} tarjetas al día`,
      pt: (n) => `você pode deslizar ${n} cards por dia`,
      de: (n) => `du kannst ${n} Karten pro Tag wischen`,

  it: n => `puoi scorrere ${n} carte al giorno`},
  }),
  tournament_vote: feature({
    id: "tournament_vote",
    kind: ACCESS,
    category: "play",
    icon: "trophy",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Turnuvada oy kullanma", en: "Voting in the tournament", es: "Votar en el torneo", pt: "Votar no torneio", de: "Abstimmen im Turnier" , it: "Votazione nel torneo"},
    upsell: {
      title: { tr: "Turnuvada oy Premium'da", en: "Tournament voting is a Premium perk", es: "Votar en el torneo es una ventaja Premium", pt: "Votar no torneio é um benefício Premium", de: "Das Abstimmen im Turnier ist ein Premium-Vorteil" , it: "Il voto nei tornei è un vantaggio Premium"},
      message: {
        tr: "Turnuvayı herkes izleyebilir; aday gösterme ve maç oyları Premium'a özel.",
        en: "Anyone can follow the tournament; nominating and voting on matches is for Premium.",
        es: "Cualquiera puede seguir el torneo; nominar y votar en los partidos es solo para Premium.",
        pt: "Qualquer pessoa pode acompanhar o torneio; indicar e votar nas partidas é só para o Premium.",
        de: "Jeder kann das Turnier verfolgen; Nominieren und Abstimmen bei Duellen ist Premium vorbehalten.",

  it: "Chiunque può seguire il torneo; nominare e votare le partite è per Premium."},
    },
    freeValue: { tr: "Yalnız izleyici", en: "Spectator only", es: "Solo espectador", pt: "Somente espectador", de: "Nur Zuschauer" , it: "Solo spettatore"},
    paidValue: { tr: "Oy kullanabilir", en: "Can vote", es: "Puede votar", pt: "Pode votar", de: "Darf abstimmen" , it: "Può votare"},
  }),
  // Seelogd Top 100'de oy (hype) — AKTİF oy hakkı: Free 0, Premium 10, Max 20 (29 Eki kullanıcı kararı:
  // sınırlı hak; herkes her yapıma oy verseydi oy sırayı oynatmazdı). Listeyi görmek, aramak, liste olarak
  // kaydetmek ve sohbete göndermek her planda açık. Oyu geri almak her planda serbest ve hakkı geri verir;
  // plan düşünce verilmiş oylar sayılmaya devam eder. Sunucu aynası (aynı sayılar!): firestore.rules
  // Top100Hype votes create + Top100HypeUsers/{uid}.used.
  top100_vote: feature({
    id: "top100_vote",
    kind: COUNT,
    category: "play",
    icon: "flame",
    limits: { free: 0, premium: 10, unlimited: 20 },
    title: { tr: "Top 100 oy hakkı", en: "Top 100 votes", es: "Votos en el Top 100", pt: "Votos no Top 100", de: "Stimmen in den Top 100" , it: "I primi 100 voti"},
    upsell: {
      title: { tr: "Oy hakkın doldu", en: "You've used all your votes", es: "Has usado todos tus votos", pt: "Você usou todos os seus votos", de: "Du hast alle Stimmen vergeben" , it: "Hai usato tutti i tuoi voti"},
      lockedTitle: { tr: "Top 100'de oy Premium'da", en: "Top 100 voting is a Premium perk", es: "Votar en el Top 100 es una ventaja Premium", pt: "Votar no Top 100 é um benefício Premium", de: "Abstimmen in den Top 100 ist ein Premium-Vorteil" , it: "Il voto tra i primi 100 è un vantaggio Premium"},
      message: {
        tr: "Listeyi herkes görebilir, kaydedip paylaşabilir; sıralamayı oyunla değiştirmek Premium'a özel. Her Seelogd oyu 100 TMDB değerlendirmesi değerinde.",
        en: "Anyone can browse, save and share the list; moving the ranking with your vote is for Premium. Each Seelogd vote is worth 100 TMDB ratings.",
        es: "Cualquiera puede ver, guardar y compartir la lista; mover el ranking con tu voto es solo para Premium. Cada voto de Seelogd vale 100 valoraciones de TMDB.",
        pt: "Qualquer pessoa pode ver, salvar e compartilhar a lista; mudar o ranking com seu voto é só para o Premium. Cada voto do Seelogd vale 100 avaliações do TMDB.",
        de: "Jeder kann die Liste ansehen, speichern und teilen; das Ranking mit deiner Stimme zu bewegen ist Premium vorbehalten. Jede Seelogd-Stimme zählt wie 100 TMDB-Bewertungen.",

  it: "Chiunque può sfogliare, salvare e condividere l'elenco; spostare la classifica con il tuo voto è per Premium. Ogni voto Seelogd vale 100 valutazioni TMDB."},
    },
    detail: {
      tr: "Seelogd Top 100 sıralamasına oy ver",
      en: "Vote in the Seelogd Top 100 ranking",
      es: "Vota en el ranking Seelogd Top 100",
      pt: "Vote no ranking Seelogd Top 100",
      de: "Stimme im Seelogd-Top-100-Ranking ab",

  it: "Vota nella classifica Seelogd Top 100"},
    unit: { tr: "oy", en: "votes", es: "votos", pt: "votos", de: "Stimmen" , it: "voti"},
    note: {
      tr: "Oyu geri alınca hakkın geri gelir; verdiğin oylar abonelik bitince de sayılır",
      en: "Taking a vote back returns it to you; votes you've cast still count if your subscription ends",
      es: "Al quitar un voto lo recuperas; tus votos siguen contando si termina tu suscripción",
      pt: "Ao retirar um voto você o recupera; seus votos continuam contando se a assinatura acabar",
      de: "Ziehst du eine Stimme zurück, bekommst du sie wieder; abgegebene Stimmen zählen weiter, wenn dein Abo endet",

  it: "Riprendere un voto te lo restituisce; i voti che hai espresso contano comunque se il tuo abbonamento scade"},
    phrase: {
      tr: (n) => `aynı anda ${n} yapıma oy verebilirsin`,
      en: (n) => `you can back up to ${n} titles at once`,
      es: (n) => `puedes votar hasta ${n} títulos a la vez`,
      pt: (n) => `você pode votar em até ${n} títulos ao mesmo tempo`,
      de: (n) => `du kannst bis zu ${n} Titel gleichzeitig unterstützen`,

  it: n => `puoi eseguire il backup di ${n} titoli contemporaneamente`},
  }),
  // Film Zinciri (docs/ozellikler/FILM_ZINCIRI.md) — 30 Eki kullanıcı kararı: oyunun tamamı Premium (günlük +
  // serbest + sohbetten gelen meydan okuma). Free'de Oyunlar rayında kart "Premium" yazar, dokununca yükseltme;
  // sohbetteki meydan okuma kartını Free de GÖRÜR (gönderenin sonucu), "Zinciri kur" yükseltme açar. Kayıtlı
  // sonuçlar plan düşünce silinmez. Sunucu aynası yok (TMDB okuması + cihaz-yerel kayıt).
  film_chain: feature({
    id: "film_chain",
    kind: ACCESS,
    category: "play",
    icon: "git-network",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Film Zinciri", en: "Film Chain", es: "Cadena de Cine", pt: "Corrente de Cinema", de: "Filmkette" , it: "Film Chain"},
    upsell: {
      title: { tr: "Film Zinciri Premium'da", en: "Film Chain is a Premium perk", es: "Cadena de Cine es una ventaja Premium", pt: "A Corrente de Cinema é um benefício Premium", de: "Filmkette ist ein Premium-Vorteil" , it: "Film Chain è un vantaggio Premium"},
      message: {
        tr: "İki oyuncuyu ortak filmlerle bağla: her gün yeni bir zincir, sınırsız serbest mod ve arkadaşlarına spoiler'sız meydan okuma.",
        en: "Connect two actors through shared films: a new chain every day, unlimited free play and spoiler-free challenges for your friends.",
        es: "Conecta a dos actores con películas en común: una cadena nueva cada día, modo libre ilimitado y retos sin spoilers para tus amigos.",
        pt: "Ligue dois atores por filmes em comum: uma corrente nova por dia, modo livre ilimitado e desafios sem spoiler para seus amigos.",
        de: "Verbinde zwei Stars über gemeinsame Filme: jeden Tag eine neue Kette, unbegrenztes freies Spiel und spoilerfreie Challenges für Freunde.",

  it: "Connetti due attori attraverso film condivisi: una nuova catena ogni giorno, gioco gratuito illimitato e sfide senza spoiler per i tuoi amici."},
    },
    detail: {
      tr: "Günlük zincir, serbest mod ve arkadaşa meydan okuma",
      en: "Daily chain, free play and friend challenges",
      es: "Cadena diaria, modo libre y retos a amigos",
      pt: "Corrente diária, modo livre e desafios a amigos",
      de: "Tägliche Kette, freies Spiel und Challenges für Freunde",

  it: "Catena quotidiana, gioco gratuito e sfide con gli amici"},
    freeValue: { tr: "Kapalı", en: "Off", es: "Desactivado", pt: "Desativado", de: "Aus" , it: "Spento"},
    paidValue: { tr: "Günlük + serbest", en: "Daily + free play", es: "Diaria + libre", pt: "Diária + livre", de: "Täglich + frei" , it: "Giorno quotidiano + gioco gratuito"},
  }),
  // Günün Karesi (screens/game/DailyFrameScreen): Framed tarzı günlük film. 30 Eki kararı: Premium. Free kullanıcı
  // Eğlence kartını ve sohbetteki sonuç kartını GÖRÜR (kilitli), oynamak yükseltme sayfasını açar.
  daily_frame: feature({
    id: "daily_frame",
    kind: ACCESS,
    category: "play",
    icon: "aperture",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Günün Karesi", en: "Frame of the Day", es: "Fotograma del Día", pt: "Quadro do Dia", de: "Bild des Tages" , it: "Frame del giorno"},
    upsell: {
      title: { tr: "Günün Karesi Premium'da", en: "Frame of the Day is a Premium perk", es: "Fotograma del Día es una ventaja Premium", pt: "O Quadro do Dia é um benefício Premium", de: "Bild des Tages ist ein Premium-Vorteil" , it: "Frame of the Day è un vantaggio Premium"},
      message: {
        tr: "Her gün herkese aynı film: sahneden bul, 6 karede ipuçlarıyla daralt, sonucunu arkadaşlarınla paylaş.",
        en: "The same movie for everyone each day: name it from a still, narrow it down over 6 frames with hints and share your result.",
        es: "La misma película para todos cada día: adivínala por una escena, acota con pistas en 6 fotogramas y comparte tu resultado.",
        pt: "O mesmo filme para todos a cada dia: descubra pela cena, afunile com dicas em 6 quadros e compartilhe seu resultado.",
        de: "Jeden Tag derselbe Film für alle: Errate ihn anhand einer Szene, grenze ihn in 6 Bildern mit Hinweisen ein und teile dein Ergebnis.",

  it: "Lo stesso film per tutti ogni giorno: assegnagli un nome da un'immagine, restringi il campo a 6 fotogrammi con suggerimenti e condividi il risultato."},
    },
    detail: {
      tr: "Günlük film tahmini, ipuçları, seri ve paylaşım",
      en: "Daily movie guess, hints, streaks and sharing",
      es: "Adivinanza diaria, pistas, rachas y compartir",
      pt: "Palpite diário, dicas, sequências e compartilhamento",
      de: "Tägliches Filmraten, Hinweise, Serien und Teilen",

  it: "Ipotesi, suggerimenti, sequenze e condivisione quotidiana del film"},
    freeValue: { tr: "Kapalı", en: "Off", es: "Desactivado", pt: "Desativado", de: "Aus" , it: "Spento"},
    paidValue: { tr: "Her gün", en: "Every day", es: "Cada día", pt: "Todo dia", de: "Jeden Tag" , it: "Ogni giorno"},
  }),
  custom_themes: feature({
    id: "custom_themes",
    kind: ACCESS,
    category: "personal",
    icon: "color-palette",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Kendi temanı oluştur", en: "Create your own themes", es: "Crea tus propios temas", pt: "Crie seus próprios temas", de: "Eigene Designs erstellen" , it: "Crea i tuoi temi"},
    upsell: {
      title: { tr: "Kendi temanı tasarla", en: "Design your own theme", es: "Diseña tu propio tema", pt: "Desenhe seu próprio tema", de: "Gestalte dein eigenes Design" , it: "Progetta il tuo tema"},
      message: {
        tr: "Renkleri sen seç, temanı kaydet ve istediğin an değiştir.",
        en: "Pick your own colors, save your theme and switch whenever you like.",
        es: "Elige tus colores, guarda tu tema y cámbialo cuando quieras.",
        pt: "Escolha suas cores, salve seu tema e troque quando quiser.",
        de: "Wähle deine eigenen Farben, speichere dein Design und wechsle, wann du willst.",

  it: "Scegli i tuoi colori, salva il tema e cambia quando vuoi."},
    },
    freeValue: {
      tr: `${PRESET_THEME_COUNT} hazır tema`,
      en: `${PRESET_THEME_COUNT} preset themes`,
      es: `${PRESET_THEME_COUNT} temas predefinidos`,
      pt: `${PRESET_THEME_COUNT} temas predefinidos`,
      de: `${PRESET_THEME_COUNT} Vorlagen-Designs`,

  it: `${PRESET_THEME_COUNT} temi preimpostati`},
    paidValue: { tr: "Sınırsız özel tema", en: "Unlimited custom themes", es: "Temas personalizados ilimitados", pt: "Temas personalizados ilimitados", de: "Unbegrenzt eigene Designs" , it: "Temi personalizzati illimitati"},
  }),
  font_catalog: feature({
    id: "font_catalog",
    kind: ACCESS,
    category: "personal",
    icon: "text",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Yazı tipi kataloğu", en: "Font catalog", es: "Catálogo de fuentes", pt: "Catálogo de fontes", de: "Schriftkatalog" , it: "Catalogo dei caratteri"},
    upsell: {
      title: { tr: `${FONT_CATALOG_SIZE} yazı tipinin kilidini aç`, en: `Unlock all ${FONT_CATALOG_SIZE} fonts`, es: `Desbloquea las ${FONT_CATALOG_SIZE} fuentes`, pt: `Desbloqueie as ${FONT_CATALOG_SIZE} fontes`, de: `Alle ${FONT_CATALOG_SIZE} Schriften freischalten` , it: `Sblocca tutti i caratteri ${FONT_CATALOG_SIZE}`},
      message: {
        tr: "Başlık, gövde ve rakamlar için istediğin yazı tipini seç.",
        en: "Pick the font you like for headings, body text and numbers.",
        es: "Elige la fuente que prefieras para títulos, texto y números.",
        pt: "Escolha a fonte que preferir para títulos, textos e números.",
        de: "Wähle die Schrift, die dir für Überschriften, Fließtext und Zahlen gefällt.",

  it: "Scegli il carattere che preferisci per intestazioni, corpo del testo e numeri."},
    },
    freeValue: {
      tr: `${FREE_FONT_PRESET_IDS.length} yazı tipi`,
      en: `${FREE_FONT_PRESET_IDS.length} fonts`,
      es: `${FREE_FONT_PRESET_IDS.length} fuentes`,
      pt: `${FREE_FONT_PRESET_IDS.length} fontes`,
      de: `${FREE_FONT_PRESET_IDS.length} Schriften`,

  it: `Caratteri ${FREE_FONT_PRESET_IDS.length}`},
    paidValue: {
      tr: `${FONT_CATALOG_SIZE} yazı tipi`,
      en: `${FONT_CATALOG_SIZE} fonts`,
      es: `${FONT_CATALOG_SIZE} fuentes`,
      pt: `${FONT_CATALOG_SIZE} fontes`,
      de: `${FONT_CATALOG_SIZE} Schriften`,

  it: `Caratteri ${FONT_CATALOG_SIZE}`},
  }),
  app_icon: feature({
    id: "app_icon",
    kind: ACCESS,
    category: "personal",
    icon: "apps",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Uygulama simgesi", en: "App icon", es: "Icono de la app", pt: "Ícone do app", de: "App-Symbol" , it: "Icona dell'app"},
    upsell: {
      title: { tr: "Simgeyi değiştir", en: "Change your app icon", es: "Cambia el icono de la app", pt: "Mude o ícone do app", de: "App-Symbol ändern" , it: "Cambia l'icona dell'app"},
      message: {
        tr: "Altın, Gece, Gün Batımı, Aurora ve daha fazlası: ana ekranındaki Seelogd simgesini kendin seç.",
        en: "Gold, Midnight, Sunset, Aurora and more: pick the Seelogd icon on your home screen.",
        es: "Oro, Medianoche, Atardecer, Aurora y más: elige el icono de Seelogd de tu pantalla de inicio.",
        pt: "Ouro, Meia-noite, Pôr do sol, Aurora e mais: escolha o ícone do Seelogd na sua tela inicial.",
        de: "Gold, Mitternacht, Sonnenuntergang, Polarlicht und mehr: Wähle dein Seelogd-Symbol für den Startbildschirm.",

  it: "Gold, Midnight, Sunset, Aurora e altro: scegli l'icona Seelogd sulla schermata iniziale."},
    },
    freeValue: { tr: "Varsayılan simge", en: "Default icon", es: "Icono predeterminado", pt: "Ícone padrão", de: "Standardsymbol" , it: "Icona predefinita"},
    paidValue: { tr: "Özel simgeler", en: "Exclusive icons", es: "Iconos exclusivos", pt: "Ícones exclusivos", de: "Exklusive Symbole" , it: "Icone esclusive"},
  }),
  snow_effect: feature({
    id: "snow_effect",
    kind: ACCESS,
    category: "personal",
    icon: "snow",
    minPlan: PREMIUM_PLAN.PREMIUM,
    // Kimlik tarihsel olarak "snow_effect"; kapsamı artık tüm atmosfer efektleri.
    title: { tr: "Atmosfer efektleri", en: "Atmosphere effects", es: "Efectos de atmósfera", pt: "Efeitos de atmosfera", de: "Atmosphäre-Effekte" , it: "Effetti di atmosfera"},
    upsell: {
      title: { tr: "Atmosfer efektleri Premium'da", en: "Atmosphere effects are a Premium perk", es: "Los efectos de atmósfera son una ventaja Premium", pt: "Os efeitos de atmosfera são um benefício Premium", de: "Atmosphäre-Effekte sind ein Premium-Vorteil" , it: "Gli effetti di atmosfera sono un vantaggio Premium"},
      message: {
        tr: "Kar, fırtına, kuzey ışıkları, patlamış mısır, kelebek ve daha fazlası ekranlarının arkasında; detaylarda yapımın türüne göre.",
        en: "Snow, storms, northern lights, popcorn, butterflies and more behind your screens, matched to the genre on details.",
        es: "Nieve, tormentas, auroras, palomitas, mariposas y más detrás de tus pantallas, según el género en los detalles.",
        pt: "Neve, tempestades, aurora boreal, pipoca, borboletas e mais atrás das suas telas, conforme o gênero nos detalhes.",
        de: "Schnee, Gewitter, Polarlichter, Popcorn, Schmetterlinge und mehr hinter deinen Bildschirmen, in Details passend zum Genre.",

  it: "Neve, tempeste, aurora boreale, popcorn, farfalle e altro ancora dietro i tuoi schermi, abbinati al genere nei dettagli."},
    },
    freeValue: { tr: "Kapalı", en: "Off", es: "Desactivado", pt: "Desativado", de: "Aus" , it: "Spento"},
    paidValue: { tr: "20 atmosfer efekti + türe göre", en: "20 atmosphere effects + by genre", es: "20 efectos de atmósfera + por género", pt: "20 efeitos de atmosfera + por gênero", de: "20 Atmosphäre-Effekte + nach Genre" , it: "20 effetti di atmosfera + per genere"},
  }),
  ambient_background: feature({
    id: "ambient_background",
    kind: ACCESS,
    category: "personal",
    icon: "prism",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Ambiyans arka planı", en: "Ambient background", es: "Fondo ambiental", pt: "Fundo ambiente", de: "Ambiente-Hintergrund" , it: "Sfondo ambientale"},
    upsell: {
      title: { tr: "Ambiyans Premium'da", en: "Ambient background is a Premium perk", es: "El fondo ambiental es una ventaja Premium", pt: "O fundo ambiente é um benefício Premium", de: "Der Ambiente-Hintergrund ist ein Premium-Vorteil" , it: "Lo sfondo ambientale è un vantaggio Premium"},
      message: {
        tr: "Ekranlarının arkasında bulanık, rengârenk ışıklar süzülsün.",
        en: "Let soft, colorful lights drift behind your screens.",
        es: "Deja que luces suaves y de colores floten tras tus pantallas.",
        pt: "Deixe luzes suaves e coloridas flutuarem atrás das suas telas.",
        de: "Lass weiche, bunte Lichter hinter deinen Bildschirmen treiben.",

  it: "Lascia che luci morbide e colorate vadano alla deriva dietro i tuoi schermi."},
    },
    freeValue: { tr: "Kapalı", en: "Off", es: "Desactivado", pt: "Desativado", de: "Aus" , it: "Spento"},
    paidValue: { tr: "Süzülen ışıklar", en: "Drifting lights", es: "Luces flotantes", pt: "Luzes flutuantes", de: "Treibende Lichter" , it: "Luci fluttuanti"},
  }),
  // Film/dizi başına TMDB'deki alternatif afiş ve arka planlardan biri (utils/posterChoices.js).
  // Abonelik bitince seçimler SİLİNMEZ, varsayılan görsel çizilir (diğer kozmetiklerle
  // aynı kural). Arkadaşlar sahibin seçimini, sahibin SUNUCU planı izin verdikçe görür
  // (Users/{uid}.entitlements — context/PosterChoicesProvider useUserPosterChoices).
  // Kimlik `custom_posters` olarak kalır (arka plan aynı hakka 25 Eki'de eklendi).
  custom_posters: feature({
    id: "custom_posters",
    kind: ACCESS,
    category: "personal",
    icon: "images",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "Özel afiş ve arka planlar", en: "Custom posters and backdrops", es: "Pósteres y fondos personalizados", pt: "Pôsteres e fundos personalizados", de: "Eigene Poster und Hintergründe" , it: "Poster e sfondi personalizzati"},
    // Yükseltme sayfası galeriden açılınca seçmeye çalışılan görseli de gösterir
    // ("Şimdi" → "Seçtiğin"; utils/premiumUpsellContent buildChoicePreview). Başlık o
    // an seçilen türe göre: `titleByPreview.backdrop` arka plan galerisinden gelince.
    upsell: {
      title: { tr: "Afişi sen seç", en: "You pick the poster", es: "Tú eliges el póster", pt: "Você escolhe o pôster", de: "Du wählst das Poster" , it: "Sei tu a scegliere il poster"},
      titleByPreview: {
        backdrop: { tr: "Arka planı sen seç", en: "You pick the backdrop", es: "Tú eliges el fondo", pt: "Você escolhe o fundo", de: "Du wählst den Hintergrund" , it: "Sei tu a scegliere lo sfondo"},
      },
      message: {
        tr: "Seçtiğin afiş ve arka plan her yerde görünür, arkadaşların da görür.",
        en: "Your poster and backdrop picks show everywhere, and your friends see them too.",
        es: "Tus pósteres y fondos elegidos se ven en todas partes, y tus amigos también los ven.",
        pt: "Seus pôsteres e fundos escolhidos aparecem em todo lugar, e seus amigos também veem.",
        de: "Deine Poster und Hintergründe erscheinen überall, und deine Freunde sehen sie auch.",

  it: "Il tuo poster e i tuoi sfondi vengono visualizzati ovunque e anche i tuoi amici li vedono."},
    },
    freeValue: { tr: "Varsayılan", en: "Default", es: "Predeterminado", pt: "Padrão", de: "Standard" , it: "Predefinito"},
    paidValue: { tr: "Senin seçimin", en: "Your pick", es: "Tu elección", pt: "Sua escolha", de: "Deine Wahl" , it: "La tua scelta"},
  }),
  icon_background: feature({
    id: "icon_background",
    kind: ACCESS,
    category: "personal",
    icon: "image",
    minPlan: PREMIUM_PLAN.PREMIUM,
    title: { tr: "İkon arka planı", en: "Icon background", es: "Fondo de iconos", pt: "Fundo de ícones", de: "Symbolhintergrund" , it: "Sfondo delle icone"},
    upsell: {
      title: { tr: "İkon arka planı Premium'da", en: "Icon background is a Premium perk", es: "El fondo de iconos es una ventaja Premium", pt: "O fundo de ícones é um benefício Premium", de: "Der Symbolhintergrund ist ein Premium-Vorteil" , it: "Lo sfondo delle icone è un vantaggio Premium"},
      message: {
        tr: "Ekran arka planlarına desen ekle; saydamlığını ve düzenini ayarla.",
        en: "Add a pattern behind your screens and tune its opacity and layout.",
        es: "Añade un patrón tras tus pantallas y ajusta su opacidad y su disposición.",
        pt: "Adicione um padrão atrás das suas telas e ajuste a opacidade e a disposição.",
        de: "Füge hinter deinen Bildschirmen ein Muster hinzu und passe Deckkraft und Anordnung an.",

  it: "Aggiungi un motivo dietro i tuoi schermi e ottimizzane l'opacità e il layout."},
    },
    freeValue: { tr: "Kapalı", en: "Off", es: "Desactivado", pt: "Desativado", de: "Aus" , it: "Spento"},
    paidValue: { tr: "Desenli arka plan", en: "Patterned background", es: "Fondo con patrón", pt: "Fundo com padrão", de: "Hintergrund mit Muster" , it: "Sfondo con motivi"},
  }),
  streaming_alerts: feature({
    id: "streaming_alerts",
    kind: COUNT,
    category: "alerts",
    icon: "notifications",
    enforcedBy: "server",
    limits: { free: 10, premium: 100, unlimited: 100 },
    title: { tr: "Platform bildirimi", en: "Streaming alerts", es: "Avisos de streaming", pt: "Avisos de streaming", de: "Streaming-Benachrichtigungen" , it: "Avvisi di streaming"},
    upsell: {
      title: { tr: "Takip limitin doldu", en: "Tracking limit reached", es: "Has alcanzado el límite de seguimiento", pt: "Você atingiu o limite de acompanhamento", de: "Verfolgungslimit erreicht" , it: "Limite di monitoraggio raggiunto"},
    },
    unit: { tr: "başlık", en: "titles", es: "títulos", pt: "títulos", de: "Titel" , it: "titoli"},
    detail: {
      tr: "İzleme listene son eklediğin yapımlar bir platforma gelince haber verir",
      en: "Tells you when your latest watchlist titles start streaming",
      es: "Te avisa cuando los últimos títulos de tu lista de seguimiento llegan a una plataforma",
      pt: "Avisa quando os últimos títulos da sua lista para assistir chegam a um serviço de streaming",
      de: "Sagt dir Bescheid, wenn deine neuesten Merklisten-Titel zu streamen beginnen",

  it: "Ti informa quando inizia lo streaming dei titoli della tua lista di titoli più recenti"},
    phrase: {
      tr: (n) => `izleme listene son eklediğin ${n} başlık takip edilir`,
      en: (n) => `your ${n} most recent watchlist titles are tracked`,
      es: (n) => `se siguen tus ${n} títulos más recientes de la lista de seguimiento`,
      pt: (n) => `seus ${n} títulos mais recentes da lista para assistir são acompanhados`,
      de: (n) => `deine ${n} neuesten Merklisten-Titel werden verfolgt`,

  it: n => `i tuoi ${n} titoli della lista Da vedere più recenti vengono tracciati`},
  }),
  movie_reminders: feature({
    id: "movie_reminders",
    kind: COUNT,
    category: "alerts",
    icon: "film",
    limits: { free: 10, premium: 50, unlimited: UNLIMITED },
    title: { tr: "Film hatırlatması", en: "Movie reminders", es: "Recordatorios de películas", pt: "Lembretes de filmes", de: "Filmerinnerungen" , it: "Promemoria film"},
    upsell: {
      title: { tr: "Film hatırlatma limitin doldu", en: "You've reached your movie reminder limit", es: "Has alcanzado tu límite de recordatorios de películas", pt: "Você atingiu seu limite de lembretes de filmes", de: "Du hast dein Limit für Filmerinnerungen erreicht" , it: "Hai raggiunto il limite di promemoria dei film"},
    },
    unit: { tr: "film", en: "movies", es: "películas", pt: "filmes", de: "Filme" , it: "film"},
    note: {
      tr: "Çıkışı geçmiş filmler sayılmaz",
      en: "Movies that have already released don't count",
      es: "Las películas ya estrenadas no cuentan",
      pt: "Filmes que já estrearam não contam",
      de: "Bereits erschienene Filme zählen nicht",

  it: "I film già usciti non contano"},
    phrase: {
      tr: (n) => `aynı anda en fazla ${n} filmin çıkışı için hatırlatma kurabilirsin`,
      en: (n) => `you can have reminders for up to ${n} upcoming movies at once`,
      es: (n) => `puedes tener recordatorios de hasta ${n} próximos estrenos de películas a la vez`,
      pt: (n) => `você pode ter lembretes de até ${n} próximas estreias de filmes ao mesmo tempo`,
      de: (n) => `du kannst Erinnerungen für bis zu ${n} kommende Filme gleichzeitig haben`,

  it: n => `puoi avere promemoria per un massimo di ${n} film in uscita contemporaneamente`},
  }),
  tv_reminders: feature({
    id: "tv_reminders",
    kind: COUNT,
    category: "alerts",
    icon: "tv",
    limits: { free: 20, premium: 100, unlimited: UNLIMITED },
    title: { tr: "Dizi hatırlatması", en: "Show reminders", es: "Recordatorios de series", pt: "Lembretes de séries", de: "Serienerinnerungen" , it: "Mostra promemoria"},
    upsell: {
      title: { tr: "Dizi hatırlatma limitin doldu", en: "You've reached your show reminder limit", es: "Has alcanzado tu límite de recordatorios de series", pt: "Você atingiu seu limite de lembretes de séries", de: "Du hast dein Limit für Serienerinnerungen erreicht" , it: "Hai raggiunto il limite di promemoria dello serie TV"},
    },
    unit: { tr: "dizi", en: "shows", es: "series", pt: "séries", de: "Serien" , it: "serie TV"},
    note: {
      tr: "Bir dizinin tüm bölümleri tek hak sayılır; yayınlanmış bölümler sayılmaz",
      en: "All episodes of one show use a single slot; aired episodes don't count",
      es: "Todos los episodios de una serie usan un solo hueco; los ya emitidos no cuentan",
      pt: "Todos os episódios de uma série usam uma única vaga; os já exibidos não contam",
      de: "Alle Folgen einer Serie belegen einen einzigen Platz; bereits ausgestrahlte Folgen zählen nicht",

  it: "Tutti gli episodi di uno serie TV utilizzano un unico slot; gli episodi trasmessi non contano"},
    phrase: {
      tr: (n) => `aynı anda en fazla ${n} dizi için bölüm hatırlatması kurabilirsin`,
      en: (n) => `you can have episode reminders for up to ${n} shows at once`,
      es: (n) => `puedes tener recordatorios de episodios de hasta ${n} series a la vez`,
      pt: (n) => `você pode ter lembretes de episódios de até ${n} séries ao mesmo tempo`,
      de: (n) => `du kannst Folgenerinnerungen für bis zu ${n} Serien gleichzeitig haben`,

  it: n => `puoi avere promemoria degli episodi per un massimo di ${n} programmi contemporaneamente`},
  }),
  wrapped_archive: feature({
    id: "wrapped_archive",
    kind: COUNT,
    // PENCERE özelliği: sayı harcanan bir miktar değil, geriye doğru görülebilen
    // yıl sayısı (bu yıl dahil). Bu yüzden kullanım göstergesi/sayaç yok; kapı
    // `canViewWrappedYear` ile "yıl kaç yıl geride?" diye sorar (bkz. aşağıda).
    window: true,
    category: "alerts",
    icon: "albums",
    limits: {
      free: WRAPPED_YEARS_VISIBLE.free,
      premium: WRAPPED_YEARS_VISIBLE.premium,
      unlimited: UNLIMITED,
    },
    title: { tr: "Wrapped arşivi", en: "Wrapped archive", es: "Archivo de Wrapped", pt: "Arquivo do Wrapped", de: "Wrapped-Archiv" , it: "Archivio completo"},
    unit: { tr: "yıl", en: "years", es: "años", pt: "anos", de: "Jahre" , it: "anni"},
    upsell: {
      title: { tr: "Geçmiş yıllar Premium'da", en: "Past years are a Premium perk", es: "Los años anteriores son una ventaja Premium", pt: "Os anos anteriores são um benefício Premium", de: "Frühere Jahre sind ein Premium-Vorteil" , it: "Gli anni passati sono un vantaggio Premium"},
      // Premium'un penceresi dolunca (5 yıldan eski) hedef plan Max olur.
      titleByTarget: {
        [PREMIUM_PLAN.UNLIMITED]: {
          tr: "Tüm yıllar Premium Max'te",
          en: "Every year is a Premium Max perk",
          es: "Todos los años son una ventaja Premium Max",
          pt: "Todos os anos são um benefício Premium Max",
          de: "Jedes Jahr ist ein Premium-Max-Vorteil",

  it: "Ogni anno è un vantaggio Premium Max"},
      },
    },
    planValue: {
      [PREMIUM_PLAN.FREE]: { tr: "Yalnız bu yıl", en: "This year only", es: "Solo este año", pt: "Somente este ano", de: "Nur dieses Jahr" , it: "Solo quest'anno"},
      [PREMIUM_PLAN.PREMIUM]: {
        tr: `Son ${WRAPPED_YEARS_VISIBLE.premium} yıl`,
        en: `Last ${WRAPPED_YEARS_VISIBLE.premium} years`,
        es: `Últimos ${WRAPPED_YEARS_VISIBLE.premium} años`,
        pt: `Últimos ${WRAPPED_YEARS_VISIBLE.premium} anos`,
        de: `Letzte ${WRAPPED_YEARS_VISIBLE.premium} Jahre`,

  it: `Ultimi ${WRAPPED_YEARS_VISIBLE.premium} anni`},
      [PREMIUM_PLAN.UNLIMITED]: { tr: "Tüm yıllar", en: "Every year", es: "Todos los años", pt: "Todos os anos", de: "Jedes Jahr" , it: "Ogni anno"},
    },
    phrase: {
      tr: (n) =>
        n === 1
          ? "yalnızca bu yılın Wrapped özetini görebilirsin"
          : Number.isFinite(n)
            ? `son ${n} yılın Wrapped özetlerini görebilirsin`
            : "tüm yılların Wrapped özetlerini görebilirsin",
      en: (n) =>
        n === 1
          ? "you can view this year's Wrapped recap only"
          : Number.isFinite(n)
            ? `you can view your Wrapped recaps from the last ${n} years`
            : "you can view your Wrapped recaps from every year",
      es: (n) =>
        n === 1
          ? "solo puedes ver el resumen de Wrapped de este año"
          : Number.isFinite(n)
            ? `puedes ver los resúmenes de Wrapped de los últimos ${n} años`
            : "puedes ver los resúmenes de Wrapped de todos los años",
      pt: (n) =>
        n === 1
          ? "você só pode ver o resumo do Wrapped deste ano"
          : Number.isFinite(n)
            ? `você pode ver os resumos do Wrapped dos últimos ${n} anos`
            : "você pode ver os resumos do Wrapped de todos os anos",
      de: (n) =>
        n === 1
          ? "du kannst nur den Wrapped-Rückblick dieses Jahres ansehen"
          : Number.isFinite(n)
            ? `du kannst die Wrapped-Rückblicke der letzten ${n} Jahre ansehen`
            : "du kannst die Wrapped-Rückblicke aller Jahre ansehen",

  it: n => n === 1 ? "puoi visualizzare solo il riepilogo Wrapped di quest'anno" : Number.isFinite(n) ? `puoi visualizzare i riepiloghi Wrapped degli ultimi ${n} anni` : "puoi visualizzare i riepiloghi Wrapped di ogni anno"},
  }),
  // Uygulama içi geri bildirim kutusu (Ayarlar > Destek ve geri bildirim).
  // Hata bildirimi Free dahil açıktır; özellik isteği Premium Max kapısını korur.
  // Sunucu kuralı da aynı ayrımı uygular (firestore.rules → Feedback).
  bug_report: feature({
    id: "bug_report",
    kind: ACCESS,
    category: "support",
    icon: "bug",
    enforcedBy: "server",
    minPlan: PREMIUM_PLAN.FREE,
    title: { tr: "Hata bildirimi", en: "Bug reports", es: "Informes de errores", pt: "Relatos de erros", de: "Fehlerberichte" , it: "Segnalazioni di bug"},
    upsell: {
      title: { tr: "Hata bildir", en: "Report a bug", es: "Informar de un error", pt: "Relatar um erro", de: "Fehler melden" , it: "Segnala un bug"},
      message: {
        tr: "Karşılaştığın sorunu uygulamadan doğrudan ilet; cihaz ve sürüm bilgisi kendiliğinden eklenir.",
        en: "Send the problem you ran into straight from the app; device and version details are attached for you.",
        es: "Envía el problema que encontraste directamente desde la app; los datos del dispositivo y la versión se añaden solos.",
        pt: "Envie o problema que você encontrou direto pelo app; os dados do dispositivo e da versão são anexados automaticamente.",
        de: "Sende das aufgetretene Problem direkt aus der App; Geräte- und Versionsangaben werden für dich angehängt.",

  it: "Invia il problema che hai riscontrato direttamente dall'app; i dettagli del dispositivo e della versione sono allegati per te."},
    },
    detail: {
      tr: "Uygulamadan, cihaz ve sürüm bilgisiyle birlikte",
      en: "From inside the app, with device and version details",
      es: "Desde la app, con los datos del dispositivo y la versión",
      pt: "Pelo app, com dados do dispositivo e da versão",
      de: "Direkt aus der App, mit Geräte- und Versionsangaben",

  it: "Dall'interno dell'app, con i dettagli del dispositivo e della versione"},
    freeValue: { tr: "Uygulamadan bildir", en: "Report in-app", es: "Informar en la app", pt: "Relatar no app", de: "In der App melden" , it: "Segnala in-app"},
    paidValue: { tr: "Uygulamadan bildir", en: "Report in-app", es: "Informar en la app", pt: "Relatar no app", de: "In der App melden" , it: "Segnala in-app"},
  }),
  feature_request: feature({
    id: "feature_request",
    kind: ACCESS,
    category: "support",
    icon: "bulb",
    enforcedBy: "server",
    minPlan: PREMIUM_PLAN.UNLIMITED,
    title: { tr: "Özellik isteği", en: "Feature requests", es: "Solicitudes de funciones", pt: "Pedidos de recursos", de: "Funktionswünsche" , it: "Richieste di funzionalità"},
    upsell: {
      title: { tr: "Özellik isteği Premium Max'te", en: "Feature requests are a Premium Max perk", es: "Las solicitudes de funciones son una ventaja Premium Max", pt: "Os pedidos de recursos são um benefício Premium Max", de: "Funktionswünsche sind ein Premium-Max-Vorteil" , it: "Le richieste di funzionalità sono un vantaggio di Premium Max"},
      message: {
        tr: "Görmek istediğin özelliği doğrudan bize ilet; gönderdiklerinin durumunu uygulamadan takip et.",
        en: "Tell us the feature you want to see, and follow the status of what you sent right in the app.",
        es: "Cuéntanos la función que quieres ver y sigue en la app el estado de lo que enviaste.",
        pt: "Conte qual recurso você quer ver e acompanhe no app o status do que você enviou.",
        de: "Sag uns, welche Funktion du dir wünschst, und verfolge den Status deiner Einsendung direkt in der App.",

  it: "Dicci la funzionalità che desideri vedere e segui lo stato di ciò che hai inviato direttamente nell'app."},
    },
    detail: {
      tr: "Fikrini doğrudan bize ilet, durumunu takip et",
      en: "Send your idea straight to us and follow its status",
      es: "Envía tu idea directamente y sigue su estado",
      pt: "Envie sua ideia direto para nós e acompanhe o status",
      de: "Sende uns deine Idee direkt und verfolge ihren Status",

  it: "Inviaci la tua idea direttamente e seguine lo stato"},
    freeValue: { tr: "Yalnız e-posta", en: "Email only", es: "Solo correo", pt: "Somente e-mail", de: "Nur per E-Mail" , it: "Solo tramite e-mail"},
    paidValue: { tr: "Uygulamadan öner", en: "Suggest in-app", es: "Sugerir en la app", pt: "Sugerir no app", de: "In der App vorschlagen" , it: "Suggerisci in-app"},
  }),
});

export const FEATURE_IDS = Object.freeze(Object.keys(PREMIUM_FEATURES));

/**
 * Yükseltme PAKETLERİ: tek bir yüzeyin ardındaki, aynı planda birlikte açılan
 * kapılar. Planda hepsi KAPALIYKEN (Free'de CineSwipe: kart + oda) yükseltme
 * sayfası tek olur — başlık/mesaj paketin, plan kartlarında her üyenin değeri alt
 * alta. Aynı dokunuşta iki kapı birden sayfa isterse (ekran kapısı + oda kapısı)
 * host ikinciyi birleştirir; kullanıcı arka arkaya iki sayfa görmez. Üyelerden biri
 * açıksa (Premium'da günlük hak bitti) her kapı kendi sayfasını açar.
 *
 * İlk üye "önder"dir: renk, simge ve hedef plan ondan gelir.
 */
export const UPSELL_BUNDLES = Object.freeze({
  cineswipe: Object.freeze({
    id: "cineswipe",
    features: Object.freeze(["cineswipe_swipes", "cineswipe_rooms"]),
    title: { tr: "CineSwipe Premium'da", en: "CineSwipe is a Premium perk", es: "CineSwipe es una ventaja Premium", pt: "O CineSwipe é um benefício Premium", de: "CineSwipe ist ein Premium-Vorteil" , it: "CineSwipe è un vantaggio Premium"},
    message: {
      tr: "Kartları tek başına kaydır ya da arkadaşınla ortak oda kur; eşleşin ve bu akşamki filmi birlikte seçin.",
      en: "Swipe cards on your own or host a shared room with a friend; match up and pick tonight's movie together.",
      es: "Desliza tarjetas tú solo o crea una sala compartida con un amigo; haced match y elegid juntos la película de esta noche.",
      pt: "Deslize cards sozinho ou crie uma sala compartilhada com um amigo; deem match e escolham juntos o filme da noite.",
      de: "Wische allein durch Karten oder hoste einen gemeinsamen Raum mit einem Freund; matcht und wählt gemeinsam den Film für heute Abend.",

  it: "Scorri le carte da solo o ospita una stanza condivisa con un amico; abbinatevi e scegliete insieme il film di stasera."},
  }),
});

/**
 * Bu plandaki yükseltme paketi: özellik bir paketin üyesiyse ve paketin TÜM
 * üyeleri bu planda kapalıysa paket, aksi halde null.
 */
export function upsellBundleFor(featureId, plan) {
  const bundle = Object.values(UPSELL_BUNDLES).find((entry) => entry.features.includes(featureId));
  if (!bundle) return null;
  return bundle.features.every((id) => isLockedFor(id, plan)) ? bundle : null;
}

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı); `es` kolu olmayan girdi İngilizceye düşer.
const pick = (copy, language) =>
  copy?.[copyLanguage(language, ["tr", "en", "es", "pt", "de", "it"])] ?? copy?.en ?? copy?.tr ?? "";

/** Sayısal karşılaştırma için limit (AI kotasında günlük tavan). */
const numericLimit = (definition, limit) =>
  definition.kind === AI_QUOTA ? limit.daily : limit;

export function getFeature(featureId) {
  return PREMIUM_FEATURES[featureId] || null;
}

/**
 * Plan için limit:
 *   ACCESS   → boolean
 *   COUNT / DAILY → sayı (sınırsızsa Infinity)
 *   AI_QUOTA → { daily, monthly }
 * Bilinmeyen özellikte en kısıtlayıcı değer döner (kapı açık kalmasın).
 */
export function getFeatureLimit(featureId, plan) {
  const definition = getFeature(featureId);
  const normalized = normalizePlan(plan);
  if (!definition) return 0;
  if (definition.kind === ACCESS) {
    return planRank(normalized) >= planRank(definition.minPlan);
  }
  return definition.limits[normalized];
}

export function isUnlimitedFor(featureId, plan) {
  const limit = getFeatureLimit(featureId, plan);
  return typeof limit === "number" && !Number.isFinite(limit);
}

/**
 * Özellik bu planda tamamen KAPALI mı? ACCESS'te erişim yok; COUNT/DAILY/AI'da
 * limit 0 (ör. Free'de oyun). "Limit doldu" ile "bu plana dahil değil"i
 * ayırmak için: ilkinde sayaç ve yenilenme anlatılır, ikincisinde yalnız hangi
 * planın açtığı.
 */
export function isLockedFor(featureId, plan) {
  const definition = getFeature(featureId);
  if (!definition) return true;
  const limit = getFeatureLimit(featureId, plan);
  if (definition.kind === ACCESS) return !limit;
  return !(numericLimit(definition, limit) > 0);
}

/**
 * Bir sonraki kullanım serbest mi? `used`, COUNT için sahip olunan adet,
 * DAILY için bugün harcanan hak. ACCESS'te yok sayılır.
 */
export function canUseFeature(featureId, plan, used = 0) {
  const definition = getFeature(featureId);
  if (!definition) return false;
  const limit = getFeatureLimit(featureId, plan);
  if (definition.kind === ACCESS) return limit === true;
  if (definition.kind === AI_QUOTA) {
    return Math.max(0, Number(used) || 0) < limit.daily;
  }
  return Math.max(0, Number(used) || 0) < limit;
}

/** Kalan hak (sınırsızsa Infinity). ACCESS için erişim varsa Infinity, yoksa 0. */
export function remainingUses(featureId, plan, used = 0) {
  const definition = getFeature(featureId);
  if (!definition) return 0;
  const limit = getFeatureLimit(featureId, plan);
  if (definition.kind === ACCESS) return limit ? UNLIMITED : 0;
  const cap = definition.kind === AI_QUOTA ? limit.daily : limit;
  return Math.max(0, cap - Math.max(0, Number(used) || 0));
}

/** Bu özelliğin limitini ARTIRAN ilk üst plan; yoksa null. */
export function nextPlanFor(featureId, plan) {
  const definition = getFeature(featureId);
  if (!definition) return null;
  const current = getFeatureLimit(featureId, plan);
  for (const candidate of PLAN_ORDER.slice(planRank(plan) + 1)) {
    const next = getFeatureLimit(featureId, candidate);
    if (definition.kind === ACCESS) {
      if (next && !current) return candidate;
    } else if (numericLimit(definition, next) > numericLimit(definition, current)) {
      return candidate;
    }
  }
  return null;
}

export function isFontPresetFree(presetId) {
  return FREE_FONT_PRESET_IDS.includes(presetId);
}

/** Yazı tipi bu planda seçilebilir mi? */
export function canUseFontPreset(presetId, plan) {
  return isFontPresetFree(presetId) || getFeatureLimit("font_catalog", plan);
}

/**
 * Bu plan bu Wrapped yılını görebilir mi? Kapı bir pencere: yıl bu yıldan kaç yıl
 * geride ise o sayı `used` olarak sorulur, limit (görülebilen yıl sayısı, bu yıl
 * dahil) altında kalıyorsa açıktır. Free'de limit 1 → yalnız bu yıl; Premium'da 5
 * → bu yıl + 4 yıl geri; Max'te sınırsız. Gelecek yıl (saat/veri kayması) açıktır.
 */
export function canViewWrappedYear(year, plan, now = new Date()) {
  const numeric = Number(year);
  if (!Number.isFinite(numeric)) return false;
  return canUseFeature("wrapped_archive", plan, now.getFullYear() - numeric);
}

/**
 * Verilen yıllar (yeniden eskiye) içinden planın görebildiği İLK yıl; yoksa null.
 * Hub kartı ve Wrapped ekranı "en yeni yıl" derken kilitli bir yılı öne
 * çıkarmasın diye buradan seçer.
 */
export function pickViewableWrappedYear(years, plan, now = new Date()) {
  if (!Array.isArray(years)) return null;
  return years.find((year) => canViewWrappedYear(year, plan, now)) ?? null;
}

/**
 * Bu Wrapped yılını açan EN DÜŞÜK plan; hiçbiri açmıyorsa null. Kilitli satırda
 * "Premium ile aç" mı "Premium Max ile aç" mı denmesi gerektiğini söyler.
 */
export function requiredPlanForWrappedYear(year, now = new Date()) {
  return PLAN_ORDER.find((plan) => canViewWrappedYear(year, plan, now)) ?? null;
}

const unlimitedWord = (language) =>
  pickByLanguage(language, { tr: "Sınırsız", en: "Unlimited", es: "Ilimitado", pt: "Ilimitado", de: "Unbegrenzt" , it: "Illimitato"});

/** Cümle içinde plan adı: Free planı İspanyolcada "Gratis", Portekizcede "Grátis", Almancada "Kostenlos" (ekranlardaki plan adıyla aynı). */
const planNameFor = (plan, language) => {
  if (plan !== PREMIUM_PLAN.FREE) return getPremiumPlanDisplayName(plan);
  const code = normalizeAppLanguage(language);
  if (code === "es") return "Gratis";
  if (code === "pt") return "Grátis";
  if (code === "de") return "Kostenlos";
  return getPremiumPlanDisplayName(plan);
};

/**
 * Özelliğin birim adı ("liste", "lists"). Kayıttaki İngilizce birimler çoğul
 * yazılı; tek adette ("1 list", "1 group") tekile iner. Türkçe adetle değişmez.
 */
export function unitLabel(definition, count, language = "en") {
  const text = pick(definition?.unit, language);
  if (language !== "tr" && count === 1) return text.replace(/s$/, "");
  return text;
}

/**
 * Karşılaştırma tablosundaki hücre metni: "5 liste", "20 oyun/gün",
 * "Sınırsız", "Epik rozet", "—".
 */
export function formatFeatureValue(featureId, plan, language = "en") {
  const definition = getFeature(featureId);
  if (!definition) return "—";
  const normalized = normalizePlan(plan);
  const limit = getFeatureLimit(featureId, normalized);
  const lang = normalizeAppLanguage(language);

  if (definition.kind === AI_QUOTA) {
    return pickByLanguage(lang, {
      tr: `${limit.daily}/gün · ${limit.monthly}/ay`,
      en: `${limit.daily}/day · ${limit.monthly}/mo`,
      es: `${limit.daily}/día · ${limit.monthly}/mes`,
      pt: `${limit.daily}/dia · ${limit.monthly}/mês`,
      de: `${limit.daily}/Tag · ${limit.monthly}/Mon.`,

  it: `${limit.daily}/giorno · ${limit.monthly}/mese`});
  }
  if (definition.kind === ACCESS) {
    if (!limit) return definition.freeValue ? pick(definition.freeValue, language) : "—";
    if (definition.planValue?.[normalized]) {
      return pick(definition.planValue[normalized], language);
    }
    return definition.paidValue ? pick(definition.paidValue, language) : "✓";
  }
  // Plana özel hazır etiket varsa ("Son 5 yıl") üretilen "5 yıl"ın önüne geçer.
  if (definition.planValue?.[normalized]) {
    return pick(definition.planValue[normalized], language);
  }
  if (!Number.isFinite(limit)) return unlimitedWord(language);
  // Limit 0 = özellik bu planda kapalı ("0 oyun/gün" yazmak yanıltıcı olur).
  if (limit <= 0) return definition.freeValue ? pick(definition.freeValue, language) : "—";
  const unit = unitLabel(definition, limit, language);
  const count = grouped(limit, lang);
  if (definition.kind === DAILY) {
    return pickByLanguage(lang, {
      tr: `${count} ${unit}/gün`,
      en: `${count} ${unit}/day`,
      es: `${count} ${unit}/día`,
      pt: `${count} ${unit}/dia`,
      de: `${count} ${unit}/Tag`,

  it: `${count} ${unit}/giorno`});
  }
  return `${count} ${unit}`;
}

/** "Premium ile 25, Premium Max ile sınırsız." — üst planların bu özellikteki değeri. */
function upgradeSentence(featureId, plan, language) {
  const definition = getFeature(featureId);
  if (!definition || definition.kind === ACCESS) return "";
  const lang = normalizeAppLanguage(language);
  const current = numericLimit(definition, getFeatureLimit(featureId, plan));
  const parts = [];
  for (const candidate of PLAN_ORDER.slice(planRank(plan) + 1)) {
    const limit = numericLimit(definition, getFeatureLimit(featureId, candidate));
    if (!(limit > current)) continue;
    // Pencere özelliğinde çıplak "5" anlamsız kalır: "son 5 yıl" / "tüm yıllar".
    const value = definition.window
      ? formatFeatureValue(featureId, candidate, language).toLocaleLowerCase(intlLocaleOf(lang))
      : Number.isFinite(limit)
        ? grouped(limit, lang)
        : pickByLanguage(lang, { tr: "sınırsız", en: "unlimited", es: "ilimitado", pt: "ilimitado", de: "unbegrenzt" , it: "illimitato"});
    const name = getPremiumPlanDisplayName(candidate);
    parts.push(
      pickByLanguage(lang, {
        tr: `${name} ile ${value}`,
        en: `with ${name}: ${value}`,
        es: `con ${name}: ${value}`,
        pt: `com ${name}: ${value}`,
        de: `mit ${name}: ${value}`,

  it: `con ${name}: ${value}`}),
    );
  }
  if (!parts.length) return "";
  const sentence = `${parts.join(", ")}.`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * "Free planında en fazla 1 özel liste oluşturabilirsin." — planın bu özellikteki
 * mevcut sınırını tek cümleyle söyler. ACCESS özelliklerde ve cümle kalıbı
 * olmayanlarda boş döner. Hem limit uyarısı hem yükseltme sayfası kullanır.
 */
export function describeCurrentLimit(featureId, plan, language = "en") {
  const definition = getFeature(featureId);
  if (!definition || definition.kind === ACCESS) return "";
  // Kapalı özellikte "günde 0 oyun oynayabilirsin" demek yerine cümle yok.
  if (isLockedFor(featureId, plan)) return "";
  const lang = normalizeAppLanguage(language);
  const normalized = normalizePlan(plan);
  const planName = planNameFor(normalized, lang);
  const cap = numericLimit(definition, getFeatureLimit(featureId, normalized));
  const phrase = definition.phrase ? pick(definition.phrase, language) : null;
  if (typeof phrase !== "function") return "";
  return pickByLanguage(lang, {
    tr: `${planName} planında ${phrase(cap)}.`,
    en: `On ${planName}, ${phrase(cap)}.`,
    es: `Con el plan ${planName}, ${phrase(cap)}.`,
    pt: `No plano ${planName}, ${phrase(cap)}.`,
    de: `Im ${planName}-Plan gilt: ${phrase(cap)}.`,

  it: `Il ${planName}, ${phrase(cap)}.`});
}

/**
 * Limit dolduğunda gösterilecek uyarı metni.
 * @returns {{ title: string, message: string, canUpgrade: boolean }}
 */
export function buildLimitCopy(featureId, plan, language = "en") {
  const definition = getFeature(featureId);
  const lang = normalizeAppLanguage(language);
  const L = (tr, en, es, pt, de, it) => pickByLanguage(lang, { tr, en, es, pt: pt ?? en, de: de ?? en, it: it ?? en });
  const normalized = normalizePlan(plan);
  const canUpgrade = Boolean(nextPlanFor(featureId, normalized));

  if (!definition) {
    return {
      title: L("Premium özelliği", "Premium feature", "Función Premium", "Recurso Premium", "Premium-Funktion", "Funzione Premium"),
      message: "",
      canUpgrade: false,
    };
  }

  // ACCESS ya da bu planda kapalı (limit 0) bir sayılı özellik.
  if (definition.kind === ACCESS || isLockedFor(featureId, normalized)) {
    const title = pick(definition.title, language);
    // Yalnız Max'in açtığı erişim özelliği (özellik isteği) "Premium ve Premium
    // Max'te açık" demez: Premium'da kilitlidir.
    if (definition.kind === ACCESS && definition.minPlan === PREMIUM_PLAN.UNLIMITED) {
      return {
        title: L("Premium Max özelliği", "Premium Max feature", "Función Premium Max", "Recurso Premium Max", "Premium-Max-Funktion", "Funzione Premium Max"),
        message: L(
          `${title} yalnızca Premium Max planında açık.`,
          `${title} is included in Premium Max only.`,
          `${title} está incluido solo en Premium Max.`, `${title} está incluído apenas no Premium Max.`, `${title} ist nur in Premium Max enthalten.`, `${title} è incluso solo in Premium Max.`,
        ),
        canUpgrade,
      };
    }
    return {
      title: L("Premium özelliği", "Premium feature", "Función Premium", "Recurso Premium", "Premium-Funktion", "Funzione Premium"),
      message: L(
        `${title} Premium ve Premium Max planlarında açık.`,
        `${title} is included in Premium and Premium Max.`,
        `${title} está incluido en Premium y Premium Max.`, `${title} está incluído no Premium e no Premium Max.`, `${title} ist in Premium und Premium Max enthalten.`, `${title} è incluso in Premium e Premium Max.`,
      ),
      canUpgrade,
    };
  }

  const base = describeCurrentLimit(featureId, normalized, language);
  const upgrade = canUpgrade ? upgradeSentence(featureId, normalized, language) : "";
  const renew =
    definition.kind === DAILY
      ? L("Hakların yarın yenilenir.", "Your limit resets tomorrow.", "Tu límite se restablece mañana.", "Seu limite é redefinido amanhã.", "Dein Limit wird morgen zurückgesetzt.", "Il tuo limite si azzera domani.")
      : "";

  return {
    title:
      definition.kind === DAILY
        ? L("Bugünkü hakkın doldu", "Today's limit reached", "Has alcanzado el límite de hoy", "Você atingiu o limite de hoje", "Tageslimit erreicht", "Limite di oggi raggiunto")
        : L("Limite ulaştın", "Limit reached", "Has alcanzado el límite", "Você atingiu o limite", "Limit erreicht", "Limite raggiunto"),
    message: [base, upgrade, renew].filter(Boolean).join(" "),
    canUpgrade,
  };
}

/**
 * Ödeme ekranı karşılaştırma tablosu: kategori → satırlar → plan değerleri.
 * Sıra FEATURE_CATEGORIES ve PREMIUM_FEATURES tanım sırasını izler.
 */
export function getComparisonSections(language = "en") {
  return FEATURE_CATEGORIES.map((category) => ({
    id: category.id,
    icon: category.icon,
    color: category.color,
    title: pick(category.title, language),
    rows: FEATURE_IDS.filter(
      (id) => PREMIUM_FEATURES[id].category === category.id,
    ).map((id) => {
      const definition = PREMIUM_FEATURES[id];
      return {
        id,
        icon: definition.icon,
        title: pick(definition.title, language),
        detail: definition.detail ? pick(definition.detail, language) : null,
        note: definition.note ? pick(definition.note, language) : null,
        values: Object.fromEntries(
          PLAN_ORDER.map((plan) => [plan, formatFeatureValue(id, plan, language)]),
        ),
      };
    }),
  })).filter((section) => section.rows.length > 0);
}
