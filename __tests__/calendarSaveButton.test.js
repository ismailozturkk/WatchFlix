// Takvim ekranı satırındaki telefon takvimi düğmesi (CalendarAgendaDay > SaveButton).
//
// Üç hâl: eklenebilir (+), eklenmiş (yeşil tik), geçmişte eklenmiş (çöp). Eklenmiş
// iki hâl de dokununca KALDIRIR; ekleme/kaldırma toast'ındaki "Geri Al" phoneCalendar
// testinde sınanır. Burada: hangi düğmenin göründüğü, ne çağırdığı ve art arda
// dokunuşun (ekle → hemen kaldır) engellendiği.
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => ({
  StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
}));
// Derleme eklentisi (scripts/babel-transform-app-text.js) `Text`'i AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Ionicons" }));
jest.mock("@context/CalendarContext", () => ({
  EVENT_COLORS: { note: "#a", movie: "#b", tv: "#c" },
}));
jest.mock("@utils/i18nText", () => ({
  i18nText: (_key, fallback) => fallback,
}));
const mockShowUpsell = jest.fn();
jest.mock("@hooks/usePremiumGate", () => ({ usePremiumGate: () => ({ showUpsell: mockShowUpsell }) }));
jest.mock("@utils/phoneCalendar", () => ({
  buildEventKey: (item) => `movie_${item.id}_${item.date}`,
  removeEventFromPhoneCalendar: jest.fn(),
  saveEventToPhoneCalendar: jest.fn(),
}));

const phoneCalendar = require("@utils/phoneCalendar");
const { AgendaDay } = require("../components/calendar/CalendarAgendaDay");

const THEME = {
  primary: "#p",
  secondary: "#s",
  border: "#b",
  accent: "#a",
  text: { primary: "#t1", secondary: "#t2", muted: "#t3" },
};
const movie = { id: 7, title: "Dune", date: "2026-11-20", eventType: "reminder_movie" };
const KEY = "movie_7_2026-11-20";
const ADD = "Telefon takvimine ekle";
const REMOVE = "Telefon takviminden kaldır";

const find = (tree, label) =>
  tree.root.findAllByType("TouchableOpacity").find((n) => n.props.accessibilityLabel === label);

async function mount({ saved = false, viewMode = "future", onSavedChange = jest.fn() } = {}) {
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(AgendaDay, {
        group: { dateStr: movie.date, notes: [], movies: [movie], tvs: [], count: 1 },
        todayStr: "2026-10-16",
        language: "tr",
        theme: THEME,
        savedSet: new Set(saved ? [KEY] : []),
        onSavedChange,
        viewMode,
        onFocus: () => {},
        onItemPress: () => {},
      }),
    );
  });
  return { tree, onSavedChange };
}

beforeEach(() => {
  jest.clearAllMocks();
  phoneCalendar.saveEventToPhoneCalendar.mockResolvedValue({ ok: true });
  phoneCalendar.removeEventFromPhoneCalendar.mockResolvedValue({ ok: true });
});

describe("takvim satırı düğmesi", () => {
  it("eklenmemişken + gösterir; dokununca ekler ve geri alma için onSavedChange'i iletir", async () => {
    const { tree, onSavedChange } = await mount();

    expect(find(tree, REMOVE)).toBeUndefined();
    await act(async () => {
      await find(tree, ADD).props.onPress();
    });

    expect(phoneCalendar.saveEventToPhoneCalendar).toHaveBeenCalledWith(movie, { onSavedChange });
    expect(onSavedChange).toHaveBeenCalledWith(KEY, true);
  });

  it("eklenmişken yeşil tik KALDIRIR (eskiden ölü bir işaretti)", async () => {
    const { tree, onSavedChange } = await mount({ saved: true });

    expect(find(tree, ADD)).toBeUndefined();
    const btn = find(tree, REMOVE);
    expect(btn.props.disabled).toBe(false);
    expect(btn.findByType("Ionicons").props.name).toBe("checkmark");

    await act(async () => {
      await btn.props.onPress();
    });

    expect(phoneCalendar.removeEventFromPhoneCalendar).toHaveBeenCalledWith(movie, {
      onSavedChange,
    });
    expect(phoneCalendar.saveEventToPhoneCalendar).not.toHaveBeenCalled();
    expect(onSavedChange).toHaveBeenCalledWith(KEY, false);
  });

  it("geçmiş modda eklenmişse çöp simgesiyle kaldırır, eklenmemişse düğme yok", async () => {
    const saved = await mount({ saved: true, viewMode: "past" });
    const btn = find(saved.tree, REMOVE);
    expect(btn.findByType("Ionicons").props.name).toBe("trash-outline");
    await act(async () => {
      await btn.props.onPress();
    });
    expect(saved.onSavedChange).toHaveBeenCalledWith(KEY, false);

    const unsaved = await mount({ saved: false, viewMode: "past" });
    expect(find(unsaved.tree, ADD)).toBeUndefined();
    expect(find(unsaved.tree, REMOVE)).toBeUndefined();
  });

  it("kilitli (Free'de not) eklemede yükseltme sayfası açılır, küme değişmez", async () => {
    phoneCalendar.saveEventToPhoneCalendar.mockResolvedValue({ ok: false, locked: true });
    const { tree, onSavedChange } = await mount();

    await act(async () => {
      await find(tree, ADD).props.onPress();
    });

    expect(onSavedChange).not.toHaveBeenCalled();
    expect(mockShowUpsell).toHaveBeenCalledWith({
      preview: expect.objectContaining({ kind: "reminder", title: "Dune" }),
    });
  });

  it("başarısız işlemde kümeyi değiştirmez", async () => {
    phoneCalendar.saveEventToPhoneCalendar.mockResolvedValue({ ok: false });
    const { tree, onSavedChange } = await mount();

    await act(async () => {
      await find(tree, ADD).props.onPress();
    });

    expect(onSavedChange).not.toHaveBeenCalled();
  });

  it("işlem sürerken ikinci dokunuş yok sayılır (ekle → hemen kaldır olmaz)", async () => {
    let release;
    phoneCalendar.saveEventToPhoneCalendar.mockReturnValue(
      new Promise((resolve) => {
        release = () => resolve({ ok: true });
      }),
    );
    const { tree } = await mount();

    let first;
    await act(async () => {
      first = find(tree, ADD).props.onPress();
    });
    // İşlem sürüyor: düğme devre dışı ve ikinci çağrı hiçbir şey başlatmıyor.
    expect(find(tree, ADD).props.disabled).toBe(true);
    await act(async () => {
      await find(tree, ADD).props.onPress();
    });
    expect(phoneCalendar.saveEventToPhoneCalendar).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
      await first;
    });
    expect(find(tree, ADD).props.disabled).toBe(false);
  });
});
