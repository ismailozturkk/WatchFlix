// Yük testi için üçüncü taraf kısa devresi (T-LOAD-1). FUNCTIONS_TEST=1 iken Gemini, OMDb,
// RevenueCat, TMDB, Google/Apple kimlik uçları ve Expo push sahte yanıt döner; böylece staging
// k6 koşumu hiçbir dış servisin kotasına/limitine dokunmaz ve yalnız bizim katmanımızı ölçer.
//
// Güvenlik: prod projesinde bayrak AÇILAMAZ (yok sayılır + hata günlüğü). Bayrak yoksa modül
// hiçbir şeyi değiştirmez — canlı davranış birebir aynı kalır.
const PROD_PROJECT_ID = "movieandtv-2832a";

function projectIdOf(env) {
  if (env.GCLOUD_PROJECT) return env.GCLOUD_PROJECT;
  try {
    return JSON.parse(env.FIREBASE_CONFIG || "{}").projectId || null;
  } catch {
    return null;
  }
}

/** { enabled, reason } — prod'da ya da proje kimliği bilinmiyorsa her zaman kapalı. */
function stubMode(env = process.env) {
  if (env.FUNCTIONS_TEST !== "1") return { enabled: false, reason: "off" };
  const project = projectIdOf(env);
  if (!project) return { enabled: false, reason: "unknown-project" };
  if (project === PROD_PROJECT_ID) return { enabled: false, reason: "prod-refused" };
  return { enabled: true, reason: "on" };
}

const GEMINI_TEXT = "[stub] Yük testi yanıtı.";

/** URL → { status, body } ya da null (bilinmeyen host: gerçek ağa geçer). */
function stubResponseFor(url) {
  let u;
  try {
    u = new URL(String(url));
  } catch {
    return null;
  }
  switch (u.hostname) {
    case "generativelanguage.googleapis.com":
      return {
        status: 200,
        body: {
          candidates: [{ content: { role: "model", parts: [{ text: GEMINI_TEXT }] }, finishReason: "STOP" }],
          usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 10, totalTokenCount: 60 },
        },
      };
    case "www.omdbapi.com":
      return u.searchParams.has("Season")
        ? { status: 200, body: { Response: "True", Episodes: [{ Episode: "1", imdbRating: "8.0" }] } }
        : {
            status: 200,
            body: {
              Response: "True",
              imdbRating: "7.5",
              imdbVotes: "1,000",
              Metascore: "70",
              Ratings: [{ Source: "Rotten Tomatoes", Value: "80%" }],
            },
          };
    case "api.revenuecat.com":
      return { status: 200, body: { subscriber: { entitlements: {}, subscriptions: {} } } };
    case "api.themoviedb.org":
      return { status: 200, body: { id: 0, results: {} } };
    // Kimlik doğrulama uçları: sahte kimlik ÜRETMEZ, her zaman reddeder.
    case "oauth2.googleapis.com":
    case "appleid.apple.com":
      return { status: 400, body: { error: "stubbed" } };
    default:
      return null;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** globalThis.fetch'i sarar: bilinen upstream'e sahte yanıt (+ yapay gecikme), gerisi gerçek. */
function installFetchStub(target = globalThis, { latencyMs = 0 } = {}) {
  const realFetch = target.fetch;
  target.fetch = async (input, init) => {
    const url = typeof input === "string" || input instanceof URL ? input : input?.url;
    const stub = stubResponseFor(url);
    if (!stub) return realFetch(input, init);
    if (latencyMs > 0) await sleep(latencyMs);
    if (init?.signal?.aborted) {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }
    return new Response(JSON.stringify(stub.body), {
      status: stub.status,
      headers: { "Content-Type": "application/json" },
    });
  };
  return () => {
    target.fetch = realFetch;
  };
}

/** Expo istemcisi node-fetch kullanır (globalThis.fetch'ten geçmez) → gönderimi ayrıca sar. */
function wrapExpo(expo, { latencyMs = 0 } = {}) {
  expo.sendPushNotificationsAsync = async (messages) => {
    if (latencyMs > 0) await sleep(latencyMs);
    return messages.map(() => ({ status: "ok", id: "stub" }));
  };
  expo.getPushNotificationReceiptsAsync = async () => ({});
  return expo;
}

/** index.js girişinde bir kez çağrılır. Kapalıysa hiçbir şeye dokunmaz. */
function setupUpstreamStub({ expo, env = process.env, log = console } = {}) {
  const mode = stubMode(env);
  if (mode.reason === "prod-refused") {
    log.error("[upstreamStub] FUNCTIONS_TEST=1 prod projesinde yok sayıldı.");
  }
  if (!mode.enabled) return mode;
  const latencyMs = Math.max(0, Number(env.FUNCTIONS_TEST_LATENCY_MS) || 0);
  installFetchStub(globalThis, { latencyMs });
  if (expo) wrapExpo(expo, { latencyMs });
  log.warn(`[upstreamStub] AÇIK — dış servisler sahte yanıt dönüyor (gecikme ${latencyMs} ms).`);
  return mode;
}

module.exports = {
  PROD_PROJECT_ID,
  stubMode,
  stubResponseFor,
  installFetchStub,
  wrapExpo,
  setupUpstreamStub,
};
