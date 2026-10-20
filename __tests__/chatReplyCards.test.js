import React from "react";
import { act, create } from "react-test-renderer";
import MessageReplyPreview from "../components/chat/MessageReplyPreview";
import ComposerReplyBar from "../components/chat/ComposerReplyBar";

// İki alıntı kartının BAĞLANTISI test edilir: kim olarak etiketlendiği, "Sen"
// / "Kendi mesajına yanıt" kararı, küçük görselin yalnız veri varken çizilmesi,
// kapat/atla dokunuşları. Görsel ince ayar (renk, boşluk) cihazda bakılır.

jest.mock("react-native", () => {
  const React = require("react");
  const resolve = (style, state) => (typeof style === "function" ? style(state) : style);
  return {
    View: "View",
    Text: "Text",
    Pressable: ({ style, children, ...rest }) =>
      React.createElement("Pressable", { ...rest, style: resolve(style, { pressed: false }) }, children),
    StyleSheet: { create: (s) => s, absoluteFill: { position: "absolute" } },
  };
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Babel eklentisi (scripts/babel-transform-app-text.js) `Text`'i AppText'e çevirir.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const anim = { duration: () => anim };
  return {
    __esModule: true,
    default: { View: ({ children, ...rest }) => React.createElement("AnimatedView", rest, children) },
    FadeIn: anim,
    FadeOut: anim,
  };
});
jest.mock("../components/chat/ComposerBlur", () => ({ __esModule: true, default: "Blur" }));
jest.mock("../utils/i18nText", () => ({
  i18nText: (_key, fallback, params) =>
    params ? fallback.replace("{{name}}", params.name) : fallback,
}));
const mockTheme = {
  primary: "#111111",
  secondary: "#1b1b1b",
  border: "#333333",
  accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));

const getTmdbUrl = (path, _type, width) => `https://img.test/w${width}${path}`;

const render = (element) => {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree.root;
};
const textOf = (root) =>
  root
    .findAllByType("Text")
    .map((node) => [].concat(node.props.children).join(""))
    .join("|");

const textReply = { messageId: "m1", senderId: "u1", senderName: "Ali", preview: "selam", kind: "text" };
const movieReply = {
  messageId: "m2",
  senderId: "u2",
  senderName: "Ayşe",
  preview: "Inception",
  kind: "media",
  mediaType: "movie",
  thumb: "/inc.jpg",
};

describe("MessageReplyPreview (balon içi)", () => {
  test("renders sender and preview, no artwork for plain text", () => {
    const root = render(<MessageReplyPreview reply={textReply} getTmdbUrl={getTmdbUrl} />);
    expect(textOf(root)).toBe("Ali|selam");
    expect(root.findAllByType("Image")).toHaveLength(0);
    expect(root.findAllByType("Icon")).toHaveLength(0);
  });

  test("shows 'Sen' instead of the stored name when quoting myself", () => {
    const root = render(<MessageReplyPreview reply={textReply} isSelf />);
    expect(textOf(root)).toBe("Sen|selam");
  });

  test("media reply gets a kind icon and a poster from the TMDB url builder", () => {
    const root = render(<MessageReplyPreview reply={movieReply} getTmdbUrl={getTmdbUrl} />);
    expect(root.findByType("Icon").props.name).toBe("film");
    expect(root.findByType("Image").props.source.uri).toBe("https://img.test/w200/inc.jpg");
  });

  test("skips the poster when no URL builder is passed (never a broken image)", () => {
    const root = render(<MessageReplyPreview reply={movieReply} />);
    expect(root.findAllByType("Image")).toHaveLength(0);
  });

  test("legacy poll previews lose their emoji prefix", () => {
    const poll = { ...textReply, kind: "poll", preview: "📊 Hangisi?" };
    const root = render(<MessageReplyPreview reply={poll} />);
    expect(textOf(root)).toBe("Ali|Hangisi?");
    expect(root.findByType("Icon").props.name).toBe("stats-chart");
  });

  test("press jumps to the message without bubbling to the bubble's own handler", () => {
    const onPress = jest.fn();
    const stopPropagation = jest.fn();
    const root = render(<MessageReplyPreview reply={textReply} onPress={onPress} />);
    root.findByType("Pressable").props.onPress({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalled();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test("renders nothing without a reply", () => {
    const root = render(<MessageReplyPreview reply={null} />);
    expect(root.findAllByType("Text")).toHaveLength(0);
  });
});

describe("ComposerReplyBar (yazma alanı üstü)", () => {
  test("titles the card with the person being replied to", () => {
    const root = render(<ComposerReplyBar reply={textReply} onClose={() => {}} />);
    expect(textOf(root)).toBe("Ali kişisine yanıt|selam");
  });

  test("uses the self wording when replying to my own message", () => {
    const root = render(<ComposerReplyBar reply={textReply} isSelf onClose={() => {}} />);
    expect(textOf(root)).toBe("Kendi mesajına yanıt|selam");
  });

  test("close button cancels the quote", () => {
    const onClose = jest.fn();
    const root = render(<ComposerReplyBar reply={textReply} onClose={onClose} />);
    const close = root
      .findAllByType("Pressable")
      .find((node) => node.props.accessibilityLabel === "Alıntıyı iptal et");
    close.props.onPress();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("tapping the body jumps to the quoted message; disabled when it cannot", () => {
    const onPress = jest.fn();
    const root = render(<ComposerReplyBar reply={textReply} onClose={() => {}} onPress={onPress} />);
    const body = root
      .findAllByType("Pressable")
      .find((node) => node.props.accessibilityLabel === "Alıntılanan mesaja git");
    body.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);

    const noJump = render(<ComposerReplyBar reply={textReply} onClose={() => {}} />);
    const disabledBody = noJump
      .findAllByType("Pressable")
      .find((node) => node.props.accessibilityLabel === "Alıntılanan mesaja git");
    expect(disabledBody.props.disabled).toBe(true);
  });

  test("media reply shows the poster and the glass blur gets the shared target", () => {
    const target = { current: {} };
    const root = render(
      <ComposerReplyBar
        reply={movieReply}
        onClose={() => {}}
        getTmdbUrl={getTmdbUrl}
        blurTarget={target}
      />,
    );
    expect(root.findByType("Image").props.source.uri).toBe("https://img.test/w200/inc.jpg");
    expect(root.findByType("Blur").props.target).toBe(target);
  });
});
