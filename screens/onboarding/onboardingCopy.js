// screens/onboarding/onboardingCopy.js
//
// Tanıtım akışının metinleri. Onboarding oturum ve dil ayarı açılmadan ÖNCE
// gösterildiği için çeviri dosyasına değil buraya yazılır (tr / en).
// Saf veri: RN içe aktarması yok, jest ile doğrudan test edilebilir.

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
    language: "Türkçe",
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
};

export const getOnboardingCopy = (language) =>
  ONBOARDING_COPY[language === "en" ? "en" : "tr"];

// Akışın sırası. `kind` analitik adım adıyla (step_name) birebir bağlıdır:
// değiştirirsen mevcut huni raporları bozulur.
export const ONBOARDING_STEP_ORDER = Object.freeze([
  { type: "feature", featureIndex: 0 },
  { type: "preference", kind: "genre" },
  { type: "feature", featureIndex: 1 },
  { type: "preference", kind: "provider" },
  { type: "feature", featureIndex: 2 },
  { type: "cta" },
]);

// Analitikteki adım adı (ONBOARDING_STEP_VIEWED.step_name).
export function onboardingStepName(step, copy) {
  if (!step) return "unknown";
  if (step.type === "cta") return "account_cta";
  if (step.type === "preference") return `${step.kind}_preferences`;
  return copy.features[step.featureIndex]?.kind || "unknown";
}
