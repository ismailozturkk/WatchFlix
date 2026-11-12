// Grup bilgi sayfası (GroupInfoModal) → Üyeler: "Üyeyi çıkar" ve "Yönetici yap"
// onayları. Eskiden `appAlert` çağrılıyordu: sayfa açıkken köke bağlı İKİNCİ bir
// native Modal → iOS sunamaz, uyarı hiç görünmez, AppAlertHost takılır ve
// uygulama donmuş gibi kalır. Doğrulanan: onay aynı pencerenin `overlay`
// katmanında çizilir, appAlert hiç çağrılmaz, düğmeler doğru yazmayı yapar.
import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => {
  const React = require("react");
  return {
    ActivityIndicator: "ActivityIndicator",
    FlatList: "FlatList",
    // Bölümlerin satırlarını doğrudan çizer.
    SectionList: ({ sections, renderItem, ListFooterComponent }) =>
      React.createElement(
        "SectionList",
        null,
        sections.flatMap((section) =>
          section.data.map((item) =>
            React.createElement(React.Fragment, { key: item.uid }, renderItem({ item, section })),
          ),
        ),
        ListFooterComponent || null,
      ),
    StyleSheet: { create: (styles) => styles, hairlineWidth: 1, absoluteFill: {} },
    Text: "Text",
    TouchableOpacity: "TouchableOpacity",
    View: "View",
  };
});

jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  onSnapshot: jest.fn(() => () => {}),
}));
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("@expo/vector-icons/Ionicons", () => "Ionicons");
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
// Modal yok: kabuk çocuklarını ve katmanı doğrudan çizer.
jest.mock("@components/common/BottomSheetModal", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ visible, onClose, children, overlay }) =>
      visible ? React.createElement("Sheet", { onClose }, children, overlay) : null,
  };
});
jest.mock("@components/modals/createPost/LeaveSheet", () => ({
  __esModule: true,
  default: "LeaveSheet",
}));
jest.mock("@components/common/GlassCloseButton", () => ({ __esModule: true, default: "GlassCloseButton" }));
jest.mock("@components/common/UserAvatar", () => ({ __esModule: true, default: "UserAvatar" }));
jest.mock("@components/chat/GroupAvatar", () => ({ __esModule: true, default: "GroupAvatar" }));
jest.mock("@components/chat/GroupAvatarGrid", () => ({ __esModule: true, default: "GroupAvatarGrid" }));
jest.mock("../components/common/GlassTouchable", () => ({ __esModule: true, default: "GlassTouchable" }));
jest.mock("@components/SwitchToggle", () => ({ __esModule: true, default: "SwitchToggle" }));
jest.mock("@components/common/HoldToConfirmButton", () => ({
  __esModule: true,
  default: "HoldToConfirmButton",
}));
jest.mock("@components/AppAlert", () => ({ appAlert: jest.fn() }));
jest.mock("@components/AppToast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));
jest.mock("@context/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      primary: "#000",
      secondary: "#111",
      border: "#222",
      text: { primary: "#fff", secondary: "#ccc", muted: "#888" },
    },
  }),
}));
jest.mock("@context/UserProfileContext", () => ({
  useUserProfile: () => ({ profile: { displayName: "Ben" } }),
}));
jest.mock("@context/ConnectivityContext", () => ({ getIsOnline: () => true }));
jest.mock("@utils/i18nText", () => ({
  i18nText: (_key, fallback, options) =>
    String(fallback).replace(/\{\{(\w+)\}\}/g, (_m, name) => options?.[name] ?? ""),
}));
jest.mock("@services/groupsService", () => ({
  addGroupMember: jest.fn(),
  deleteGroup: jest.fn(() => Promise.resolve()),
  removeGroupMember: jest.fn(() => Promise.resolve()),
  setGroupAdminRole: jest.fn(() => Promise.resolve()),
  setGroupAdminsOnlyMessages: jest.fn(() => Promise.resolve()),
  updateGroupAvatar: jest.fn(),
}));

const { appAlert } = require("@components/AppAlert");
const groupsService = require("@services/groupsService");
const GroupInfoModal = require("../components/chat/GroupInfoModal").default;

const GROUP = {
  name: "Film Gecesi",
  createdBy: "me",
  admins: [],
  members: ["me", "ali"],
  memberInfo: { ali: { name: "Ali", username: "ali" } },
};

function render(onClose = jest.fn(), { group = GROUP, uid = "me", onDeleted } = {}) {
  let tree;
  act(() => {
    tree = create(
      <GroupInfoModal
        visible
        onClose={onClose}
        groupId="g1"
        groupData={group}
        currentUid={uid}
        onDeleted={onDeleted}
      />,
    );
  });
  return tree;
}

const pressAction = (tree, label) => {
  const btn = tree.root
    .findAllByType("TouchableOpacity")
    .find((n) => n.props.accessibilityLabel === label);
  act(() => btn.props.onPress({ stopPropagation: () => {} }));
};
const removeButton = (tree) =>
  tree.root
    .findAllByType("TouchableOpacity")
    .find((n) => n.props.style?.[1]?.backgroundColor === "#FF6B6B18");
const sheet = (tree) => tree.root.findAllByType("LeaveSheet")[0];

beforeEach(() => jest.clearAllMocks());

test("üyeyi çıkar onayı aynı pencerede açılır ve çıkarır", async () => {
  const tree = render();
  expect(sheet(tree)).toBeUndefined();

  act(() => removeButton(tree).props.onPress({ stopPropagation: () => {} }));

  expect(appAlert).not.toHaveBeenCalled();
  const confirm = sheet(tree);
  expect(confirm.props.message).toBe("Ali gruptan çıkarılsın mı?");

  await act(async () => {
    confirm.props.actions.find((a) => a.key === "remove").onPress();
  });

  expect(groupsService.removeGroupMember).toHaveBeenCalledWith("g1", "ali");
  expect(sheet(tree)).toBeUndefined();
});

test("yönetici yap onayı rolü yazar; iptal hiçbir şey yazmaz", async () => {
  const tree = render();

  pressAction(tree, "Yönetici yap");
  expect(appAlert).not.toHaveBeenCalled();
  act(() => sheet(tree).props.actions.find((a) => a.key === "cancel").onPress());
  expect(sheet(tree)).toBeUndefined();
  expect(groupsService.setGroupAdminRole).not.toHaveBeenCalled();

  pressAction(tree, "Yönetici yap");
  await act(async () => {
    sheet(tree).props.actions.find((a) => a.key === "confirm").onPress();
  });
  expect(groupsService.setGroupAdminRole).toHaveBeenCalledWith("g1", "ali", true);
});

test("onay açıkken geri tuşu önce onayı, sonra sayfayı kapatır", () => {
  const onClose = jest.fn();
  const tree = render(onClose);
  const requestClose = () => tree.root.findByType("Sheet").props.onClose();
  act(() => removeButton(tree).props.onPress({ stopPropagation: () => {} }));

  act(requestClose);
  expect(sheet(tree)).toBeUndefined();
  expect(onClose).not.toHaveBeenCalled();

  act(requestClose);
  expect(onClose).toHaveBeenCalledTimes(1);
});

describe("Yalnız yöneticiler mesaj gönderebilir", () => {
  const policyRow = (tree) =>
    tree.root.findAll((n) => n.props.testID === "group-send-policy" && typeof n.type === "string")[0];

  test("kurucu anahtarla açar", async () => {
    const tree = render();
    const toggle = tree.root.findByType("SwitchToggle");
    expect(toggle.props.value).toBe(false);
    await act(async () => {
      toggle.props.onValueChange(true);
    });
    expect(groupsService.setGroupAdminsOnlyMessages).toHaveBeenCalledWith("g1", true);
  });

  test("sıradan üye anahtarı görmez; ayar açıkken yalnız bilgi satırı", () => {
    const member = render(jest.fn(), { uid: "ali" });
    expect(policyRow(member)).toBeUndefined();

    const locked = render(jest.fn(), { uid: "ali", group: { ...GROUP, adminsOnlyMessages: true } });
    expect(policyRow(locked)).toBeDefined();
    expect(locked.root.findAllByType("SwitchToggle")).toHaveLength(0);
  });
});

describe("Grubu sil (yalnız kurucu, basılı tut)", () => {
  const deleteButton = (tree) => tree.root.findAllByType("HoldToConfirmButton")[0];

  test("kurucu düğmeyi görür; basılı tutma tamamlanınca grup silinir", async () => {
    const onDeleted = jest.fn();
    const tree = render(jest.fn(), { onDeleted });
    const btn = deleteButton(tree);
    expect(btn).toBeDefined();
    expect(btn.props.label).toBe("Grubu sil");
    await act(async () => {
      btn.props.onConfirm();
    });
    expect(groupsService.deleteGroup).toHaveBeenCalledWith("g1", "me");
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(appAlert).not.toHaveBeenCalled();
  });

  test("yönetici de üye de düğmeyi görmez", () => {
    const asAdmin = render(jest.fn(), { uid: "ali", group: { ...GROUP, admins: ["ali"] } });
    expect(deleteButton(asAdmin)).toBeUndefined();
    const asMember = render(jest.fn(), { uid: "ali" });
    expect(deleteButton(asMember)).toBeUndefined();
  });
});
