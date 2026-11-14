// Site ziyaret istatistiği (seelogd.com) — SAF yardımcılar. Uç nokta: index.js → siteBeacon
// (Hosting rewrite /api/beacon), okuyan: website/admin.html (yalnız siteAdmins).
//
// Gizlilik modeli (privacy.html "Web sitesi istatistikleri"):
//   • Çerez yok, kimlik yok, IP SAKLANMAZ (yalnız örnek içi hız sınırlayıcıda anahtar olarak bellekte durur).
//   • Ülke IP'den değil, tarayıcının saat diliminden TAHMİN edilir (countryFromTimeZone). Bilinmeyen dilim → "XX".
//   • Tarayıcı yalnız iki bayrak tutar (localStorage "bugün geldi mi / daha önce geldi mi", sessionStorage oturum).
//   • Yalnız GÜNLÜK TOPLAMLAR yazılır; tek tek ziyaret kaydı yoktur.
//
// Belge: siteStats/{YYYY-MM-DD}_{shard}  (gün İstanbul saatiyle; tek belgeye saniyede ~1 yazma sınırına karşı
// SHARDS parçaya rastgele dağıtılır, panel aynı günün parçalarını toplar).
//   { day, views, sessions, visitors, newcomers, engagedSec,
//     pages{index|privacy|terms|delete|other}, hours{"00".."23"},          ← her görüntüleme
//     refs{direct|google|instagram|…},                                       ← her oturumun girişi
//     countries{TR|DE|…|XX}, langs{tr|en|…}, devices{mobile|tablet|desktop}, os{ios|android|…}  ← günün tekil ziyaretçisi
//     browsers{chrome|safari|…}, siteLangs{tr|en|…}, screens{s|m|l}, returnGap{d1|w1|m1|old}       ← günün tekil ziyaretçisi
//     campaigns{kaynak~kampanya}                                             ← kampanya etiketli oturum girişi
//     engagedSessions, engagedRefs{kaynak}                                   ← 15 sn görünür kalan oturum (bir kez)
//     scroll{25|50|75|100}                                                   ← görüntüleme başına bir kez her eşik
//     actions{waitlist_ok|beta_try|store_google|sec_faq|…}                   ← izinli etkileşim adları (ACTIONS)
//     signups, convRefs{kaynak}, convCountries{TR|…}, convDevices{…}, convLangs{…}  ← başarılı kayıt (bekleme / beta)
//   }
// Kayıt sayıları da yalnız toplamdır: hangi e-postanın hangi kaynaktan geldiği bağlanmaz.
// Olaylar (istemci website/site-beacon.js):
//   { t:"v", p, r, tz, l, d, o, s:yeniOturum, n:bugünİlk, f:ilkKez }   görüntüleme
//   { t:"e", sec }                                                     sayfa gizlenince görünür kalınan saniye
//   { t:"g", r:girişKaynağı }                                         oturum 15 sn görünür kaldı (bir kez)
//   { t:"s", d:25|50|75|100 }                                          kaydırma derinliği eşiği
//   { t:"a", a:eylem, r:girişKaynağı, tz, d, l }                       etkileşim / kayıt

const SHARDS = 4;
const MAX_BODY = 2048;
const MAX_ENGAGED_SEC = 1800; // tek olayda en çok 30 dk (açık unutulan sekme ortalamayı bozmasın)

const PAGES = new Set(["index", "privacy", "terms", "delete", "other"]);
const DEVICES = new Set(["mobile", "tablet", "desktop"]);
const OSES = new Set(["ios", "android", "windows", "macos", "linux", "other"]);
const BROWSERS = new Set(["chrome", "safari", "firefox", "edge", "samsung", "opera", "inapp", "other"]);
const SCREENS = new Set(["s", "m", "l"]);
const SITE_LANGS = new Set(["tr", "en", "es", "pt", "de", "it", "fr", "ja", "zh", "hi", "id", "ko"]);
const SCROLL_DEPTHS = new Set([25, 50, 75, 100]);

/** İzinli etkileşim adları: harita anahtarı istemciden SERBEST gelemez (şişirme / çöp anahtar). */
const ACTIONS = new Set([
  "tab_notify", "tab_beta",
  "waitlist_try", "waitlist_ok", "waitlist_dup", "waitlist_err",
  "beta_try", "beta_ok_android", "beta_ok_ios", "beta_dup", "beta_err",
  "store_apple", "store_google",
  "faq_open", "lang_change", "mock_use", "out_social", "nav_click",
  "sec_numbers", "sec_screens", "sec_features", "sec_plans", "sec_faq", "sec_footer",
]);
/** Başarılı kayıt sayılan eylemler (dönüşüm kırılımları bunlarda yazılır). */
const SIGNUP_ACTIONS = new Set(["waitlist_ok", "beta_ok_android", "beta_ok_ios"]);

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python-requests|axios|node-fetch/i;

/** Bilinen yönlendirenler tek ada toplanır (google.com.tr, l.instagram.com …). Sıra önemli: ilk eşleşen kazanır. */
const REF_GROUPS = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)yandex\./, "yandex"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.me)$/, "facebook"],
  [/^(t\.co|x\.com|twitter\.com|mobile\.twitter\.com)$/, "x"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/^(t\.me|telegram\.org|web\.telegram\.org)$/, "telegram"],
  [/(^|\.)threads\.(net|com)$/, "threads"],
  [/(^|\.)bsky\.app$/, "bluesky"],
  [/^play\.google\.com$/, "play-store"],
  [/^apps\.apple\.com$/, "app-store"],
  [/(^|\.)(seelogd\.com|movieandtv-2832a\.web\.app|movieandtv-2832a\.firebaseapp\.com)$/, "direct"],
];

// IANA saat dilimi → ISO 3166-1 ülke kodu (zone.tab birincil dilimleri + yaygın eski adlar).
// Birden çok ülkenin paylaştığı dilimde (ör. Europe/Zurich) zone.tab'daki ilk ülke yazılır.
const TZ_COUNTRY = {
  // Avrupa
  "Europe/Istanbul": "TR", "Asia/Istanbul": "TR", "Turkey": "TR",
  "Europe/London": "GB", "GB": "GB", "Europe/Belfast": "GB", "Europe/Dublin": "IE", "Europe/Lisbon": "PT",
  "Atlantic/Madeira": "PT", "Atlantic/Azores": "PT", "Europe/Madrid": "ES", "Africa/Ceuta": "ES", "Atlantic/Canary": "ES",
  "Europe/Paris": "FR", "Europe/Brussels": "BE", "Europe/Amsterdam": "NL", "Europe/Luxembourg": "LU", "Europe/Monaco": "MC",
  "Europe/Berlin": "DE", "Europe/Busingen": "DE", "Europe/Zurich": "CH", "Europe/Vaduz": "LI", "Europe/Vienna": "AT",
  "Europe/Rome": "IT", "Europe/Vatican": "VA", "Europe/San_Marino": "SM", "Europe/Malta": "MT", "Europe/Andorra": "AD",
  "Europe/Gibraltar": "GI", "Europe/Copenhagen": "DK", "Europe/Oslo": "NO", "Europe/Stockholm": "SE", "Europe/Helsinki": "FI",
  "Europe/Mariehamn": "AX", "Atlantic/Reykjavik": "IS", "Atlantic/Faroe": "FO", "Europe/Prague": "CZ", "Europe/Bratislava": "SK",
  "Europe/Warsaw": "PL", "Europe/Budapest": "HU", "Europe/Ljubljana": "SI", "Europe/Zagreb": "HR", "Europe/Sarajevo": "BA",
  "Europe/Belgrade": "RS", "Europe/Podgorica": "ME", "Europe/Skopje": "MK", "Europe/Tirane": "AL", "Europe/Athens": "GR",
  "Europe/Sofia": "BG", "Europe/Bucharest": "RO", "Europe/Chisinau": "MD", "Europe/Kiev": "UA", "Europe/Kyiv": "UA",
  "Europe/Uzhgorod": "UA", "Europe/Zaporozhye": "UA", "Europe/Simferopol": "UA", "Europe/Minsk": "BY", "Europe/Vilnius": "LT",
  "Europe/Riga": "LV", "Europe/Tallinn": "EE", "Europe/Moscow": "RU", "Europe/Kaliningrad": "RU", "Europe/Samara": "RU",
  "Europe/Volgograd": "RU", "Europe/Saratov": "RU", "Europe/Ulyanovsk": "RU", "Europe/Astrakhan": "RU", "Europe/Kirov": "RU",
  "Asia/Nicosia": "CY", "Europe/Nicosia": "CY", "Asia/Famagusta": "CY", "Europe/Guernsey": "GG", "Europe/Jersey": "JE",
  "Europe/Isle_of_Man": "IM",
  // Orta Doğu, Kafkasya, Orta Asya
  "Asia/Tbilisi": "GE", "Asia/Yerevan": "AM", "Asia/Baku": "AZ", "Asia/Tehran": "IR", "Asia/Baghdad": "IQ",
  "Asia/Damascus": "SY", "Asia/Beirut": "LB", "Asia/Amman": "JO", "Asia/Jerusalem": "IL", "Asia/Tel_Aviv": "IL",
  "Asia/Gaza": "PS", "Asia/Hebron": "PS", "Asia/Riyadh": "SA", "Asia/Kuwait": "KW", "Asia/Bahrain": "BH", "Asia/Qatar": "QA",
  "Asia/Dubai": "AE", "Asia/Muscat": "OM", "Asia/Aden": "YE", "Asia/Kabul": "AF", "Asia/Tashkent": "UZ",
  "Asia/Samarkand": "UZ", "Asia/Almaty": "KZ", "Asia/Qostanay": "KZ", "Asia/Aqtobe": "KZ", "Asia/Aqtau": "KZ",
  "Asia/Atyrau": "KZ", "Asia/Oral": "KZ", "Asia/Qyzylorda": "KZ", "Asia/Bishkek": "KG", "Asia/Dushanbe": "TJ",
  "Asia/Ashgabat": "TM",
  // Güney / Doğu / Güneydoğu Asya
  "Asia/Karachi": "PK", "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Kathmandu": "NP", "Asia/Katmandu": "NP",
  "Asia/Dhaka": "BD", "Asia/Thimphu": "BT", "Asia/Colombo": "LK", "Indian/Maldives": "MV", "Asia/Yangon": "MM",
  "Asia/Rangoon": "MM", "Asia/Bangkok": "TH", "Asia/Vientiane": "LA", "Asia/Phnom_Penh": "KH", "Asia/Ho_Chi_Minh": "VN",
  "Asia/Saigon": "VN", "Asia/Kuala_Lumpur": "MY", "Asia/Kuching": "MY", "Asia/Singapore": "SG", "Asia/Jakarta": "ID",
  "Asia/Pontianak": "ID", "Asia/Makassar": "ID", "Asia/Jayapura": "ID", "Asia/Brunei": "BN", "Asia/Manila": "PH",
  "Asia/Dili": "TL", "Asia/Shanghai": "CN", "Asia/Urumqi": "CN", "Asia/Chongqing": "CN", "PRC": "CN", "Asia/Hong_Kong": "HK",
  "Asia/Macau": "MO", "Asia/Taipei": "TW", "Asia/Seoul": "KR", "Asia/Pyongyang": "KP", "Asia/Tokyo": "JP", "Japan": "JP",
  "Asia/Ulaanbaatar": "MN", "Asia/Hovd": "MN", "Asia/Choibalsan": "MN",
  // Rusya (Asya)
  "Asia/Yekaterinburg": "RU", "Asia/Omsk": "RU", "Asia/Novosibirsk": "RU", "Asia/Barnaul": "RU", "Asia/Tomsk": "RU",
  "Asia/Novokuznetsk": "RU", "Asia/Krasnoyarsk": "RU", "Asia/Irkutsk": "RU", "Asia/Chita": "RU", "Asia/Yakutsk": "RU",
  "Asia/Khandyga": "RU", "Asia/Vladivostok": "RU", "Asia/Ust-Nera": "RU", "Asia/Magadan": "RU", "Asia/Sakhalin": "RU",
  "Asia/Srednekolymsk": "RU", "Asia/Kamchatka": "RU", "Asia/Anadyr": "RU",
  // Afrika
  "Africa/Cairo": "EG", "Africa/Tripoli": "LY", "Africa/Tunis": "TN", "Africa/Algiers": "DZ", "Africa/Casablanca": "MA",
  "Africa/El_Aaiun": "EH", "Africa/Khartoum": "SD", "Africa/Juba": "SS", "Africa/Addis_Ababa": "ET", "Africa/Asmara": "ER",
  "Africa/Djibouti": "DJ", "Africa/Mogadishu": "SO", "Africa/Nairobi": "KE", "Africa/Kampala": "UG", "Africa/Kigali": "RW",
  "Africa/Bujumbura": "BI", "Africa/Dar_es_Salaam": "TZ", "Africa/Lagos": "NG", "Africa/Accra": "GH", "Africa/Abidjan": "CI",
  "Africa/Dakar": "SN", "Africa/Bamako": "ML", "Africa/Ouagadougou": "BF", "Africa/Niamey": "NE", "Africa/Ndjamena": "TD",
  "Africa/Douala": "CM", "Africa/Libreville": "GA", "Africa/Malabo": "GQ", "Africa/Kinshasa": "CD", "Africa/Lubumbashi": "CD",
  "Africa/Brazzaville": "CG", "Africa/Luanda": "AO", "Africa/Lusaka": "ZM", "Africa/Harare": "ZW", "Africa/Maputo": "MZ",
  "Africa/Blantyre": "MW", "Africa/Gaborone": "BW", "Africa/Windhoek": "NA", "Africa/Johannesburg": "ZA",
  "Africa/Maseru": "LS", "Africa/Mbabane": "SZ", "Indian/Antananarivo": "MG", "Indian/Mauritius": "MU",
  "Indian/Reunion": "RE", "Indian/Mayotte": "YT", "Indian/Comoro": "KM", "Indian/Mahe": "SC", "Africa/Monrovia": "LR",
  "Africa/Freetown": "SL", "Africa/Conakry": "GN", "Africa/Bissau": "GW", "Africa/Banjul": "GM", "Africa/Nouakchott": "MR",
  "Africa/Lome": "TG", "Africa/Porto-Novo": "BJ", "Africa/Bangui": "CF", "Africa/Sao_Tome": "ST", "Atlantic/Cape_Verde": "CV",
  // Kuzey Amerika
  "America/New_York": "US", "America/Detroit": "US", "America/Chicago": "US", "America/Denver": "US", "America/Phoenix": "US",
  "America/Los_Angeles": "US", "America/Anchorage": "US", "America/Juneau": "US", "America/Boise": "US",
  "America/Indiana/Indianapolis": "US", "America/Indianapolis": "US", "America/Kentucky/Louisville": "US",
  "America/Louisville": "US", "America/Adak": "US", "America/Nome": "US", "America/Sitka": "US", "America/Menominee": "US",
  "America/North_Dakota/Center": "US", "Pacific/Honolulu": "US", "US/Eastern": "US", "US/Central": "US",
  "US/Mountain": "US", "US/Pacific": "US", "US/Hawaii": "US", "US/Alaska": "US", "US/Arizona": "US",
  "America/Toronto": "CA", "America/Montreal": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA",
  "America/Winnipeg": "CA", "America/Regina": "CA", "America/Halifax": "CA", "America/St_Johns": "CA",
  "America/Moncton": "CA", "America/Whitehorse": "CA", "America/Yellowknife": "CA", "America/Iqaluit": "CA",
  "Canada/Eastern": "CA", "Canada/Pacific": "CA", "America/Mexico_City": "MX", "America/Cancun": "MX",
  "America/Merida": "MX", "America/Monterrey": "MX", "America/Chihuahua": "MX", "America/Hermosillo": "MX",
  "America/Mazatlan": "MX", "America/Tijuana": "MX", "America/Matamoros": "MX", "America/Bahia_Banderas": "MX",
  "America/Guatemala": "GT", "America/Belize": "BZ", "America/El_Salvador": "SV", "America/Tegucigalpa": "HN",
  "America/Managua": "NI", "America/Costa_Rica": "CR", "America/Panama": "PA", "America/Havana": "CU",
  "America/Jamaica": "JM", "America/Port-au-Prince": "HT", "America/Santo_Domingo": "DO", "America/Puerto_Rico": "PR",
  "America/Nassau": "BS", "America/Barbados": "BB", "America/Port_of_Spain": "TT", "America/Curacao": "CW",
  "America/Aruba": "AW", "America/Martinique": "MQ", "America/Guadeloupe": "GP", "Atlantic/Bermuda": "BM",
  // Güney Amerika
  "America/Sao_Paulo": "BR", "America/Rio_Branco": "BR", "America/Manaus": "BR", "America/Belem": "BR",
  "America/Fortaleza": "BR", "America/Recife": "BR", "America/Bahia": "BR", "America/Maceio": "BR",
  "America/Araguaina": "BR", "America/Cuiaba": "BR", "America/Campo_Grande": "BR", "America/Porto_Velho": "BR",
  "America/Boa_Vista": "BR", "America/Santarem": "BR", "America/Noronha": "BR", "America/Eirunepe": "BR",
  "Brazil/East": "BR", "America/Argentina/Buenos_Aires": "AR", "America/Buenos_Aires": "AR",
  "America/Argentina/Cordoba": "AR", "America/Cordoba": "AR", "America/Argentina/Mendoza": "AR",
  "America/Argentina/Salta": "AR", "America/Argentina/Jujuy": "AR", "America/Argentina/Tucuman": "AR",
  "America/Argentina/Ushuaia": "AR", "America/Santiago": "CL", "Pacific/Easter": "CL", "America/Punta_Arenas": "CL",
  "America/Montevideo": "UY", "America/Asuncion": "PY", "America/La_Paz": "BO", "America/Lima": "PE",
  "America/Guayaquil": "EC", "Pacific/Galapagos": "EC", "America/Bogota": "CO", "America/Caracas": "VE",
  "America/Guyana": "GY", "America/Paramaribo": "SR", "America/Cayenne": "GF",
  // Okyanusya
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU", "Australia/Perth": "AU",
  "Australia/Adelaide": "AU", "Australia/Hobart": "AU", "Australia/Darwin": "AU", "Australia/Canberra": "AU",
  "Australia/Lord_Howe": "AU", "Australia/Lindeman": "AU", "Australia/Broken_Hill": "AU", "Australia/Eucla": "AU",
  "Pacific/Auckland": "NZ", "Pacific/Chatham": "NZ", "NZ": "NZ", "Pacific/Fiji": "FJ", "Pacific/Port_Moresby": "PG",
  "Pacific/Guam": "GU", "Pacific/Noumea": "NC", "Pacific/Tahiti": "PF", "Pacific/Apia": "WS", "Pacific/Tongatapu": "TO",
  "Pacific/Efate": "VU", "Pacific/Guadalcanal": "SB",
};

/** Saat dilimi → ülke kodu; bilinmiyorsa "XX". */
function countryFromTimeZone(tz) {
  return typeof tz === "string" && Object.hasOwn(TZ_COUNTRY, tz) ? TZ_COUNTRY[tz] : "XX";
}

function isBot(userAgent) {
  return !userAgent || BOT_RE.test(String(userAgent));
}

/** Firestore harita anahtarı olarak güvenli kısa ad. */
function slug(value, max = 32) {
  const s = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/\./g, "_")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
  return s || null;
}

/** Yönlendiren: utm_source önce gelir (pazarlama bağlantıları), yoksa alan adı gruplanır; boş → "direct". */
function normalizeRef(raw) {
  if (typeof raw !== "string" || !raw.trim()) return "direct";
  const value = raw.trim().toLowerCase();
  if (value.startsWith("utm:")) return slug(value.slice(4)) || "direct";
  const host = value.replace(/^www\./, "").slice(0, 120);
  for (const [re, name] of REF_GROUPS) if (re.test(host)) return name;
  return slug(host) || "direct";
}

/** "src~camp" kampanya anahtarı; kampanya yoksa null. */
function normalizeCampaign(src, camp) {
  const c = slug(camp, 40);
  if (!c) return null;
  return `${slug(src, 24) || "direct"}~${c}`;
}

/** Son ziyaretten bu yana geçen gün → kova. İlk ziyaret ya da bilinmeyen → null. */
function returnGapBucket(days) {
  const n = Math.floor(Number(days));
  if (!Number.isFinite(n) || n < 1) return null;
  if (n <= 1) return "d1";
  if (n <= 7) return "w1";
  if (n <= 30) return "m1";
  return "old";
}

function normalizeLang(raw) {
  const m = typeof raw === "string" && /^([a-z]{2,3})(?:[-_]|$)/i.exec(raw.trim());
  return m ? m[1].toLowerCase() : "xx";
}

/** Gövdeyi (metin ya da nesne) doğrular; geçersizse null. */
function parseBeacon(body) {
  let data = body;
  if (Buffer.isBuffer(data)) data = data.toString("utf8");
  if (typeof data === "string") {
    if (data.length > MAX_BODY) return null;
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  if (data.t === "e") {
    const sec = Math.floor(Number(data.sec));
    if (!Number.isFinite(sec) || sec < 1) return null;
    return { type: "engaged", sec: Math.min(sec, MAX_ENGAGED_SEC) };
  }
  if (data.t === "g") return { type: "engagedSession", ref: normalizeRef(data.r) };
  if (data.t === "s") {
    const depth = Number(data.d);
    return SCROLL_DEPTHS.has(depth) ? { type: "scroll", depth } : null;
  }
  if (data.t === "a") {
    if (typeof data.a !== "string" || !ACTIONS.has(data.a)) return null;
    return {
      type: "action",
      action: data.a,
      ref: normalizeRef(data.r),
      country: countryFromTimeZone(data.tz),
      device: DEVICES.has(data.d) ? data.d : "desktop",
      lang: SITE_LANGS.has(data.l) ? data.l : "xx",
    };
  }
  if (data.t !== "v") return null;
  return {
    type: "view",
    page: PAGES.has(data.p) ? data.p : "other",
    ref: normalizeRef(data.r),
    country: countryFromTimeZone(data.tz),
    lang: normalizeLang(data.l),
    device: DEVICES.has(data.d) ? data.d : "desktop",
    os: OSES.has(data.o) ? data.o : "other",
    newSession: data.s === true,
    newToday: data.n === true,
    firstEver: data.f === true,
    browser: BROWSERS.has(data.b) ? data.b : "other",
    screen: SCREENS.has(data.w) ? data.w : null,
    siteLang: SITE_LANGS.has(data.sl) ? data.sl : null,
    campaign: typeof data.c === "string" ? normalizeCampaign(String(data.r || "").replace(/^utm:/, ""), data.c) : null,
    returnGap: data.f === true ? null : returnGapBucket(data.g),
  };
}

const ISTANBUL = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/** İstanbul saatine göre { day: "YYYY-MM-DD", hour: "HH" }. */
function istanbulClock(date) {
  const parts = Object.fromEntries(ISTANBUL.formatToParts(date).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: parts.hour };
}

function shardDocId(day, shard) {
  return `${day}_${shard}`;
}

/**
 * set(..., { merge: true }) ile yazılacak artış nesnesi.
 * @param {(n: number) => any} inc  FieldValue.increment (testte sayı)
 */
function statsPatch(event, { day, hour }, inc) {
  if (event.type === "engaged") return { day, engagedSec: inc(event.sec) };
  if (event.type === "engagedSession") return { day, engagedSessions: inc(1), engagedRefs: { [event.ref]: inc(1) } };
  if (event.type === "scroll") return { day, scroll: { [String(event.depth)]: inc(1) } };
  if (event.type === "action") {
    const patch = { day, actions: { [event.action]: inc(1) } };
    if (SIGNUP_ACTIONS.has(event.action)) {
      patch.signups = inc(1);
      patch.convRefs = { [event.ref]: inc(1) };
      patch.convCountries = { [event.country]: inc(1) };
      patch.convDevices = { [event.device]: inc(1) };
      patch.convLangs = { [event.lang]: inc(1) };
    }
    return patch;
  }
  const patch = {
    day,
    views: inc(1),
    pages: { [event.page]: inc(1) },
    hours: { [hour]: inc(1) },
  };
  if (event.newSession) {
    patch.sessions = inc(1);
    patch.refs = { [event.ref]: inc(1) };
    if (event.campaign) patch.campaigns = { [event.campaign]: inc(1) };
  }
  if (event.newToday) {
    patch.visitors = inc(1);
    patch.countries = { [event.country]: inc(1) };
    patch.langs = { [event.lang]: inc(1) };
    patch.devices = { [event.device]: inc(1) };
    patch.os = { [event.os]: inc(1) };
    patch.browsers = { [event.browser]: inc(1) };
    if (event.screen) patch.screens = { [event.screen]: inc(1) };
    if (event.siteLang) patch.siteLangs = { [event.siteLang]: inc(1) };
    if (event.returnGap) patch.returnGap = { [event.returnGap]: inc(1) };
  }
  if (event.firstEver) patch.newcomers = inc(1);
  return patch;
}

module.exports = {
  SHARDS,
  MAX_BODY,
  MAX_ENGAGED_SEC,
  TZ_COUNTRY,
  ACTIONS,
  SIGNUP_ACTIONS,
  countryFromTimeZone,
  normalizeCampaign,
  returnGapBucket,
  isBot,
  normalizeRef,
  normalizeLang,
  parseBeacon,
  istanbulClock,
  shardDocId,
  statsPatch,
};
