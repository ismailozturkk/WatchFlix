// Ayarlar > İzinlerim > Takvim bilgi/yönetim sayfası (CalendarPermissionSheet) ve
// PermissionsSection'daki takvim satırının bağlantısı.
//
// Gerçek telefon takvimi/izin diyaloğu yok: phoneCalendar ve expo-calendar sahte.
// Doğrulanan: hangi düğmenin göründüğü, ne çağırdığı, iç içe Modal/appAlert
// KULLANILMADIĞI (iOS'ta açık Modal üstünde sunulamaz).
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  AppState: { addEventListener: () => ({ remove: () => {} }) },
  Linking: { openSettings: jest.fn(() => Promise.resolve()) },
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles) => styles },
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
}));

// Derleme eklentisi (scripts/babel-transform-app-text.js) `Text`'i AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("@components/AppIcon", () => ({ __esModule: true, default: "AppIcon" }));
jest.mock("@components/common/GlassIconButton", () => ({
  __esModule: true,
  default: "GlassIconButton",
}));
jest.mock("@components/AppAlert", () => ({ appAlert: jest.fn() }));
jest.mock("@services/pushNotificationsService", () => ({
  ensureAndroidChannels: jest.fn(),
}));
// Modal yok: kabuk çocuğunu doğrudan çizer.
jest.mock("@components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) => (visible ? children : null),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@context/LanguageContext", () => ({
  useLanguage: () => ({ t: require("../translations/tr.json") }),
}));
jest.mock("@utils/i18nText", () => ({
  i18nText: (_key, fallback, options) =>
    options?.count != null ? fallback.replace("{{count}}", options.count) : fallback,
}));
jest.mock("@utils/phoneCalendar", () => ({
  countSavedPhoneEvents: jest.fn(),
  removeAllEventsFromPhoneCalendar: jest.fn(),
}));
jest.mock("expo-notifications", () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: "granted", canAskAgain: true })),
  requestPermissionsAsync: jest.fn(),
}));
jest.mock("expo-media-library", () => ({
  getPermissionsAsync: jest.fn(async () => ({ status: "denied", canAskAgain: true })),
  requestPermissionsAsync: jest.fn(),
}));
jest.mock("expo-calendar", () => ({
  getCalendarPermissions: jest.fn(),
  requestCalendarPermissions: jest.fn(),
}));

const { Linking } = require("react-native");
const Calendar = require("expo-calendar");
const { appAlert } = require("@components/AppAlert");
const phoneCalendar = require("@utils/phoneCalendar");
const CalendarPermissionSheet = require("../components/permissions/CalendarPermissionSheet").default;
const PermissionsSection = require("../components/PermissionsSection").default;

const COLORS = new Proxy({}, { get: (_t, key) => `#${String(key)}` });

const flat = (children) => [].concat(children).join("");
const texts = (tree) => tree.root.findAllByType("Text").map((n) => flat(n.props.children));
const button = (tree, label) =>
  tree.root
    .findAllByType("TouchableOpacity")
    .find((n) => n.props.accessibilityLabel === label);

async function mountSheet(props) {
  let tree;
  await act(async () => {
    tree = create(
      React.createElement(CalendarPermissionSheet, {
        visible: true,
        onClose: () => {},
        colors: COLORS,
        state: { status: "granted", canAskAgain: true },
        onRequest: jest.fn(async () => {}),
        ...props,
      }),
    );
  });
  return tree;
}

beforeEach(() => {
  jest.clearAllMocks();
  phoneCalendar.countSavedPhoneEvents.mockResolvedValue(0);
});

describe("CalendarPermissionSheet", () => {
  it("izin yokken neyin eklendiğini anlatır ve izin ister (appAlert yok)", async () => {
    const onRequest = jest.fn(async () => {});
    const tree = await mountSheet({
      state: { status: "undetermined", canAskAgain: true },
      onRequest,
    });
    const all = texts(tree).join("\n");

    expect(all).toContain("Yalnızca sen istediğinde");
    expect(all).toContain("Takvimin okunmaz");
    expect(all).toContain("Geri almak da sende");
    // İzin yokken kaldır/geri çek düğmesi anlamsız.
    expect(button(tree, "İzni geri çek")).toBeUndefined();

    await act(async () => {
      await button(tree, "Takvim erişimine izin ver").props.onPress();
    });
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(appAlert).not.toHaveBeenCalled();
  });

  it("kalıcı reddedilmişse istek yerine sistem ayarlarını açar", async () => {
    const onRequest = jest.fn();
    const tree = await mountSheet({
      state: { status: "denied", canAskAgain: false },
      onRequest,
    });

    expect(texts(tree).join("\n")).toContain("yalnızca sistem ayarlarından açılabilir");
    await act(async () => {
      await button(tree, "Sistem ayarlarını aç").props.onPress();
    });
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(onRequest).not.toHaveBeenCalled();
  });

  it("izin kapalıyken telefonda duran etkinlikler için uyarır", async () => {
    phoneCalendar.countSavedPhoneEvents.mockResolvedValue(5);
    const tree = await mountSheet({ state: { status: "denied", canAskAgain: true } });

    expect(texts(tree).join("\n")).toContain("(toplam 5)");
    expect(button(tree, "Eklenen etkinlikleri kaldır")).toBeUndefined();
  });

  it("izin açıkken sayıyı gösterir; kaldırma önce satır içi onay ister", async () => {
    phoneCalendar.countSavedPhoneEvents.mockResolvedValue(3);
    phoneCalendar.removeAllEventsFromPhoneCalendar.mockResolvedValue({
      removed: 2,
      missing: 1,
      total: 3,
    });
    const tree = await mountSheet();

    expect(texts(tree)).toContain("3");
    expect(button(tree, "İzni geri çek")).toBeDefined();
    expect(texts(tree).join("\n")).toContain("izin kapalıyken Seelogd onları silemez");

    // İlk dokunuş silmez, yalnız onay kutusunu açar.
    await act(async () => {
      button(tree, "Eklenen etkinlikleri kaldır").props.onPress();
    });
    expect(phoneCalendar.removeAllEventsFromPhoneCalendar).not.toHaveBeenCalled();
    expect(button(tree, "Eklenen etkinlikleri kaldır")).toBeUndefined();
    expect(texts(tree).join("\n")).toContain("telefonunun takviminden silinecek");

    // Vazgeç onayı kapatır, hiçbir şey silinmez.
    await act(async () => {
      button(tree, "Vazgeç").props.onPress();
    });
    expect(phoneCalendar.removeAllEventsFromPhoneCalendar).not.toHaveBeenCalled();
    expect(button(tree, "Eklenen etkinlikleri kaldır")).toBeDefined();

    // Onaylanınca silinir ve sonuç sayfada gösterilir.
    phoneCalendar.countSavedPhoneEvents.mockResolvedValue(0);
    await act(async () => {
      button(tree, "Eklenen etkinlikleri kaldır").props.onPress();
    });
    await act(async () => {
      await button(tree, "Evet, kaldır").props.onPress();
    });
    expect(phoneCalendar.removeAllEventsFromPhoneCalendar).toHaveBeenCalledTimes(1);
    const all = texts(tree).join("\n");
    expect(all).toContain("Kaldırılan etkinlik: 2");
    expect(all).toContain("Telefonda zaten bulunmayan: 1");
    expect(all).toContain("Seelogd henüz takvimine etkinlik eklemedi.");
    expect(appAlert).not.toHaveBeenCalled();
  });

  it("silme izin yüzünden engellenirse bunu açıkça söyler", async () => {
    phoneCalendar.countSavedPhoneEvents.mockResolvedValue(2);
    phoneCalendar.removeAllEventsFromPhoneCalendar.mockResolvedValue({
      blocked: "no-permission",
      removed: 0,
      missing: 0,
      total: 2,
    });
    const tree = await mountSheet();

    await act(async () => {
      button(tree, "Eklenen etkinlikleri kaldır").props.onPress();
    });
    await act(async () => {
      await button(tree, "Evet, kaldır").props.onPress();
    });
    expect(texts(tree).join("\n")).toContain("takvim izni kapalı");
  });

  it("silme patlarsa hata gösterir, sayfa çökmez", async () => {
    phoneCalendar.countSavedPhoneEvents.mockResolvedValue(2);
    phoneCalendar.removeAllEventsFromPhoneCalendar.mockRejectedValue(new Error("boom"));
    const tree = await mountSheet();

    await act(async () => {
      button(tree, "Eklenen etkinlikleri kaldır").props.onPress();
    });
    await act(async () => {
      await button(tree, "Evet, kaldır").props.onPress();
    });
    expect(texts(tree).join("\n")).toContain("Etkinlikler kaldırılamadı");
  });

  it("izni geri çek: sistem ayarlarını açar ve bunun neden böyle olduğunu söyler", async () => {
    const tree = await mountSheet();

    expect(texts(tree).join("\n")).toContain("yalnızca sistem ayarlarından kapatılabilir");
    await act(async () => {
      await button(tree, "İzni geri çek").props.onPress();
    });
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(appAlert).not.toHaveBeenCalled();
  });

  it("kapalıyken hiçbir şey çizmez ve telefon takvimini okumaz", async () => {
    const tree = await mountSheet({ visible: false });

    expect(tree.toJSON()).toBeNull();
    expect(phoneCalendar.countSavedPhoneEvents).not.toHaveBeenCalled();
  });
});

describe("PermissionsSection takvim satırı", () => {
  async function mountSection(calendarPermission) {
    Calendar.getCalendarPermissions.mockResolvedValue(calendarPermission);
    let tree;
    await act(async () => {
      tree = create(React.createElement(PermissionsSection, { colors: COLORS }));
    });
    return tree;
  }

  const sheetProps = (tree) => tree.root.findByType(CalendarPermissionSheet).props;
  const calendarRow = (tree) =>
    tree.root
      .findAllByType("TouchableOpacity")
      .find((n) => String(n.props.accessibilityLabel).startsWith("Takvim:"));

  it("üçüncü izin olarak listelenir ve özet sayacına girer", async () => {
    const tree = await mountSection({ status: "granted", canAskAgain: true });
    const all = texts(tree);

    expect(all).toContain("Takvim");
    expect(all).toContain("Hatırlatıcıları telefonunun takvimine eklemek için");
    // bildirim: granted, galeri: denied, takvim: granted
    expect(all.some((line) => line.startsWith("2/3"))).toBe(true);
  });

  it("satıra basmak genel geri-çek uyarısı yerine takvim sayfasını açar", async () => {
    const tree = await mountSection({ status: "granted", canAskAgain: true });
    expect(sheetProps(tree).visible).toBe(false);

    await act(async () => {
      calendarRow(tree).props.onPress();
    });

    expect(sheetProps(tree).visible).toBe(true);
    expect(sheetProps(tree).state).toEqual({ status: "granted", canAskAgain: true });
    expect(appAlert).not.toHaveBeenCalled();
  });

  it("izin yokken de sayfa açılır (izin orada istenir, sistem diyaloğu kendiliğinden çıkmaz)", async () => {
    const tree = await mountSection({ status: "undetermined", canAskAgain: true });

    await act(async () => {
      calendarRow(tree).props.onPress();
    });

    expect(sheetProps(tree).visible).toBe(true);
    expect(Calendar.requestCalendarPermissions).not.toHaveBeenCalled();
  });

  it("sayfadaki izin isteği izni ister ve durumu tazeler", async () => {
    const tree = await mountSection({ status: "undetermined", canAskAgain: true });
    Calendar.requestCalendarPermissions.mockResolvedValue({ status: "granted" });
    Calendar.getCalendarPermissions.mockResolvedValue({ status: "granted", canAskAgain: true });

    await act(async () => {
      await sheetProps(tree).onRequest();
    });

    expect(Calendar.requestCalendarPermissions).toHaveBeenCalledTimes(1);
    expect(sheetProps(tree).state.status).toBe("granted");
    expect(appAlert).not.toHaveBeenCalled();
  });

  it("izin API'si patlarsa satır belirsiz görünür, bölüm çökmez", async () => {
    Calendar.getCalendarPermissions.mockRejectedValue(new Error("no module"));
    let tree;
    await act(async () => {
      tree = create(React.createElement(PermissionsSection, { colors: COLORS }));
    });

    expect(sheetProps(tree).state.status).toBe("undetermined");
  });
});
