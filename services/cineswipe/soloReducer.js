// services/cineswipe/soloReducer.js
//
// CineSwipe SOLO modunun durum makinesi (saf reducer). Ekranda dağınık duran
// deste / sayfa / geçmiş / sepet durumunu tek yerde toplar; asenkron sonuçlar
// `requestId` taşır ve eskimişse (filtre değişti, 2. tur başladı) sessizce atılır.
//
// Çözdüğü hatalar:
//   • Eski filtrenin geç gelen sayfası yeni desteye ekleniyordu.
//   • Sonraki sayfa tekrar eden kartlar getiriyordu; deste sonunda yükleme
//     sürerken "deste tamamlandı" ekranı çıkıyordu.
//   • 2. turun küçük destesi "azaldı" sanılıp orijinal kategoriden sayfa ekleniyordu.
//   • Sepet yalnız `id` ile tekrar kontrol ediyordu: aynı numaralı film ve dizi çakışıyordu.
//   • Ağ hatası ile "sonuç yok" aynı ekranda (boş deste) görünüyordu.

import { cineMediaKey, mergeUniqueCards } from "./deckModel";

/** Destede bu kadar kart kalınca sonraki sayfa istenir. */
export const SOLO_PREFETCH_THRESHOLD = 4;

export function createSoloState() {
  return {
    requestId: 0,
    status: "loading", // "loading" | "ready" | "error"
    deck: [],
    index: 0,
    history: [], // [{ media, direction, addedToBasket, wasSeen }]
    basket: [], // beğenilenler
    seen: {}, // { [cineMediaKey]: true } — bu oturumda kaydırılanlar yeni destelerde elenir
    page: 1,
    hasMore: true,
    fetchingMore: false,
    moreFailed: false,
    round: 1, // 1 = normal deste, 2+ = sepetten elemeli final turları
  };
}

const isStale = (state, action) => action.requestId !== state.requestId;

export function soloReducer(state, action) {
  switch (action.type) {
    case "LOAD_START":
      return {
        ...state,
        requestId: action.requestId,
        status: "loading",
        deck: [],
        index: 0,
        history: [],
        page: 1,
        hasMore: true,
        fetchingMore: false,
        moreFailed: false,
        round: 1,
        seen: action.clearSeen ? {} : state.seen,
      };

    case "LOAD_OK":
      if (isStale(state, action)) return state;
      return {
        ...state,
        status: "ready",
        deck: mergeUniqueCards([], action.items, state.seen),
        index: 0,
        page: action.page ?? 1,
        hasMore: !!action.hasMore,
        fetchingMore: false,
        moreFailed: false,
      };

    case "LOAD_FAIL":
      if (isStale(state, action)) return state;
      return { ...state, status: "error", fetchingMore: false };

    case "MORE_START":
      if (isStale(state, action) || state.fetchingMore) return state;
      return { ...state, fetchingMore: true, moreFailed: false };

    case "MORE_OK": {
      if (isStale(state, action)) return state;
      const fresh = mergeUniqueCards(state.deck, action.items, state.seen);
      return {
        ...state,
        deck: fresh.length ? [...state.deck, ...fresh] : state.deck,
        page: action.page,
        hasMore: !!action.hasMore,
        fetchingMore: false,
        moreFailed: false,
      };
    }

    case "MORE_FAIL":
      if (isStale(state, action)) return state;
      return { ...state, fetchingMore: false, moreFailed: true };

    case "RETRY_MORE":
      return { ...state, moreFailed: false };

    case "SWIPE": {
      const media = state.deck[state.index];
      if (!media || state.status !== "ready") return state;
      const key = cineMediaKey(media);
      const direction = action.direction === "like" ? "like" : "pass";
      const addToBasket = direction === "like" && !state.basket.some((m) => cineMediaKey(m) === key);
      return {
        ...state,
        index: state.index + 1,
        history: [
          ...state.history,
          { media, direction, addedToBasket: addToBasket, wasSeen: !!state.seen[key] },
        ],
        basket: addToBasket ? [...state.basket, media] : state.basket,
        seen: { ...state.seen, [key]: true },
      };
    }

    case "UNDO": {
      const last = state.history[state.history.length - 1];
      if (!last || state.index === 0) return state;
      const key = cineMediaKey(last.media);
      let seen = state.seen;
      if (!last.wasSeen) {
        seen = { ...state.seen };
        delete seen[key];
      }
      return {
        ...state,
        index: state.index - 1,
        history: state.history.slice(0, -1),
        basket: last.addedToBasket ? state.basket.filter((m) => cineMediaKey(m) !== key) : state.basket,
        seen,
      };
    }

    // Sepetten elemeli final turu: deste = verilen kartlar, sayfalama KAPALI.
    case "START_FINAL":
      return {
        ...state,
        requestId: action.requestId,
        status: "ready",
        deck: action.items,
        index: 0,
        history: [],
        basket: [],
        page: 1,
        hasMore: false,
        fetchingMore: false,
        moreFailed: false,
        round: state.round + 1,
      };

    case "REMOVE_FROM_BASKET":
      return { ...state, basket: state.basket.filter((m) => cineMediaKey(m) !== action.key) };

    case "CLEAR_BASKET":
      return { ...state, basket: [] };

    default:
      return state;
  }
}

/**
 * Ekranın ihtiyaç duyduğu türetilmiş durum. Reducer'a konmaz: ham durumdan
 * hesaplanır, böylece iki kaynak birbirinden sapamaz.
 */
export function soloView(state) {
  const remaining = state.deck.length - state.index;
  const ready = state.status === "ready";
  const exhausted = ready && remaining <= 0;
  const firstRound = state.round === 1;
  const waitingMore = exhausted && firstRound && (state.fetchingMore || (state.hasMore && !state.moreFailed));
  const moreError = exhausted && firstRound && state.hasMore && state.moreFailed;
  const finished = exhausted && !waitingMore && !moreError;
  return {
    remaining,
    current: ready ? state.deck[state.index] || null : null,
    upcoming: state.deck.slice(state.index + 1, state.index + 7),
    exhausted,
    waitingMore,
    moreError,
    finished,
    // Boş destede bile (hepsi elendi / sonuç yok) bir sonraki sayfayı iste.
    needsMore:
      ready && firstRound && state.hasMore && !state.fetchingMore && !state.moreFailed &&
      remaining <= SOLO_PREFETCH_THRESHOLD,
    noResults: finished && state.deck.length === 0 && firstRound,
    finalOver: finished && !firstRound,
    winner: finished && !firstRound && state.basket.length === 1 ? state.basket[0] : null,
    canUndo: state.history.length > 0 && state.index > 0,
  };
}
