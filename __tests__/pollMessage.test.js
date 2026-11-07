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
    ScrollView: passthrough("ScrollView"),
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

test("sohbet medya anketi posterleri küçük tek satırlı seçenekler olarak çizer", () => {
  const renderer = renderPoll({
    poll: {
      question: "Hangisi?",
      type: "media",
      options: [
        { id: "a", label: "Arrival", media: { poster_path: "/a.jpg" } },
        { id: "b", label: "Dune", media: { poster_path: "/b.jpg" } },
      ],
      votes: {},
    },
  });
  const option = renderer.root.findByProps({ testID: "poll-option-a" });
  const flattened = [].concat(option.props.style).filter(Boolean);
  expect(flattened).toEqual(expect.arrayContaining([expect.objectContaining({ width: 56 })]));
});

test("çok seçenekli sohbet medya anketini taşırmak yerine yatay kaydırır", () => {
  const renderer = renderPoll({
    poll: {
      question: "Hangileri?",
      type: "media",
      options: Array.from({ length: 7 }, (_, index) => ({
        id: String(index),
        label: `Film ${index + 1}`,
        media: { poster_path: `/p${index + 1}.jpg` },
      })),
      votes: {},
    },
  });
  const rail = renderer.root.findByType("ScrollView");
  expect(rail.props.horizontal).toBe(true);
  expect(rail.props.showsHorizontalScrollIndicator).toBe(false);
  const optionIds = new Set(
    renderer.root
      .findAll((node) => node.props.testID?.startsWith("poll-option-"))
      .map((node) => node.props.testID),
  );
  expect(optionIds.size).toBe(7);
});

test("chat poll posters shrink so every option fits the chat card width", () => {
  const { chatPosterWidth } = require("../utils/chatCardFit");
  // Dar telefon (nötr kart içi 228): dört afiş + 3 boşluk + 2 sağ pay sığar.
  [228, 260, 284].forEach((width) => {
    [2, 3, 4].forEach((count) => {
      const w = chatPosterWidth(count, width);
      expect(w).toBeLessThanOrEqual(56);
      expect(count * w + 6 * (count - 1) + 2).toBeLessThanOrEqual(width);
    });
  });
  expect(chatPosterWidth(4, undefined)).toBe(56); // genişlik verilmezse eski ölçü
});
