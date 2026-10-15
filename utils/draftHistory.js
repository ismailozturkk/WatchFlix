// utils/draftHistory.js
//
// Geri al / yinele geçmişi (saf redüktör). Tema oluşturucuda her rastgele
// deneme, palet üretimi ve renk onayı bir "adım"dır; kullanıcı beğendiği
// bir öncekine geri dönebilsin diye sınırlı sayıda tutulur.

export const HISTORY_LIMIT = 40;

export const createHistory = (initial) => ({ past: [], present: initial, future: [] });

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function historyReducer(state, action) {
  switch (action.type) {
    case "commit": {
      if (same(state.present, action.value)) return state;
      return {
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        present: action.value,
        future: [],
      };
    }
    case "undo": {
      if (!state.past.length) return state;
      const past = state.past.slice(0, -1);
      return { past, present: state.past[state.past.length - 1], future: [state.present, ...state.future] };
    }
    case "redo": {
      if (!state.future.length) return state;
      const [next, ...future] = state.future;
      return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: next, future };
    }
    case "clear":
      return createHistory(action.value);
    default:
      return state;
  }
}

export const canUndo = (state) => state.past.length > 0;
export const canRedo = (state) => state.future.length > 0;
