// Not hatırlatması arayüzü: editörde gün + saat seçimi (not ve yapılacak), profil
// şeridindeki ertele / tamam / notu aç. react-test-renderer + import taklitleri.
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => {
  const React = require("react");
  const host = (name) => React.forwardRef((props, ref) => React.createElement(name, { ...props, ref }, props.children));
  return {
    View: host("View"), Text: host("Text"), TextInput: host("TextInput"), ScrollView: host("ScrollView"),
    TouchableOpacity: host("TouchableOpacity"),
    StyleSheet: { create: (s) => s, hairlineWidth: 1, absoluteFill: {} },
    Keyboard: { dismiss: jest.fn() },
  };
});
jest.mock("@components/premium/PremiumUpsellSheet", () => ({ PremiumUpsellHost: () => null }));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("@expo/vector-icons/Ionicons", () => "Icon");
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
jest.mock("@components/common/BottomSheetModal", () => ({ __esModule: true, default: ({ children, visible }) => (visible ? children : null) }));
jest.mock("@components/modals/DatePickerModal", () => () => null);
jest.mock("@components/AppAlert", () => ({ appAlert: jest.fn() }));
const mockToast = { success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock("@components/AppToast", () => ({ toast: mockToast }));
jest.mock("../components/AppToast", () => ({ toast: mockToast }));
jest.mock("../components/common/GlassTouchable", () => "GlassTouchable");
jest.mock("../components/common/GlassBox", () => "GlassBox");
jest.mock("../components/common/GlassPressable", () => "GlassPressable");
jest.mock("../components/AppIcon", () => "Icon");
jest.mock("../utils/liquidGlass", () => ({ GLASS_PRESS_ROOM: 4 }));
jest.mock("../services/noteTodoDraftService", () => ({
  getNoteTodoDraft: () => null, removeNoteTodoDraft: jest.fn(), saveNoteTodoDraft: jest.fn(), todoDraftKey: (id) => id || "new",
}));
let mockReminders;
jest.mock("../hooks/useNoteReminderInbox", () => ({ __esModule: true, default: () => mockReminders }));
let mockNotesApi;
jest.mock("../context/ProfileNotesContext", () => ({ useProfileNotes: () => mockNotesApi }));
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ language: "tr", t: require("../translations/tr.json") }) }));

const mockTheme = {
  primary: "#111111", secondary: "#222222", border: "#333333", accent: "#8888ff",
  text: { primary: "#ffffff", secondary: "#aaaaaa", muted: "#777777" }, colors: { orange: "#ff7c25", red: "#ff3232" },
};
const NoteEditorSheet = require("../screens/tabs/profile/notes/NoteEditorSheet").default;
const NoteRemindersBar = require("../components/profile/NoteRemindersBar").default;

global.IS_REACT_ACT_ENVIRONMENT = true;
beforeAll(() => require("../translations").default.changeLanguage("tr"));
const colorPairs = [{ color: "#3b82f6", background: "#10203a" }];
let renderer;
let errorSpy;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 27, 13, 20) });
  jest.clearAllMocks();
  const original = console.error;
  errorSpy = jest.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (!String(message).includes("react-test-renderer is deprecated")) original(message, ...args);
  });
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = null;
  errorSpy.mockRestore();
  jest.useRealTimers();
});

const textOf = (node) => {
  const kids = [].concat(node.props.children ?? []);
  return kids.map((k) => (typeof k === "string" || typeof k === "number" ? String(k) : k?.props ? textOf(k) : "")).join("");
};
// Metni taşıyan en yakın dokunulabilir ata.
const pressable = (label) => {
  const text = renderer.root.findAll((n) => n.type === "Text" && textOf(n) === label)[0];
  if (!text) throw new Error(`metin yok: ${label}`);
  let node = text;
  while (node && !node.props.onPress) node = node.parent;
  return node;
};
const press = (label) => act(() => pressable(label).props.onPress());
const hasText = (label) => renderer.root.findAll((n) => n.type === "Text" && textOf(n) === label).length > 0;

const renderEditor = (props) => {
  const onSave = jest.fn().mockResolvedValue(true);
  act(() => {
    renderer = create(
      <NoteEditorSheet visible defaultType="note" theme={mockTheme} colorPairs={colorPairs} language="tr"
        onSave={onSave} onClose={jest.fn()} reminderLocked={false} {...props} />,
    );
  });
  return onSave;
};

describe("editör: hatırlatma saati", () => {
  test("normal notta da hatırlatma kurulur; gün seçilince saat satırı açılır ve ızgaradan saat seçilir", async () => {
    const onSave = renderEditor();
    act(() => renderer.root.findAll((n) => n.type === "TextInput" && n.props.multiline)[0].props.onChangeText("Patlamış mısır al"));
    expect(hasText("09:00")).toBe(false); // gün yokken saat satırı yok
    press("Yarın");
    expect(hasText("09:00")).toBe(true); // başka gün → önerilen 09:00
    // Saat çipi (ilk "09:00") ızgarayı açar.
    const chip = renderer.root.findAll((n) => n.props.accessibilityState?.expanded !== undefined)[0];
    act(() => chip.props.onPress());
    press("14");
    press(":30");
    await act(async () => { await pressable("Kaydet").props.onPress(); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: "note", content: "Patlamış mısır al", scheduledDate: "2026-10-28", scheduledTime: "14:30",
    }));
  });

  test("bugün seçilince bir sonraki tam saat önerilir; geçmiş hızlı saatler kapalı", () => {
    renderEditor({ defaultType: "todo" });
    press("Bugün");
    expect(hasText("14:00")).toBe(true);
    expect(pressable("09:00").props.disabled).toBe(true);
    expect(pressable("12:00").props.disabled).toBe(true);
    expect(pressable("18:00").props.disabled).toBe(false);
  });

  test("geçmiş zamana yeni hatırlatma kaydedilmez; eski geçmiş hatırlatmalı not kaydedilebilir", async () => {
    const past = { id: "n1", type: "note", title: "Eski", content: "x", color: "#3b82f6", scheduledDate: "2026-10-27", scheduledTime: "10:00", createdAt: 1, updatedAt: 1 };
    let onSave = renderEditor({ initialNote: past });
    await act(async () => { await pressable("Kaydet").props.onPress(); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ scheduledDate: "2026-10-27", scheduledTime: "10:00" }));
    act(() => renderer.unmount());

    onSave = renderEditor({ initialNote: { ...past, scheduledDate: null, scheduledTime: null } });
    press("Bugün");
    act(() => renderer.root.findAll((n) => n.props.accessibilityState?.expanded !== undefined)[0].props.onPress());
    // Saat 13 hâlâ seçilebilir (13:59 gelmedi) ama dakika 13:20'den önce kalırsa ilk geçerli 5'liğe kayar.
    press("13");
    expect(hasText("13:20")).toBe(false);
    expect(hasText("13:25")).toBe(true);
    // Seçimle kayıt arasında saat geçti: kayıt engellenir, uyarı çıkar.
    jest.setSystemTime(new Date(2026, 9, 27, 13, 26));
    await act(async () => { await pressable("Kaydet").props.onPress(); });
    expect(onSave).not.toHaveBeenCalled();
    expect(mockToast.warning).toHaveBeenCalledWith("Hatırlatma zamanı geçmişte olamaz");
    press("18:00");
    await act(async () => { await pressable("Kaydet").props.onPress(); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ scheduledDate: "2026-10-27", scheduledTime: "18:00" }));
  });

  test("günü kaldırmak saati de kaldırır", async () => {
    const onSave = renderEditor({ initialNote: { id: "n2", type: "todo", title: "L", todos: [{ id: "t", text: "a", done: false }], color: "#3b82f6", scheduledDate: "2026-10-29", scheduledTime: "08:15", createdAt: 1, updatedAt: 1 } });
    expect(hasText("08:15")).toBe(true);
    press("Bugün");
    press("Bugün"); // seçili hızlı gün ikinci basışta kalkar
    expect(hasText("08:15")).toBe(false);
    await act(async () => { await pressable("Kaydet").props.onPress(); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ scheduledDate: null, scheduledTime: null }));
  });
});

describe("editör: hatırlatıcı Premium'a özel (Free'de kilitli)", () => {
  const existing = {
    id: "n3", type: "todo", title: "Market", todos: [{ id: "t", text: "süt", done: false }], color: "#3b82f6",
    scheduledDate: "2026-10-28", scheduledTime: "08:15", createdAt: 1, updatedAt: 1,
  };

  test("çağıran söylemezse kilitli (kapı açık kalmasın)", () => {
    act(() => {
      renderer = create(
        <NoteEditorSheet visible defaultType="note" theme={mockTheme} colorPairs={colorPairs} language="tr"
          onSave={jest.fn()} onClose={jest.fn()} />,
      );
    });
    expect(hasText("Premium")).toBe(true);
  });

  test("gün seçmek uygulanmaz; yükseltme sayfası denenen gün/saat ve notun ilk satırıyla açılır", async () => {
    const onReminderLocked = jest.fn();
    const onSave = renderEditor({ reminderLocked: true, onReminderLocked });
    expect(hasText("Premium")).toBe(true);
    act(() => renderer.root.findAll((n) => n.type === "TextInput" && n.props.multiline)[0].props.onChangeText("Patlamış mısır al\nikinci satır"));
    press("Yarın");
    expect(onReminderLocked).toHaveBeenCalledWith({
      kind: "reminder", noteType: "note", title: "Patlamış mısır al", scheduledDate: "2026-10-28", scheduledTime: "09:00",
    });
    expect(hasText("09:00")).toBe(false); // saat satırı açılmadı
    press("Hatırlatıcı ekle"); // takvim çipi: gün yok, takvim açılmaz
    expect(onReminderLocked).toHaveBeenCalledTimes(2);
    expect(onReminderLocked.mock.calls[1][0]).toEqual({ kind: "reminder", noteType: "note", title: "Patlamış mısır al" });
    await act(async () => { await pressable("Kaydet").props.onPress(); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ scheduledDate: null, scheduledTime: null }));
  });

  test("kurulu hatırlatıcı görünür ve kaldırılabilir; saatini değiştirmek sayfayı açar", async () => {
    const onReminderLocked = jest.fn();
    const onSave = renderEditor({ reminderLocked: true, onReminderLocked, initialNote: existing });
    expect(hasText("08:15")).toBe(true);
    expect(hasText("Premium")).toBe(false);
    press("18:00");
    expect(onReminderLocked).toHaveBeenCalledWith(expect.objectContaining({
      noteType: "todo", title: "Market", scheduledDate: "2026-10-28", scheduledTime: "18:00",
    }));
    expect(hasText("08:15")).toBe(true); // saat değişmedi
    // Saat çipi ızgarayı açmaz, sayfayı açar.
    act(() => renderer.root.findAll((n) => n.props.accessibilityState?.expanded !== undefined)[0].props.onPress());
    expect(onReminderLocked).toHaveBeenCalledTimes(2);
    expect(hasText(":30")).toBe(false);
    press("Yarın"); // seçili hızlı gün: ikinci basış kaldırır — serbest
    expect(onReminderLocked).toHaveBeenCalledTimes(2);
    expect(hasText("08:15")).toBe(false);
    await act(async () => { await pressable("Kaydet").props.onPress(); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ scheduledDate: null, scheduledTime: null }));
  });
});

describe("editör: kilitliyken hiçbir yoldan yeni gün/saat yazılmaz", () => {
  const existing = {
    id: "n4", type: "note", title: "Sinema", content: "x", color: "#3b82f6",
    scheduledDate: "2026-10-28", scheduledTime: "08:15", createdAt: 1, updatedAt: 1,
  };
  const datePicker = () => renderer.root.findAll((n) => typeof n.props.onConfirm === "function" && n.props.minDateErrorMsg)[0];

  test("takvim seçicisinin onayı başka gün yazmaz, sayfayı açar", async () => {
    const onReminderLocked = jest.fn();
    const onSave = renderEditor({ reminderLocked: true, onReminderLocked, initialNote: existing });
    act(() => datePicker().props.onConfirm("2026-11-05"));
    expect(onReminderLocked).toHaveBeenCalledWith(expect.objectContaining({ scheduledDate: "2026-11-05", title: "Sinema" }));
    expect(hasText("08:15")).toBe(true);
    await act(async () => { await pressable("Kaydet").props.onPress(); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ scheduledDate: "2026-10-28", scheduledTime: "08:15" }));
  });

  test("kaldırıp vazgeçmek serbest: kendi günü geri seçilince gün + saat AYNEN döner", async () => {
    const onReminderLocked = jest.fn();
    const onSave = renderEditor({ reminderLocked: true, onReminderLocked, initialNote: existing });
    press("Yarın"); // seçili → kaldırır
    expect(hasText("08:15")).toBe(false);
    press("Yarın"); // kendi günü → geri gelir (öneri saati 09:00 DEĞİL, kayıttaki 08:15)
    expect(hasText("08:15")).toBe(true);
    act(() => datePicker().props.onConfirm("2026-10-28")); // takvimden de aynı
    expect(onReminderLocked).not.toHaveBeenCalled();
    await act(async () => { await pressable("Kaydet").props.onPress(); });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ scheduledDate: "2026-10-28", scheduledTime: "08:15" }));
  });

  test("hızlı saatlerin hepsi kilitli; seçili saate yeniden basmak işlem yapmaz", () => {
    const onReminderLocked = jest.fn();
    renderEditor({ reminderLocked: true, onReminderLocked, initialNote: { ...existing, scheduledTime: "21:00" } });
    for (const time of ["09:00", "12:00", "18:00"]) {
      const chip = renderer.root.findAll((n) => n.type === "GlassTouchable" && n.props.accessibilityState?.selected === false && textOf(n) === time)[0];
      act(() => chip.props.onPress());
    }
    expect(onReminderLocked).toHaveBeenCalledTimes(3);
    const same = renderer.root.findAll((n) => n.type === "GlassTouchable" && n.props.accessibilityState?.selected === true && textOf(n) === "21:00")[0];
    act(() => same.props.onPress());
    expect(onReminderLocked).toHaveBeenCalledTimes(3);
    expect(renderer.root.findAll((n) => n.type === "Text" && textOf(n) === "21:00").length).toBeGreaterThan(0);
  });
});

describe("profil şeridi", () => {
  const item = {
    id: "note-reminder:a@1", type: "note_reminder", local: true, noteId: "a", noteType: "note",
    title: "Film gecesi", text: "Patlamış mısır al", color: null, createdAt: new Date(2026, 9, 27, 13, 0).getTime(), read: false,
  };
  const navigation = { navigate: jest.fn() };
  const renderBar = () => act(() => { renderer = create(<NoteRemindersBar navigation={navigation} />); });

  beforeEach(() => {
    mockReminders = { unread: [item], markSeen: jest.fn() };
    mockNotesApi = {
      notes: [{ id: "a", type: "note", content: "Patlamış mısır al", scheduledDate: "2026-10-27", scheduledTime: "13:00" }],
      saveNote: jest.fn().mockResolvedValue(true),
      canSetNoteReminder: true,
      showNoteReminderUpsell: jest.fn(),
    };
  });

  test("okunmamış hatırlatma yoksa çizilmez", () => {
    mockReminders = { unread: [], markSeen: jest.fn() };
    renderBar();
    expect(renderer.toJSON()).toBeNull();
  });

  test("başlık, önizleme; Tamam okundu sayar, Notu aç düzenleyiciye gider", () => {
    renderBar();
    expect(hasText("Not hatırlatması")).toBe(true);
    expect(hasText("Film gecesi")).toBe(true);
    expect(hasText("Patlamış mısır al")).toBe(true);
    act(() => renderer.root.findByProps({ testID: "note-reminder-done" }).props.onPress());
    expect(mockReminders.markSeen).toHaveBeenCalledWith(item);
    act(() => renderer.root.findByProps({ testID: "note-reminder-open" }).props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith("NotesScreen", { openNoteId: "a" });
  });

  test("1 saat ertele notun gün + saatini ileri alır", async () => {
    renderBar();
    await act(async () => { await renderer.root.findByProps({ testID: "note-reminder-snooze" }).props.onPress(); });
    expect(mockNotesApi.saveNote).toHaveBeenCalledWith(expect.objectContaining({ id: "a", scheduledDate: "2026-10-27", scheduledTime: "14:20" }));
    expect(mockToast.success).toHaveBeenCalled();
  });

  test("Free'de ertelemek kaydetmez; yükseltme sayfası ertelenmiş saatle açılır (düğmede ◆)", async () => {
    mockNotesApi = { ...mockNotesApi, canSetNoteReminder: false };
    renderBar();
    expect(renderer.root.findAll((n) => n.props.testID === "note-reminder-snooze-premium").length).toBeGreaterThan(0);
    await act(async () => { await renderer.root.findByProps({ testID: "note-reminder-snooze" }).props.onPress(); });
    expect(mockNotesApi.saveNote).not.toHaveBeenCalled();
    expect(mockNotesApi.showNoteReminderUpsell).toHaveBeenCalledWith({
      kind: "reminder", noteType: "note", title: "Patlamış mısır al", scheduledDate: "2026-10-27", scheduledTime: "14:20",
    });
  });

  test("Premium'da ◆ işareti yok", () => {
    renderBar();
    expect(renderer.root.findAll((n) => n.props.testID === "note-reminder-snooze-premium")).toHaveLength(0);
  });
});
