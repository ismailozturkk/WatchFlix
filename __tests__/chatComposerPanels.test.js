import fs from "fs";
import path from "path";
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => {
  const React = require("react");
  const passthrough = (name) => ({ children, ...props }) =>
    React.createElement(name, props, children);
  return {
    View: "View",
    Text: "Text",
    TextInput: "TextInput",
    TouchableOpacity: passthrough("TouchableOpacity"),
    StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
    Platform: { OS: "ios" },
  };
});

jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text", AppTextInput: "TextInput" }));
jest.mock("../utils/i18nText", () => ({
  i18nText: (_key, fallback, params) =>
    Object.entries(params || {}).reduce(
      (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
      fallback,
    ),
}));

const theme = {
  secondary: "#181822",
  between: "#242432",
  border: "#3a3a4a",
  accent: "#6c63ff",
  text: { primary: "#fff", muted: "#999" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme }) }));

jest.mock("../components/common/BottomSheetModal", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: ({ children, ...props }) => React.createElement("BottomSheet", props, children),
  };
});
jest.mock("../components/common/SheetScroll", () => {
  const React = require("react");
  return { __esModule: true, default: ({ children, ...props }) => React.createElement("SheetScroll", props, children) };
});
jest.mock("../components/common/GlassCloseButton", () => ({ __esModule: true, default: "CloseButton" }));
jest.mock("../components/common/GlassTouchable", () => {
  const React = require("react");
  return { __esModule: true, default: ({ children, ...props }) => React.createElement("ActionButton", props, children) };
});
jest.mock("../components/common/GlassBox", () => {
  const React = require("react");
  return { __esModule: true, default: ({ children, ...props }) => React.createElement("Field", props, children) };
});
jest.mock("../components/common/GlassTextInput", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: React.forwardRef((props, _ref) => React.createElement("TextInput", { ...props, pollQuestion: true })),
  };
});

const TextPollComposer = require("../components/chat/TextPollComposer").default;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const renderComposer = (props = {}) => {
  let renderer;
  act(() => {
    renderer = create(
      <TextPollComposer
        visible
        onClose={jest.fn()}
        onCreate={jest.fn()}
        {...props}
      />,
    );
  });
  return renderer;
};

test("metin anketi ortak klavye uyumlu sheet'i ve kaydırılabilir formu kullanır", () => {
  const renderer = renderComposer();
  const sheet = renderer.root.findByType("BottomSheet");

  expect(sheet.props.sheetStyle).toBeTruthy();
  expect(sheet.props.liftWithKeyboard).toBeUndefined();
  expect(renderer.root.findAllByType("SheetScroll")).toHaveLength(1);
  expect(renderer.root.findAllByType("TextInput")).toHaveLength(3);
  expect(renderer.root.findByProps({ testID: "text-poll-create" }).props.accessibilityState).toEqual({ disabled: true });
});

test("soru ve iki dolu seçenek girilince kırpıp anketi oluşturur", () => {
  const onCreate = jest.fn();
  const renderer = renderComposer({ onCreate });
  let inputs = renderer.root.findAllByType("TextInput");

  act(() => inputs[0].props.onChangeText("  Bu akşam ne izleyelim?  "));
  inputs = renderer.root.findAllByType("TextInput");
  act(() => inputs[1].props.onChangeText("  Arrival "));
  inputs = renderer.root.findAllByType("TextInput");
  act(() => inputs[2].props.onChangeText(" Dune  "));

  const createButton = renderer.root.findByProps({ testID: "text-poll-create" });
  expect(createButton.props.disabled).toBe(false);
  act(() => createButton.props.onPress());
  expect(onCreate).toHaveBeenCalledWith("Bu akşam ne izleyelim?", ["Arrival", "Dune"]);
});
