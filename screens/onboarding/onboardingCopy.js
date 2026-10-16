// screens/onboarding/onboardingCopy.js
//
// Tanıtım akışının metinleri. Onboarding oturum ve dil ayarı açılmadan ÖNCE
// gösterildiği için çeviri dosyasına değil buraya yazılır (tr / en / es).
// Saf veri: RN içe aktarması yok, jest ile doğrudan test edilebilir.

import { copyLanguage } from "../../utils/appLanguages";

export const ONBOARDING_COPY = {
  tr: {
    tagline: "Ne izleyeceğini bul. İzlediklerini hatırla. Hikâyeni paylaş.",
    introEyebrow: "SENİN İZLEME EVRENİN",
    introTap: "Devam etmek için dokun",
    skip: "Atla",
    next: "Devam Et",
    start: "Son Adım",
    back: "Geri",
    language: "English",
    features: [
      {
        kind: "discover",
        icon: "compass-outline",
        eyebrow: "KEŞFET & TAKİP ET",
        title: "Sıradaki favorin burada.",
        titleAccent: "favorin",
        desc: "Binlerce film ve diziyi keşfet; izlediklerini, favorilerini ve izleme listeni tek bir yerde düzenle.",
        tags: ["Akıllı keşif", "Kişisel listeler", "Film & dizi"],
      },
      {
        kind: "ai",
        icon: "sparkles-outline",
        eyebrow: "SEELOGD AI",
        title: "“Ne izlesem?” sorusu bitti.",
        titleAccent: "“Ne izlesem?”",
        desc: "Tek soruya beş farklı cevap stili: öneri, karşılaştırma, izleme planı, liste ve künye — hepsi bir arada.",
        tags: ["Kişisel öneri", "Karşılaştırma", "İzleme planı"],
      },
      {
        kind: "profile",
        icon: "stats-chart-outline",
        eyebrow: "PAYLAŞ & HATIRLA",
        title: "İzleme hikâyen sana özel.",
        titleAccent: "sana özel",
        desc: "İstatistiklerini ve Wrapped'ını gör; arkadaşlarınla paylaş, sahne oyununda yarış ve izlediklerini unutma.",
        tags: ["Wrapped", "Arkadaşlar", "Oyunlar"],
      },
    ],
    genre: {
      eyebrow: "SANA GÖRE KEŞİF",
      title: "Zevkini birlikte ayarlayalım.",
      titleAccent: "Zevkini",
      desc: "Film ve diziler için ayrı ayrı en fazla 3 tür seç; keşif alanların buna göre şekillensin.",
      movies: "Filmler",
      shows: "Diziler",
      max: "En fazla 3",
      pickHint: "Bir tür seç",
    },
    provider: {
      eyebrow: "PLATFORMLARIN",
      title: "Hangi platformları izliyorsun?",
      titleAccent: "platformları",
      desc: "Bölgendeki gerçek film ve dizi kataloglarını gösteriyoruz. Seçtiklerin üyelik önerilerini ve platform sıralamasını belirler.",
      movies: "Filmler",
      shows: "Diziler",
      selected: (n) => (n === 0 ? "Henüz seçmedin" : `${n} platform seçildi`),
      more: "Daha fazla göster",
      less: "Daha az göster",
      hint: "Ayarlar'dan istediğin zaman değiştirebilirsin.",
    },
    favorites: {
      eyebrow: "PROFİLİNİN VİTRİNİ",
      title: "Seni anlatan favorilerin.",
      titleAccent: "favorilerin",
      desc: "Her kategoride en fazla 4 favori seç. Arkadaşların profilinde görür, önerilerin de buna göre şekillenir.",
      selected: (n) => (n === 0 ? "Henüz seçmedin" : `${n} favori seçildi`),
      hint: "İstersen atla; Profili Düzenle'den sonra da ekleyebilirsin.",
    },
    cta: {
      freeBadge: "ÜCRETSİZ BAŞLA",
      title: "İzleme hikâyen şimdi başlıyor.",
      titleAccent: "şimdi",
      desc: "Ücretsiz hesabını oluştur; keşfetmeye, biriktirmeye ve paylaşmaya hemen başla.",
      benefits: [
        { icon: "cloud-done-outline", text: "Listelerin her cihazda seninle" },
        { icon: "sparkles-outline", text: "Sana özel keşif ve öneriler" },
        { icon: "people-outline", text: "Arkadaşlarınla ortak bir izleme alanı" },
      ],
      register: "Ücretsiz Kayıt Ol",
      haveAccount: "Zaten hesabın var mı?",
      login: "Giriş Yap",
      trust: "Ücretsiz · Kredi kartı gerekmez · 1 dakikada hazır",
    },
  },
  en: {
    tagline: "Find what to watch. Remember what you loved. Share your story.",
    introEyebrow: "YOUR WATCHING UNIVERSE",
    introTap: "Tap to continue",
    skip: "Skip",
    next: "Continue",
    start: "Final Step",
    back: "Back",
    language: "Español",
    features: [
      {
        kind: "discover",
        icon: "compass-outline",
        eyebrow: "DISCOVER & TRACK",
        title: "Your next favorite is here.",
        titleAccent: "favorite",
        desc: "Discover thousands of movies and shows, then organize everything you watched, loved and plan to see in one place.",
        tags: ["Smart discovery", "Personal lists", "Movies & shows"],
      },
      {
        kind: "ai",
        icon: "sparkles-outline",
        eyebrow: "SEELOGD AI",
        title: "Never wonder what to watch.",
        titleAccent: "what to watch",
        desc: "One question, five answer styles: picks, comparisons, watch plans, lists and spotlights — all at once.",
        tags: ["Personal picks", "Compare", "Watch plans"],
      },
      {
        kind: "profile",
        icon: "stats-chart-outline",
        eyebrow: "SHARE & REMEMBER",
        title: "Your watching story is yours.",
        titleAccent: "is yours",
        desc: "See your stats and Wrapped, share with friends, compete in scene games and never lose track of a watch.",
        tags: ["Wrapped", "Friends", "Games"],
      },
    ],
    genre: {
      eyebrow: "DISCOVERY FOR YOU",
      title: "Let's tune your taste.",
      titleAccent: "taste",
      desc: "Pick up to 3 genres for movies and for shows separately; your discovery will follow them.",
      movies: "Movies",
      shows: "TV Shows",
      max: "Up to 3",
      pickHint: "Pick a genre",
    },
    provider: {
      eyebrow: "YOUR SERVICES",
      title: "Which services do you watch?",
      titleAccent: "services",
      desc: "These are the real movie and TV catalogs in your region. Your picks shape subscription suggestions and provider order.",
      movies: "Movies",
      shows: "TV Shows",
      selected: (n) => (n === 0 ? "None selected yet" : `${n} selected`),
      more: "Show more",
      less: "Show less",
      hint: "You can change this anytime in Settings.",
    },
    favorites: {
      eyebrow: "YOUR PROFILE SHOWCASE",
      title: "The picks that define you.",
      titleAccent: "define you",
      desc: "Choose up to 4 favorites in each category. Friends see them on your profile and your suggestions follow them.",
      selected: (n) => (n === 0 ? "None selected yet" : `${n} selected`),
      hint: "Skip it if you like — you can add them later in Edit Profile.",
    },
    cta: {
      freeBadge: "START FOR FREE",
      title: "Your watching story starts now.",
      titleAccent: "now",
      desc: "Create your free account and start discovering, collecting and sharing today.",
      benefits: [
        { icon: "cloud-done-outline", text: "Your lists on every device" },
        { icon: "sparkles-outline", text: "Discovery tailored to your taste" },
        { icon: "people-outline", text: "A shared watch space with friends" },
      ],
      register: "Sign Up Free",
      haveAccount: "Already have an account?",
      login: "Log In",
      trust: "Free · No credit card · Ready in a minute",
    },
  },
  es: {
    tagline: "Descubre qué ver. Recuerda lo que te encantó. Comparte tu historia.",
    introEyebrow: "TU UNIVERSO DE CINE Y SERIES",
    introTap: "Toca para continuar",
    skip: "Omitir",
    next: "Continuar",
    start: "Último paso",
    back: "Atrás",
    language: "Türkçe",
    features: [
      {
        kind: "discover",
        icon: "compass-outline",
        eyebrow: "DESCUBRE Y SIGUE",
        title: "Tu próximo favorito está aquí.",
        titleAccent: "favorito",
        desc: "Descubre miles de películas y series, y organiza en un solo lugar todo lo que has visto, lo que te ha encantado y lo que quieres ver.",
        tags: ["Descubrimiento inteligente", "Listas personales", "Películas y series"],
      },
      {
        kind: "ai",
        icon: "sparkles-outline",
        eyebrow: "SEELOGD IA",
        title: "Se acabó el «¿qué veo?».",
        titleAccent: "«¿qué veo?»",
        desc: "Una pregunta, cinco estilos de respuesta: recomendaciones, comparaciones, planes de visionado, listas y fichas, todo a la vez.",
        tags: ["Recomendaciones personales", "Comparar", "Planes de visionado"],
      },
      {
        kind: "profile",
        icon: "stats-chart-outline",
        eyebrow: "COMPARTE Y RECUERDA",
        title: "Tu historia como espectador es solo tuya.",
        titleAccent: "solo tuya",
        desc: "Consulta tus estadísticas y tu Wrapped, compártelos con tus amigos, compite en el juego de escenas y no pierdas la cuenta de nada.",
        tags: ["Wrapped", "Amigos", "Juegos"],
      },
    ],
    genre: {
      eyebrow: "DESCUBRIMIENTO PARA TI",
      title: "Afinemos juntos tus gustos.",
      titleAccent: "gustos",
      desc: "Elige hasta 3 géneros para películas y otros 3 para series; tu descubrimiento se adaptará a ellos.",
      movies: "Películas",
      shows: "Series",
      max: "Máximo 3",
      pickHint: "Elige un género",
    },
    provider: {
      eyebrow: "TUS PLATAFORMAS",
      title: "¿Qué plataformas usas?",
      titleAccent: "plataformas",
      desc: "Mostramos los catálogos reales de películas y series de tu región. Lo que elijas define las sugerencias de suscripción y el orden de las plataformas.",
      movies: "Películas",
      shows: "Series",
      selected: (n) => (n === 0 ? "Aún no has elegido ninguna" : n === 1 ? "1 elegida" : `${n} elegidas`),
      more: "Mostrar más",
      less: "Mostrar menos",
      hint: "Puedes cambiarlo cuando quieras en Ajustes.",
    },
    favorites: {
      eyebrow: "EL ESCAPARATE DE TU PERFIL",
      title: "Los favoritos que te definen.",
      titleAccent: "te definen",
      desc: "Elige hasta 4 favoritos en cada categoría. Tus amigos los verán en tu perfil y tus recomendaciones se adaptarán a ellos.",
      selected: (n) => (n === 0 ? "Aún no has elegido ninguno" : n === 1 ? "1 favorito elegido" : `${n} favoritos elegidos`),
      hint: "Si quieres, sáltalo; también puedes añadirlos más tarde en Editar perfil.",
    },
    cta: {
      freeBadge: "EMPIEZA GRATIS",
      title: "Tu historia como espectador empieza ahora.",
      titleAccent: "ahora",
      desc: "Crea tu cuenta gratuita y empieza hoy a descubrir, coleccionar y compartir.",
      benefits: [
        { icon: "cloud-done-outline", text: "Tus listas, en todos tus dispositivos" },
        { icon: "sparkles-outline", text: "Descubrimiento a la medida de tus gustos" },
        { icon: "people-outline", text: "Un espacio compartido con tus amigos" },
      ],
      register: "Regístrate gratis",
      haveAccount: "¿Ya tienes una cuenta?",
      login: "Iniciar sesión",
      trust: "Gratis · Sin tarjeta de crédito · Listo en un minuto",
    },
  },
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı). Dil, onboarding'de
// `copyLanguage(language, Object.keys(ONBOARDING_COPY))` ile zaten normalize gelir.
export const getOnboardingCopy = (language) =>
  ONBOARDING_COPY[copyLanguage(language, Object.keys(ONBOARDING_COPY))];

// Akışın sırası. `kind` analitik adım adıyla (step_name) birebir bağlıdır:
// değiştirirsen mevcut huni raporları bozulur.
//
// "favorites" CTA'dan hemen önce: mevcut adımların adları ve sıraları aynı kaldı,
// yalnız kayıt slaytının `step_number`ı 6 → 7 oldu. Ortaya eklenseydi profil
// tanıtımı ve kayıt adımı birlikte kayardı.
export const ONBOARDING_STEP_ORDER = Object.freeze([
  { type: "feature", featureIndex: 0 },
  { type: "preference", kind: "genre" },
  { type: "feature", featureIndex: 1 },
  { type: "preference", kind: "provider" },
  { type: "feature", featureIndex: 2 },
  { type: "preference", kind: "favorites" },
  { type: "cta" },
]);

// Analitikteki adım adı (ONBOARDING_STEP_VIEWED.step_name).
export function onboardingStepName(step, copy) {
  if (!step) return "unknown";
  if (step.type === "cta") return "account_cta";
  if (step.type === "preference") return `${step.kind}_preferences`;
  return copy.features[step.featureIndex]?.kind || "unknown";
}
