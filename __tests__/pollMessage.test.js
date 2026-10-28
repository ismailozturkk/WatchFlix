import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => {
  const React = require("react");
  const passthrough = (name) => ({ children, ...props }) =>
    React.createElement(name, props, children);

  class Value {
    constructor(value) {
      this.value = value;
    }
    interpolate() {
      return `${this.value}%`;
    }
  }

  return {
    View: "View",
    Text: "Text",
    TouchableOpacity: passthrough("TouchableOpacity"),
    StyleSheet: { create: (styles) => styles },
    Animated: {
      Value,
      View: "AnimatedView",
      timing: (value, config) => ({ start: () => { value.value = config.toValue; } }),
      spring: (value, config) => ({ start: () => { value.value = config.toValue; } }),
    },
    Easing: { out: (value) => value, cubic: "cubic" },
  };
});

jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("../utils/i18nText", () => ({
  i18nText: (_key, fallback, params) =>
    Object.entries(params || {}).reduce(
      (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
      fallback,
    ),
}));

const theme = {
  primary: "#101010",
  secondary: "#202020",
  between: "#292929",
  border: "#454545",
  accent: "#6c63ff",
  text: { primary: "#ffffff", secondary: "#dddddd", muted: "#999999" },
};

jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme }) }));

const PollMessage = require("../components/chat/PollMessage").default;

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const renderPoll = (props = {}) => {
  let renderer;
  act(() => {
    renderer = create(
      <PollMessage
        poll={{
          question: "Bu akşam hangisini izleyelim?",
          type: "text",
          options: [
            { id: "a", label: "Arrival" },
            { id: "b", label: "Dune" },
          ],
          votes: { me: "a", friend: "b", friend2: "a" },
        }}
        currentUid="me"
        getTmdbUrl={(path) => path}
        onVote={jest.fn()}
        theme={theme}
        {...props}
      />,
    );
  });
  return renderer;
};

test("sohbet anketi seçimi, sonucu ve erişilebilir dokunma hedefini birlikte gösterir", () => {
  const onVote = jest.fn();
  const renderer = renderPoll({ onVote });
  const selected = renderer.root.findByProps({ testID: "poll-option-a" });
  const other = renderer.root.findByProps({ testID: "poll-option-b" });

  expect(selected.props.accessibilityRole).toBe("button");
  expect(selected.props.accessibilityState).toEqual({ selected: true });
  expect(selected.props.accessibilityLabel).toBe("Arrival, 67%");
  expect(selected.props.accessibilityHint).toBe("Oyunu değiştirmek için dokun");
  expect(other.props.accessibilityState).toEqual({ selected: false });

  act(() => other.props.onPress());
  expect(onVote).toHaveBeenCalledWith("b");
});

test("oy verilmemiş ankette yüzdeyi okumaz ve oy verme ipucunu kullanır", () => {
  const renderer = renderPoll({
    currentUid: "new-user",
    poll: {
      question: "Seçimin?",
      type: "text",
      options: [{ id: "a", label: "Film" }, { id: "b", label: "Dizi" }],
      votes: {},
    },
  });
  const option = renderer.root.findByProps({ testID: "poll-option-a" });

  expect(option.props.accessibilityLabel).toBe("Film");
  expect(option.props.accessibilityHint).toBe("Oy vermek için dokun");
});

test("feed varyantı kendi sade başlık düzenini korur", () => {
  const renderer = renderPoll({ variant: "feed" });
  const texts = renderer.root
    .findAllByType("Text")
    .map((node) => [].concat(node.props.children).join(""));

  expect(texts).not.toContain("Anket");
  expect(texts).toContain("3 oy · Oyunu değiştirmek için dokun");
});
