import { Keys, get, set } from "./storage";

// ── Tüm Harici ve Ekosistem Servisleri Maliyet Rehberi ────────────────────────
export const ALL_ECOSYSTEM_SERVICES = {
  appleDev: {
    id: "appleDev",
    name: "Apple Developer Program",
    category: "Mağaza & Dağıtım",
    icon: "logo-apple",
    color: "#A2AAAD",
    pricingUsd: "$99 / yıl",
    pricingTry: "≈ 4.950 TL / yıl",
    badge: "Zorunlu Yıllık",
    badgeColor: "#FF9800",
    freeQuota: "Ücretsiz katman yok",
    limits: "Sınırsız yayınlama + TestFlight 10.000 kullanıcı",
    notes: "iOS kullanıcılarına uygulamayı App Store üzerinden ulaştırmak ve TestFlight dağıtımı yapmak için Apple'a ödenen yıllık sabit ücrettir.",
  },
  googlePlay: {
    id: "googlePlay",
    name: "Google Play Console",
    category: "Mağaza & Dağıtım",
    icon: "logo-google-playstore",
    color: "#00E676",
    pricingUsd: "$25 Tek Seferlik",
    pricingTry: "≈ 1.250 TL (Ömür Boyu)",
    badge: "Tek Seferlik",
    badgeColor: "#29B864",
    freeQuota: "Ömür boyu geçerli",
    limits: "Sınırsız uygulama yayınlama + Dahili / Açık test kanalları",
    notes: "Android kullanıcılarına Google Play üzerinden dağıtım yapmak için bir kez ödenir, yıllık yenileme ücreti yoktur.",
  },
  tmdb: {
    id: "tmdb",
    name: "TMDB API (The Movie Database)",
    category: "Film / Dizi Veri Tabanı",
    icon: "film",
    color: "#01D277",
    pricingUsd: "$0.00 (Ücretsiz)",
    pricingTry: "0 TL",
    badge: "100% Ücretsiz",
    badgeColor: "#29B864",
    freeQuota: "Sınırsız Aylık İstek",
    limits: "Hız Sınırı: ~40-50 istek / saniye",
    notes: "Ticari olmayan mobil uygulamalar için tamamen ücretsizdir. Uygulamadaki SWR ve MMKV önbelleği sayesinde isteklerin %80'i sunucuya gitmeden bellekten karşılanır.",
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini 2.5 Flash",
    category: "Yapay Zeka & Asistan",
    icon: "sparkles",
    color: "#C25AFF",
    pricingUsd: "Giriş: $0.15/1M · Çıkış: $0.60/1M",
    pricingTry: "Giriş: 7.5 TL/1M · Çıkış: 30 TL/1M",
    badge: "Kullandıkça Öde",
    badgeColor: "#C25AFF",
    freeQuota: "Google AI Studio: 1.500 İstek/Gün Ücretsiz",
    limits: "15 RPM (İstek/Dk) · 1.000.000 TPM",
    notes: "CineMatch Pro asistanında film/dizi tavsiyesi üretir. Çıkış token'ları 4 kat pahalı olduğu için yanıtlar kısa ve JSON formatında tutulmalıdır.",
  },
  revenueCat: {
    id: "revenueCat",
    name: "RevenueCat (Abonelik / Premium)",
    category: "Abonelik & Gelir",
    icon: "card",
    color: "#E91E63",
    pricingUsd: "$2.500/ay gelire kadar $0",
    pricingTry: "≈ 125.000 TL/ay gelire kadar 0 TL",
    badge: "Gelire Kadar $0",
    badgeColor: "#29B864",
    freeQuota: "$2.500 Aylık Gelire Kadar Ücretsiz",
    limits: "$2.500 üstü cirodan %1 komisyon",
    notes: "Uygulama içi satın alma, abonelik ve paywall yönetimini sağlar. Aylık gelir 125.000 TL'yi geçene kadar hiçbir ücret kesilmez.",
  },
  firebase: {
    id: "firebase",
    name: "Google Firebase (Blaze Plan)",
    category: "Bulut & Veritabanı",
    icon: "server",
    color: "#FFA000",
    pricingUsd: "No-Cost Tier Limitleri Dahilinde $0",
    pricingTry: "Kotalar Aşılmadıkça 0 TL",
    badge: "Ücretsiz Kotalı",
    badgeColor: "#29B864",
    freeQuota: "50k Okuma/Gün · 20k Yazma/Gün · 2M Functions/Ay · 50k Auth/Ay",
    limits: "Aşımda: 100k okuma = 3.00 TL, 1M Functions = 20.00 TL",
    notes: "Firestore, Cloud Functions, Realtime DB, Authentication ve Hosting altyapısını sağlar.",
  },
  sentry: {
    id: "sentry",
    name: "Sentry (Hata & Çökme Takibi)",
    category: "Hata & Telemetri",
    icon: "bug",
    color: "#6C5CE7",
    pricingUsd: "Geliştirici Planı: $0",
    pricingTry: "0 TL",
    badge: "Ücretsiz Plan",
    badgeColor: "#29B864",
    freeQuota: "Aylık 5.000 Hata + 10.000 İşlem",
    limits: "Kota aşımında loglama durur, ekstra ücret kesilmez",
    notes: "Uygulamadaki istisnaları (exception) ve çökmeleri yakalar. Yalnızca kritik hatalar loglandığı için kota içinde kalır.",
  },
  expoEas: {
    id: "expoEas",
    name: "Expo EAS (Bulut Derleme)",
    category: "CI/CD & Derleme",
    icon: "construct",
    color: "#00BCD4",
    pricingUsd: "Free Plan: $0",
    pricingTry: "0 TL",
    badge: "30 Build/Ay",
    badgeColor: "#00BCD4",
    freeQuota: "Aylık 30 Bulut Derleme (iOS IPA / Android APK)",
    limits: "Yerel derlemede (`expo run`) sınırsız ve $0",
    notes: "Bulut üzerinden otomatik iOS/Android derlemeleri ve canlı OTA güncellemeleri sağlar.",
  },
};

// ── Güncel Firebase & Gemini Resmi Fiyatlandırma Politikası ───────────────────
export const FIREBASE_LIMITS = {
  firestore: {
    name: "Cloud Firestore",
    freeTier: {
      reads: "50.000 / gün (50K / day)",
      writes: "20.000 / gün (20K / day)",
      deletes: "20.000 / gün (20K / day)",
      storage: "1 GB toplam",
      bandwidth: "10 GB / ay",
    },
    pricingAfterFree: {
      readsPer100k: "$0.06 (100k okuma = ₺3.00)",
      writesPer100k: "$0.18 (100k yazma = ₺9.00)",
      deletesPer100k: "$0.02 (100k silme = ₺1.00)",
      storagePerGb: "$0.18 / GB / ay (₺9.00)",
      bandwidthPerGb: "$0.12 / GB (₺6.00)",
    },
    limits: {
      dailyFreeReads: 50000,
      dailyFreeWrites: 20000,
      dailyFreeDeletes: 20000,
    },
  },
  functions: {
    name: "Cloud Functions",
    freeTier: {
      invocations: "2.000.000 / ay (2M / month)",
      computeTime: "400.000 GB-s / ay",
      cpuTime: "200.000 GHz-s / ay",
      outboundData: "5 GB / ay",
    },
    pricingAfterFree: {
      invocationsPerMillion: "$0.40 / 1.000.000 çağrı (₺20.00)",
      computeGbSecond: "$0.0000025 / GB-s",
    },
    limits: {
      monthlyFreeCalls: 2000000,
    },
  },
  auth: {
    name: "Firebase Authentication",
    freeTier: {
      activeUsers: "50.000 MAU / ay (50K / month)",
      smsVerification: "10 SMS / gün",
    },
    pricingAfterFree: {
      mauCost: "$0.0055 / aktif kullanıcı (50k - 100k arası)",
      smsCost: "~$0.01 - $0.06 / SMS",
    },
    limits: {
      monthlyFreeUsers: 50000,
      dailyFreeSms: 10,
    },
  },
  rtdb: {
    name: "Realtime Database",
    freeTier: {
      storage: "1 GB toplam",
      downloads: "360 MB / gün (10 GB / ay)",
      connections: "100 eşzamanlı bağlantı",
    },
    pricingAfterFree: {
      storagePerGb: "$5.00 / GB / ay",
      downloadsPerGb: "$1.00 / GB",
    },
    limits: {
      dailyFreeDownloadMb: 360,
    },
  },
  hosting: {
    name: "Firebase Hosting",
    freeTier: {
      storage: "10 GB toplam",
      downloads: "360 MB / gün (10 GB / ay)",
    },
    pricingAfterFree: {
      storagePerGb: "$0.026 / GB / ay",
      downloadsPerGb: "$0.15 / GB",
    },
    limits: {
      dailyFreeDownloadMb: 360,
    },
  },
  storage: {
    name: "Cloud Storage",
    freeTier: {
      storage: "5 GB toplam",
      downloads: "1 GB / gün",
      uploadOps: "20.000 / gün",
      downloadOps: "50.000 / gün",
    },
    pricingAfterFree: {
      storagePerGb: "$0.026 / GB / ay",
      downloadsPerGb: "$0.12 / GB",
    },
  },
};

// ── Gemini AI Modelleri ve Giriş / Çıkış Fiyatlandırması ───────────────────────
export const GEMINI_MODELS = {
  "gemini-2.5-flash": {
    name: "Gemini 2.5 Flash",
    description: "Varsayılan Hızlı & Akıllı Model (CineMatch Pro)",
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    thinkingPricePerMillion: 0.60,
    outputToInputRatio: 4.0,
  },
  "gemini-2.0-flash": {
    name: "Gemini 2.0 Flash",
    description: "Düşük Gecikmeli Yeni Nesil Flash",
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.40,
    thinkingPricePerMillion: 0.40,
    outputToInputRatio: 4.0,
  },
  "gemini-1.5-flash": {
    name: "Gemini 1.5 Flash",
    description: "Ekonomik Standart Flash",
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    thinkingPricePerMillion: 0.30,
    outputToInputRatio: 4.0,
  },
  "gemini-1.5-pro": {
    name: "Gemini 1.5 Pro",
    description: "Büyük Muhakeme & Ağır Görev Modeli",
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.00,
    thinkingPricePerMillion: 5.00,
    outputToInputRatio: 4.0,
  },
};

export const PRICING = {
  firestoreReadPer100k: 0.06,
  firestoreWritePer100k: 0.18,
  firestoreDeletePer100k: 0.02,
  firestoreFreeReadsDaily: 50000,
  firestoreFreeWritesDaily: 20000,
  firestoreFreeDeletesDaily: 20000,

  functionsPerMillion: 0.40,
  functionsFreeMonthly: 2000000,

  usdToTryRate: 50.0,
};

// ── Alan / Modül / Bölge Tanımları (Hotspot Tespiti İçin) ─────────────────────
export const ZONES = {
  social: {
    id: "social",
    name: "Sosyal & Paylaşımlar",
    icon: "chatbubbles",
    color: "#E91E63",
    description: "Gönderiler (Feed), Yorumlar, Beğeniler, Paylaşım Akışı",
    riskLevel: "YÜKSEK OKUMA RİSKİ",
    riskDesc: "Kullanıcılar akışta kaydırdıkça çok sayıda post ve yorum okunur. Sayfalama (Pagination: 15-20) şarttır.",
  },
  lists: {
    id: "lists",
    name: "Listeler & İzleme Geçmişi",
    icon: "list",
    color: "#29B864",
    description: "İzlenen Filmler, Diziler, Favoriler, Ortak & Özel Listeler, v3 Durum İndeksi",
    riskLevel: "MİKRO OKUMA (v3 İndeks & Delta Sync)",
    riskDesc: "Lists/{uid} kök durum indeksi (%99.9 okuma tasarrufu) ve Delta Sync ile yerel diskten anında açılır. Yazma anında ön-hesaplanan stats sayesinde CPU yükü sıfırdır.",
  },
  chat: {
    id: "chat",
    name: "Mesajlaşma & Sohbet",
    icon: "paper-plane",
    color: "#00BCD4",
    description: "Birebir Sohbet, Grup Sohbeti, Okundu Bilgisi",
    riskLevel: "YÜKSEK YAZMA RİSKİ",
    riskDesc: "Her mesaj bir yazma, her okuma bir snapshot'tır. Ephemeral durumlar (yazıyor/online) RTDB'dedir ($0).",
  },
  profile: {
    id: "profile",
    name: "Profil & Arkadaşlar",
    icon: "people",
    color: "#9C27B0",
    description: "Profil Bilgileri, Arkadaş Listesi, İstekler, Rozetler",
    riskLevel: "DÜŞÜK - ORTA",
    riskDesc: "Kullanıcı profili ve arkadaşlık durumu önbelleklenir.",
  },
  tmdb: {
    id: "tmdb",
    name: "TMDB Medya Keşfi",
    icon: "film",
    color: "#FF9800",
    description: "Film/Dizi Arama, Detaylar, Sezonlar, Fragmanlar",
    riskLevel: "ÜCRETSİZ / HIZ SINIRI KORUMASI",
    riskDesc: "TMDB API ücretsizdir. SWR önbelleği sayesinde aynı istekler 24 saat boyunca internete çıkmaz.",
  },
  gemini: {
    id: "gemini",
    name: "Gemini AI Asistanı",
    icon: "sparkles",
    color: "#C25AFF",
    description: "CineMatch Pro, Yapay Zeka Film/Dizi Önerileri",
    riskLevel: "TOKEN MALİYETİ DİKKATİ",
    riskDesc: "Çıkış token'ı üretimi girişten 4 kat daha maliyetlidir. Yanıtlar kısa ve JSON tutulmalıdır.",
  },
  games: {
    id: "games",
    name: "CineSwipe & Oyunlar",
    icon: "game-controller",
    color: "#FF5722",
    description: "CineSwipe Odaları, Sahne Tahmin Oyunu, Turnuvalar",
    riskLevel: "DÜŞÜK",
    riskDesc: "Kısa süreli oyun oturumları. Tamamlandığında skor tek seferde kaydedilir.",
  },
  notifications: {
    id: "notifications",
    name: "Bildirimler & Functions",
    icon: "notifications",
    color: "#3F51B5",
    description: "Sosyal Bildirimler, Push Bildirimleri, Arka Plan Tetikleyicileri",
    riskLevel: "ÇOK DÜŞÜK (2M Ücretsiz)",
    riskDesc: "Her bildirim Cloud Function tetikler. 2 Milyon ücretsiz çağrı kotası içinde kalır.",
  },
};

/** Koleksiyon adından ilgili bölgeyi / modülü eşler */
export function resolveZoneFromCollection(collectionName = "") {
  const c = collectionName.toLowerCase();
  if (c.includes("post") || c.includes("like") || c.includes("feed")) {
    return "social";
  }
  if (
    c.includes("list") ||
    c.includes("watched") ||
    c.includes("favorite") ||
    c.includes("customlist") ||
    c.includes("statusindex") ||
    c.includes("activityindex") ||
    c.includes("stats")
  ) {
    return "lists";
  }
  if (c.includes("comment")) {
    return "social";
  }
  if (c.includes("conversation") || c.includes("message") || c.includes("chat")) {
    return "chat";
  }
  if (c.includes("friend") || c.includes("user") || c.includes("follow") || c.includes("block")) {
    return "profile";
  }
  if (c.includes("cineswipe") || c.includes("game") || c.includes("tournament") || c.includes("score")) {
    return "games";
  }
  if (c.includes("notif")) {
    return "notifications";
  }
  return "profile";
}

export function getTodayKey(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDailyBucket(stats, dateKey = getTodayKey()) {
  if (!stats.dailyHistory) {
    stats.dailyHistory = {};
  }
  if (!stats.dailyHistory[dateKey]) {
    const parts = dateKey.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const dateFormatted = d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      weekday: "short",
    });
    stats.dailyHistory[dateKey] = {
      dateKey,
      dateFormatted,
      firestore: {
        reads: 0,
        writes: 0,
        deletes: 0,
      },
      gemini: {
        requests: 0,
        promptTokens: 0,
        outputTokens: 0,
        thoughtsTokens: 0,
        totalTokens: 0,
        promptCostUsd: 0,
        outputCostUsd: 0,
        totalCostUsd: 0,
      },
      functions: {
        totalCalls: 0,
        totalDurationMs: 0,
      },
      tmdb: {
        totalRequests: 0,
        cachedRequests: 0,
        networkRequests: 0,
      },
      zones: {
        gemini: { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 },
        lists: { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 },
        social: { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 },
        chat: { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 },
        profile: { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 },
        tmdb: { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 },
        games: { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 },
        notifications: { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 },
        other: { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 },
      },
      hourlyOps: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      totalCostUsd: 0,
      totalCostTry: 0,
    };
  }
  return stats.dailyHistory[dateKey];
}

const createEmptyStats = () => ({
  startedAt: Date.now(),
  lastUpdatedAt: Date.now(),
  firestore: {
    reads: 0,
    writes: 0,
    deletes: 0,
    snapshots: 0,
    collections: {},
    zones: {
      social: { reads: 0, writes: 0, deletes: 0 },
      lists: { reads: 0, writes: 0, deletes: 0 },
      chat: { reads: 0, writes: 0, deletes: 0 },
      profile: { reads: 0, writes: 0, deletes: 0 },
      games: { reads: 0, writes: 0, deletes: 0 },
      notifications: { reads: 0, writes: 0, deletes: 0 },
    },
  },
  functions: {
    totalCalls: 0,
    totalDurationMs: 0,
    callsByFunction: {},
  },
  gemini: {
    requests: 0,
    promptTokens: 0,
    outputTokens: 0,
    thoughtsTokens: 0,
    totalTokens: 0,
    promptCostUsd: 0,
    outputCostUsd: 0,
    totalCostUsd: 0,
    models: {},
  },
  tmdb: {
    totalRequests: 0,
    cachedRequests: 0,
    networkRequests: 0,
  },
  rtdb: {
    reads: 0,
    writes: 0,
    events: 0,
  },
  network: {
    requests: 0,
    cachedRequests: 0,
    bytesEstimated: 0,
  },
  recentLogs: [],
  dailyHistory: {},
});

let inMemoryStats = null;
const subscribers = new Set();

function loadStats() {
  if (inMemoryStats) return inMemoryStats;
  try {
    const raw = get(Keys.usageStats);
    if (raw && typeof raw === "object") {
      const empty = createEmptyStats();
      inMemoryStats = {
        ...empty,
        ...raw,
        startedAt: raw.startedAt || Date.now(),
        lastUpdatedAt: raw.lastUpdatedAt || Date.now(),
        dailyHistory: { ...(raw.dailyHistory || {}) },
        firestore: {
          ...empty.firestore,
          ...(raw.firestore || {}),
          collections: { ...(raw.firestore?.collections || {}) },
          zones: {
            ...empty.firestore.zones,
            ...(raw.firestore?.zones || {}),
          },
        },
        functions: {
          ...empty.functions,
          ...(raw.functions || {}),
          callsByFunction: { ...(raw.functions?.callsByFunction || {}) },
        },
        gemini: {
          ...empty.gemini,
          ...(raw.gemini || {}),
          models: { ...(raw.gemini?.models || {}) },
        },
        tmdb: {
          ...empty.tmdb,
          ...(raw.tmdb || {}),
        },
        rtdb: {
          ...empty.rtdb,
          ...(raw.rtdb || {}),
        },
        recentLogs: Array.isArray(raw.recentLogs) ? raw.recentLogs : [],
      };
      return inMemoryStats;
    }
  } catch (e) {
    console.warn("[UsageTracker] Error reading stats:", e);
  }
  inMemoryStats = createEmptyStats();
  try {
    set(Keys.usageStats, inMemoryStats);
  } catch {}
  return inMemoryStats;
}

let notifyTimer = null;

function notifySubscribers() {
  if (!inMemoryStats || subscribers.size === 0) return;
  const currentStats = inMemoryStats;
  subscribers.forEach((callback) => {
    try {
      callback(currentStats);
    } catch (e) {
      console.warn("[UsageTracker] Subscriber notification error:", e);
    }
  });
}

function scheduleNotify() {
  // React render döngüsü esnasında (ör. useMemo/seedList/getSwr çağrılarında)
  // başka bir bileşenin state'ini senkron güncellememek ve arka arkaya gelen
  // bildirimleri batch etmek için asenkron (setTimeout) çalıştırıyoruz.
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    notifySubscribers();
  }, 0);
}

function persistAndNotify() {
  if (!inMemoryStats) return;
  inMemoryStats.lastUpdatedAt = Date.now();
  try {
    set(Keys.usageStats, inMemoryStats);
  } catch (e) {
    console.warn("[UsageTracker] Persist error:", e);
  }
  scheduleNotify();
}

function addLogEntry(type, title, detail, cost = 0, zoneId = null, docCount = 1) {
  const stats = loadStats();
  const resolvedZone = zoneId || (
    type === "gemini_ai" ? "gemini" :
    type === "tmdb_request" ? "tmdb" :
    type === "function_call" ? "notifications" :
    type === "rtdb_event" ? "chat" :
    "profile"
  );
  const now = new Date();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    time: Date.now(),
    dateStr: now.toLocaleDateString("tr-TR"),
    timeStr: now.toLocaleTimeString("tr-TR"),
    type,
    zoneId: resolvedZone,
    title,
    detail,
    cost: Number(cost) || 0,
    docCount: Number(docCount) || 1,
  };
  // Kullanıcı talebi: Log kısıtlamasını kaldır, 1000'e kadar tut
  stats.recentLogs = [entry, ...(stats.recentLogs || [])].slice(0, 1000);
}

// ── Dışa Açılan Takip Fonksiyonları ───────────────────────────────────────────

export function getUsageStats() {
  return loadStats();
}

export function subscribeToUsage(listener) {
  subscribers.add(listener);
  listener(loadStats());
  return () => subscribers.delete(listener);
}

export function resetUsageStats() {
  inMemoryStats = createEmptyStats();
  inMemoryStats.startedAt = Date.now();
  inMemoryStats.lastUpdatedAt = Date.now();
  persistAndNotify();
  return inMemoryStats;
}

/** Firestore Okuma Takibi (Koleksiyon ve Bölge Ayrımıyla) */
export function trackFirestoreRead(collectionName = "unknown", count = 1) {
  const stats = loadStats();
  stats.firestore.reads += count;
  if (!stats.firestore.collections[collectionName]) {
    stats.firestore.collections[collectionName] = { reads: 0, writes: 0, deletes: 0 };
  }
  stats.firestore.collections[collectionName].reads += count;

  const zone = resolveZoneFromCollection(collectionName);
  if (!stats.firestore.zones) stats.firestore.zones = createEmptyStats().firestore.zones;
  if (stats.firestore.zones[zone]) {
    stats.firestore.zones[zone].reads += count;
  }

  // Günlük bucket güncellemesi
  const today = getDailyBucket(stats);
  const hour = new Date().getHours();
  today.hourlyOps[hour] = (today.hourlyOps[hour] || 0) + count;
  today.firestore.reads += count;
  if (!today.zones[zone]) today.zones[zone] = { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 };
  today.zones[zone].reads += count;
  today.zones[zone].ops += count;
  const readCost = (count / 1e5) * PRICING.firestoreReadPer100k;
  today.zones[zone].costUsd += readCost;
  today.totalCostUsd += readCost;
  today.totalCostTry = today.totalCostUsd * PRICING.usdToTryRate;

  addLogEntry(
    "firestore_read",
    `Firestore Okuma (${collectionName})`,
    `+${count} döküman [${ZONES[zone]?.name || zone}]`,
    0,
    zone,
    count,
  );
  persistAndNotify();
}

/** Firestore Yazma / Güncelleme Takibi */
export function trackFirestoreWrite(collectionName = "unknown", count = 1) {
  const stats = loadStats();
  stats.firestore.writes += count;
  if (!stats.firestore.collections[collectionName]) {
    stats.firestore.collections[collectionName] = { reads: 0, writes: 0, deletes: 0 };
  }
  stats.firestore.collections[collectionName].writes += count;

  const zone = resolveZoneFromCollection(collectionName);
  if (!stats.firestore.zones) stats.firestore.zones = createEmptyStats().firestore.zones;
  if (stats.firestore.zones[zone]) {
    stats.firestore.zones[zone].writes += count;
  }

  // Günlük bucket güncellemesi
  const today = getDailyBucket(stats);
  const hour = new Date().getHours();
  today.hourlyOps[hour] = (today.hourlyOps[hour] || 0) + count;
  today.firestore.writes += count;
  if (!today.zones[zone]) today.zones[zone] = { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 };
  today.zones[zone].writes += count;
  today.zones[zone].ops += count;
  const writeCost = (count / 1e5) * PRICING.firestoreWritePer100k;
  today.zones[zone].costUsd += writeCost;
  today.totalCostUsd += writeCost;
  today.totalCostTry = today.totalCostUsd * PRICING.usdToTryRate;

  addLogEntry(
    "firestore_write",
    `Firestore Yazma (${collectionName})`,
    `+${count} döküman [${ZONES[zone]?.name || zone}]`,
    0,
    zone,
    count,
  );
  persistAndNotify();
}

/** Firestore Silme Takibi */
export function trackFirestoreDelete(collectionName = "unknown", count = 1) {
  const stats = loadStats();
  stats.firestore.deletes += count;
  if (!stats.firestore.collections[collectionName]) {
    stats.firestore.collections[collectionName] = { reads: 0, writes: 0, deletes: 0 };
  }
  stats.firestore.collections[collectionName].deletes += count;

  const zone = resolveZoneFromCollection(collectionName);
  if (!stats.firestore.zones) stats.firestore.zones = createEmptyStats().firestore.zones;
  if (stats.firestore.zones[zone]) {
    stats.firestore.zones[zone].deletes += count;
  }

  // Günlük bucket güncellemesi
  const today = getDailyBucket(stats);
  const hour = new Date().getHours();
  today.hourlyOps[hour] = (today.hourlyOps[hour] || 0) + count;
  today.firestore.deletes += count;
  if (!today.zones[zone]) today.zones[zone] = { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 };
  today.zones[zone].deletes += count;
  today.zones[zone].ops += count;

  addLogEntry(
    "firestore_delete",
    `Firestore Silme (${collectionName})`,
    `+${count} döküman [${ZONES[zone]?.name || zone}]`,
    0,
    zone,
    count,
  );
  persistAndNotify();
}

/** TMDB İstek & SWR Önbellek Takibi */
export function trackTmdbRequest(endpoint = "", fromCache = false) {
  const stats = loadStats();
  if (!stats.tmdb) stats.tmdb = { totalRequests: 0, cachedRequests: 0, networkRequests: 0 };
  stats.tmdb.totalRequests += 1;
  if (fromCache) {
    stats.tmdb.cachedRequests += 1;
  } else {
    stats.tmdb.networkRequests += 1;
  }

  // Günlük bucket güncellemesi
  const today = getDailyBucket(stats);
  const hour = new Date().getHours();
  today.hourlyOps[hour] = (today.hourlyOps[hour] || 0) + 1;
  today.tmdb.totalRequests += 1;
  if (fromCache) today.tmdb.cachedRequests += 1;
  else today.tmdb.networkRequests += 1;
  if (!today.zones.tmdb) today.zones.tmdb = { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 };
  today.zones.tmdb.ops += 1;

  addLogEntry(
    "tmdb_request",
    `TMDB API (${fromCache ? "Önbellekten / SWR" : "Ağ / HTTP"})`,
    endpoint ? endpoint.slice(0, 40) : "Film/Dizi verisi",
    0,
    "tmdb",
  );
  persistAndNotify();
}

/** Cloud Functions Çağrı Takibi */
export function trackFunctionCall(functionName = "callGemini", durationMs = 0) {
  const stats = loadStats();
  stats.functions.totalCalls += 1;
  stats.functions.totalDurationMs += durationMs;

  if (!stats.functions.callsByFunction[functionName]) {
    stats.functions.callsByFunction[functionName] = { count: 0, totalDurationMs: 0, lastDurationMs: 0 };
  }
  const fn = stats.functions.callsByFunction[functionName];
  fn.count += 1;
  fn.totalDurationMs += durationMs;
  fn.lastDurationMs = durationMs;

  // Günlük bucket güncellemesi
  const today = getDailyBucket(stats);
  const hour = new Date().getHours();
  today.hourlyOps[hour] = (today.hourlyOps[hour] || 0) + 1;
  today.functions.totalCalls += 1;
  if (!today.zones.notifications) today.zones.notifications = { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 };
  today.zones.notifications.ops += 1;

  addLogEntry(
    "function_call",
    `Function (${functionName})`,
    `${durationMs} ms`,
    0,
    "notifications",
  );
  persistAndNotify();
}

/** Gemini AI İstek & Token Takibi */
export function trackGeminiUsage({
  model = "gemini-2.5-flash",
  promptTokens = 0,
  outputTokens = 0,
  thoughtsTokens = 0,
  costUsd = 0,
} = {}) {
  const stats = loadStats();
  const totalTokens = promptTokens + outputTokens + thoughtsTokens;
  const modelConfig = GEMINI_MODELS[model] || GEMINI_MODELS["gemini-2.5-flash"];

  const promptCost = (promptTokens / 1e6) * modelConfig.inputPricePerMillion;
  const outputCost = ((outputTokens + thoughtsTokens) / 1e6) * modelConfig.outputPricePerMillion;
  const calculatedTotalCost = costUsd || (promptCost + outputCost);

  stats.gemini.requests += 1;
  stats.gemini.promptTokens += promptTokens;
  stats.gemini.outputTokens += outputTokens;
  stats.gemini.thoughtsTokens += thoughtsTokens;
  stats.gemini.totalTokens += totalTokens;
  stats.gemini.promptCostUsd = (stats.gemini.promptCostUsd || 0) + promptCost;
  stats.gemini.outputCostUsd = (stats.gemini.outputCostUsd || 0) + outputCost;
  stats.gemini.totalCostUsd = (stats.gemini.totalCostUsd || 0) + calculatedTotalCost;

  if (!stats.gemini.models[model]) {
    stats.gemini.models[model] = {
      requests: 0,
      promptTokens: 0,
      outputTokens: 0,
      tokens: 0,
      costUsd: 0,
    };
  }
  const m = stats.gemini.models[model];
  m.requests += 1;
  m.promptTokens = (m.promptTokens || 0) + promptTokens;
  m.outputTokens = (m.outputTokens || 0) + outputTokens + thoughtsTokens;
  m.tokens += totalTokens;
  m.costUsd += calculatedTotalCost;

  // Günlük bucket güncellemesi
  const today = getDailyBucket(stats);
  const hour = new Date().getHours();
  today.hourlyOps[hour] = (today.hourlyOps[hour] || 0) + 1;
  today.gemini.requests += 1;
  today.gemini.promptTokens += promptTokens;
  today.gemini.outputTokens += (outputTokens + thoughtsTokens);
  today.gemini.totalTokens += totalTokens;
  today.gemini.totalCostUsd += calculatedTotalCost;
  if (!today.zones.gemini) today.zones.gemini = { reads: 0, writes: 0, deletes: 0, tokens: 0, costUsd: 0, ops: 0 };
  today.zones.gemini.tokens += totalTokens;
  today.zones.gemini.costUsd += calculatedTotalCost;
  today.zones.gemini.ops += 1;
  today.totalCostUsd += calculatedTotalCost;
  today.totalCostTry = today.totalCostUsd * PRICING.usdToTryRate;

  addLogEntry(
    "gemini_ai",
    `Gemini AI (${model})`,
    `${totalTokens.toLocaleString()} token (Giriş: ${promptTokens} | Çıkış: ${outputTokens + thoughtsTokens})`,
    calculatedTotalCost,
    "gemini",
  );
  persistAndNotify();
}

/** Günlük Analitik Verilerini Getirir */
export function getDailyAnalytics(stats = inMemoryStats || createEmptyStats()) {
  const history = stats.dailyHistory || {};
  const todayKey = getTodayKey();

  if (!history[todayKey]) {
    const today = getDailyBucket(stats, todayKey);
    today.firestore.reads = stats.firestore?.reads || 0;
    today.firestore.writes = stats.firestore?.writes || 0;
    today.firestore.deletes = stats.firestore?.deletes || 0;
    today.gemini.requests = stats.gemini?.requests || 0;
    today.gemini.totalTokens = stats.gemini?.totalTokens || 0;
    today.gemini.totalCostUsd = stats.gemini?.totalCostUsd || 0;
    today.tmdb.totalRequests = stats.tmdb?.totalRequests || 0;
    today.tmdb.cachedRequests = stats.tmdb?.cachedRequests || 0;

    Object.entries(stats.firestore?.zones || {}).forEach(([zid, data]) => {
      if (today.zones[zid]) {
        today.zones[zid].reads = data.reads;
        today.zones[zid].writes = data.writes;
        today.zones[zid].deletes = data.deletes;
        today.zones[zid].ops = data.reads + data.writes + data.deletes;
        today.zones[zid].costUsd = ((data.reads / 1e5) * PRICING.firestoreReadPer100k) +
                                   ((data.writes / 1e5) * PRICING.firestoreWritePer100k);
      }
    });
    if (today.zones.gemini) {
      today.zones.gemini.tokens = stats.gemini?.totalTokens || 0;
      today.zones.gemini.costUsd = stats.gemini?.totalCostUsd || 0;
      today.zones.gemini.ops = stats.gemini?.requests || 0;
    }
    if (today.zones.tmdb) {
      today.zones.tmdb.ops = stats.tmdb?.totalRequests || 0;
    }

    const firestoreCost = ((today.firestore.reads / 1e5) * PRICING.firestoreReadPer100k) +
                          ((today.firestore.writes / 1e5) * PRICING.firestoreWritePer100k);
    today.totalCostUsd = firestoreCost + (today.gemini.totalCostUsd || 0);
    today.totalCostTry = today.totalCostUsd * PRICING.usdToTryRate;
  }

  return Object.values(stats.dailyHistory || {}).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

/** Realtime Database İşlemi Takibi */
export function trackRtdbEvent(operation = "presence", detail = "") {
  const stats = loadStats();
  stats.rtdb.events += 1;
  addLogEntry("rtdb_event", `Realtime DB (${operation})`, detail || "Sinyal/Olay", 0, "chat");
  persistAndNotify();
}

/** Network / TMDB API & Cache Kazanç Takibi */
export function trackNetworkRequest(endpoint = "", cached = false) {
  const stats = loadStats();
  stats.network.requests += 1;
  if (cached) {
    stats.network.cachedRequests += 1;
  }
  persistAndNotify();
}

// ── Maliyet ve Rapor Hesaplama ────────────────────────────────────────────────

export function calculateCostSummary(stats = inMemoryStats || createEmptyStats(), customUsdRate = PRICING.usdToTryRate) {
  const usdRate = Number(customUsdRate) || PRICING.usdToTryRate || 50.0;
  const firestore = stats.firestore || {};
  const functions = stats.functions || {};
  const gemini = stats.gemini || {};
  const tmdb = stats.tmdb || { totalRequests: 0, cachedRequests: 0, networkRequests: 0 };

  // Firestore Teorik Faturası (Kota aşılırsa)
  const firestoreReadCost = (firestore.reads / 100000) * PRICING.firestoreReadPer100k;
  const firestoreWriteCost = (firestore.writes / 100000) * PRICING.firestoreWritePer100k;
  const firestoreDeleteCost = (firestore.deletes / 100000) * PRICING.firestoreDeletePer100k;
  const firestoreGrossCost = firestoreReadCost + firestoreWriteCost + firestoreDeleteCost;

  // Cloud Functions Teorik Faturası
  const functionsGrossCost = (functions.totalCalls / 1000000) * PRICING.functionsPerMillion;

  // Gemini Net Faturası
  const geminiPromptCost = gemini.promptCostUsd || ((gemini.promptTokens || 0) / 1e6) * 0.15;
  const geminiOutputCost = gemini.outputCostUsd || (((gemini.outputTokens || 0) + (gemini.thoughtsTokens || 0)) / 1e6) * 0.60;
  const geminiGrossCost = gemini.totalCostUsd || (geminiPromptCost + geminiOutputCost);

  // TMDB Önbellek Verimlilik Oranı
  const tmdbCacheEfficiency = tmdb.totalRequests > 0
    ? Math.round((tmdb.cachedRequests / tmdb.totalRequests) * 100)
    : 0;

  // Toplam Tutar
  const totalUsd = firestoreGrossCost + functionsGrossCost + geminiGrossCost;
  const totalTry = totalUsd * usdRate;

  // Gerçekleşen (Firebase Free Tier uygulandığında net ödenecek)
  const netPayableUsd = geminiGrossCost;
  const netPayableTry = netPayableUsd * usdRate;

  return {
    firestore: {
      readCost: firestoreReadCost,
      readCostTry: firestoreReadCost * usdRate,
      writeCost: firestoreWriteCost,
      writeCostTry: firestoreWriteCost * usdRate,
      deleteCost: firestoreDeleteCost,
      deleteCostTry: firestoreDeleteCost * usdRate,
      totalCost: firestoreGrossCost,
      totalCostTry: firestoreGrossCost * usdRate,
      freeTierCovered: firestore.reads <= PRICING.firestoreFreeReadsDaily,
    },
    functions: {
      totalCost: functionsGrossCost,
      totalCostTry: functionsGrossCost * usdRate,
      freeTierCovered: functions.totalCalls <= PRICING.functionsFreeMonthly,
    },
    gemini: {
      promptCost: geminiPromptCost,
      outputCost: geminiOutputCost,
      totalCost: geminiGrossCost,
      totalCostTry: geminiGrossCost * usdRate,
      outputToInputRatio: geminiPromptCost > 0 ? (geminiOutputCost / geminiPromptCost).toFixed(1) : "4.0",
    },
    tmdb: {
      totalRequests: tmdb.totalRequests,
      cachedRequests: tmdb.cachedRequests,
      networkRequests: tmdb.networkRequests,
      cacheEfficiency: tmdbCacheEfficiency,
    },
    totalUsd,
    totalTry,
    netPayableUsd,
    netPayableTry,
    usdRate,
  };
}

/** Markdown formatında panoya yapıştırılabilir ayrıntılı test raporu */
export function generateMarkdownReport(stats = inMemoryStats || createEmptyStats()) {
  const costs = calculateCostSummary(stats);
  const durationMinutes = Math.max(1, Math.round((Date.now() - (stats.startedAt || Date.now())) / 60000));
  const durationHours = (durationMinutes / 60).toFixed(1);

  return `# Seelogd Test Kullanım ve Maliyet Raporu
**Tarih:** ${new Date().toLocaleString("tr-TR")}
**Test Süresi:** ${durationHours} saat (${durationMinutes} dakika)

---

### 📊 Genel Özet
- **Toplam Firestore İşlemi:** ${(stats.firestore.reads + stats.firestore.writes + stats.firestore.deletes).toLocaleString()} adet
- **Toplam Cloud Functions Çağrısı:** ${stats.functions.totalCalls.toLocaleString()} adet
- **Toplam Gemini AI Token:** ${stats.gemini.totalTokens.toLocaleString()} token (${stats.gemini.requests} istek)
- **TMDB İstekleri & Önbellek:** ${stats.tmdb?.totalRequests || 0} istek (%${costs.tmdb.cacheEfficiency} önbellekten karşılandı)
- **Toplam Tahmini Maliyet:** $${costs.totalUsd.toFixed(5)} (~${costs.totalTry.toFixed(2)} TL)
- **Net Ödenecek (Free Tier Dahil):** $${costs.netPayableUsd.toFixed(5)} (~${costs.netPayableTry.toFixed(2)} TL)

---

### 🗺️ Bölgesel / Modüler Firestore Analizi
${Object.entries(stats.firestore.zones || {})
  .map(([zoneKey, data]) => {
    const zone = ZONES[zoneKey] || { name: zoneKey };
    return `- **${zone.name}:** ${data.reads} okuma | ${data.writes} yazma | ${data.deletes} silme`;
  })
  .join("\n")}

---

### 🤖 Gemini AI Giriş & Çıkış Token Analizi
- **Toplam İstek Sayısı:** ${stats.gemini.requests} adet
- **Giriş Token (Prompt):** ${stats.gemini.promptTokens.toLocaleString()} token ($${costs.gemini.promptCost.toFixed(5)})
- **Çıkış Token (Yanıt + Düşünme):** ${(stats.gemini.outputTokens + stats.gemini.thoughtsTokens).toLocaleString()} token ($${costs.gemini.outputCost.toFixed(5)})
- **Çıkış / Giriş Maliyet Oranı:** Çıkış token'ları girişe göre 4 kat daha pahalıdır.
- **Toplam AI Faturası:** $${costs.gemini.totalCost.toFixed(5)} (~${costs.gemini.totalCostTry.toFixed(2)} TL)

---

### 🎬 TMDB API İstekleri & Tasarruf
- **Toplam İstek:** ${stats.tmdb?.totalRequests || 0} adet
- **Önbellekten (SWR/MMKV) Dönen:** ${stats.tmdb?.cachedRequests || 0} adet (%${costs.tmdb.cacheEfficiency} tasarruf)
- **İnternete Çıkan İstek:** ${stats.tmdb?.networkRequests || 0} adet
- **TMDB Maliyeti:** $0.00 (Ticari olmayan kullanımda ücretsiz)
`;
}

// ── Sıfır Veri Kaybı Garantili Yedekleme & Geri Yükleme (Backup & Restore) ────

/**
 * Kullanım ve maliyet verilerini sıfır kayıpla dışa aktarır.
 * @param {Object} options
 * @param {'string'|'object'} [options.format='string'] - Çıktı formatı
 * @param {boolean} [options.pretty=true] - Okunabilir girintileme
 * @returns {string|object}
 */
export function exportUsageBackup({ format = "string", pretty = true } = {}) {
  const currentStats = loadStats();

  const backupEnvelope = {
    version: 1,
    app: "seelogd",
    type: "usage_telemetry_backup",
    exportedAt: Date.now(),
    exportedAtFormatted: new Date().toLocaleString("tr-TR"),
    session: {
      startedAt: currentStats.startedAt || Date.now(),
      startedAtFormatted: new Date(currentStats.startedAt || Date.now()).toLocaleString("tr-TR"),
      lastUpdatedAt: currentStats.lastUpdatedAt || Date.now(),
      durationMinutes: Math.max(1, Math.round((Date.now() - (currentStats.startedAt || Date.now())) / 60000)),
    },
    summary: {
      firestoreOps:
        (currentStats.firestore?.reads || 0) +
        (currentStats.firestore?.writes || 0) +
        (currentStats.firestore?.deletes || 0),
      geminiTokens: currentStats.gemini?.totalTokens || 0,
      geminiRequests: currentStats.gemini?.requests || 0,
      functionsCalls: currentStats.functions?.totalCalls || 0,
      tmdbRequests: currentStats.tmdb?.totalRequests || 0,
      logCount: Array.isArray(currentStats.recentLogs) ? currentStats.recentLogs.length : 0,
      daysCount: Object.keys(currentStats.dailyHistory || {}).length,
    },
    stats: JSON.parse(JSON.stringify(currentStats)),
  };

  if (format === "object") {
    return backupEnvelope;
  }
  return pretty ? JSON.stringify(backupEnvelope, null, 2) : JSON.stringify(backupEnvelope);
}

/**
 * Gelen yedek verisini doğrular ve özetler.
 * @param {string|object} inputData
 * @returns {{ valid: boolean, error?: string, stats?: object, envelope?: object, summary?: object }}
 */
export function validateUsageBackup(inputData) {
  if (!inputData) {
    return { valid: false, error: "Yedek verisi boş olamaz." };
  }

  let parsed = inputData;
  if (typeof inputData === "string") {
    try {
      parsed = JSON.parse(inputData.trim());
    } catch (e) {
      return { valid: false, error: "Geçersiz JSON formatı: " + e.message };
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return { valid: false, error: "Yedek verisi geçerli bir nesne değil." };
  }

  // Hem envelope formatını hem de doğrudan stats nesnesini destekler
  let statsTarget = parsed.stats || parsed;

  if (!statsTarget || typeof statsTarget !== "object") {
    return { valid: false, error: "Yedek içerisinde istatistik verisi bulunamadı." };
  }

  if (!statsTarget.firestore && !statsTarget.gemini && !statsTarget.startedAt) {
    return { valid: false, error: "Yedek verisi Seelogd telemetri şemasına uymuyor." };
  }

  const firestoreOps =
    (statsTarget.firestore?.reads || 0) +
    (statsTarget.firestore?.writes || 0) +
    (statsTarget.firestore?.deletes || 0);
  const logCount = Array.isArray(statsTarget.recentLogs) ? statsTarget.recentLogs.length : 0;
  const daysCount = Object.keys(statsTarget.dailyHistory || {}).length;
  const startedAt = typeof statsTarget.startedAt === "number" ? statsTarget.startedAt : Date.now();

  return {
    valid: true,
    stats: statsTarget,
    envelope: parsed.type === "usage_telemetry_backup" ? parsed : null,
    summary: {
      startedAt,
      startedAtFormatted: new Date(startedAt).toLocaleString("tr-TR"),
      firestoreOps,
      geminiTokens: statsTarget.gemini?.totalTokens || 0,
      geminiRequests: statsTarget.gemini?.requests || 0,
      functionsCalls: statsTarget.functions?.totalCalls || 0,
      tmdbRequests: statsTarget.tmdb?.totalRequests || 0,
      logCount,
      daysCount,
    },
  };
}

/**
 * Yedek verisini sıfır kayıpla sisteme geri yükler.
 * @param {string|object} inputData
 * @returns {{ success: boolean, error?: string, summary?: object, stats?: object }}
 */
export function importUsageBackup(inputData) {
  const validation = validateUsageBackup(inputData);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const raw = validation.stats;
  const empty = createEmptyStats();

  // Tüm alanları eksiksiz birleştir ve geri yükle
  inMemoryStats = {
    ...empty,
    ...raw,
    startedAt: typeof raw.startedAt === "number" ? raw.startedAt : Date.now(),
    lastUpdatedAt: Date.now(),
    dailyHistory: { ...(raw.dailyHistory || {}) },
    firestore: {
      ...empty.firestore,
      ...(raw.firestore || {}),
      collections: { ...(raw.firestore?.collections || {}) },
      zones: {
        ...empty.firestore.zones,
        ...(raw.firestore?.zones || {}),
      },
    },
    functions: {
      ...empty.functions,
      ...(raw.functions || {}),
      callsByFunction: { ...(raw.functions?.callsByFunction || {}) },
    },
    gemini: {
      ...empty.gemini,
      ...(raw.gemini || {}),
      models: { ...(raw.gemini?.models || {}) },
    },
    tmdb: {
      ...empty.tmdb,
      ...(raw.tmdb || {}),
    },
    rtdb: {
      ...empty.rtdb,
      ...(raw.rtdb || {}),
    },
    network: {
      ...empty.network,
      ...(raw.network || {}),
    },
    recentLogs: Array.isArray(raw.recentLogs) ? [...raw.recentLogs] : [],
  };

  persistAndNotify();

  return {
    success: true,
    summary: validation.summary,
    stats: inMemoryStats,
  };
}

