import React from "react";
import { act, create } from "react-test-renderer";
import SharedListMessage from "../components/chat/SharedListMessage";
import SharedListSheet from "../components/chat/SharedListSheet";
import SharedAiMessage from "../components/chat/SharedAiMessage";
import MessageBubble from "../components/chat/MessageBubble";
import SharedPostMessage from "../components/chat/SharedPostMessage";
import SharedTournamentMessage, { livePhase } from "../components/chat/SharedTournamentMessage";
import SharedCineRoomMessage, { formatRoomCode } from "../components/chat/SharedCineRoomMessage";
import { setDebugNow } from "../services/tournamentEngine";
import {
  buildAiShare,
  buildChallengeShare,
  buildCineRoomShare,
  buildDuelResultShare,
  buildListShare,
  buildPostShare,
  buildShareMessage,
  buildTasteMatchShare,
  buildTournamentShare,
} from "../utils/chatShare";
import SharedTasteMatchMessage from "../components/chat/SharedTasteMatchMessage";

// "Sohbete gönder" balon gövdeleri ve MessageBubble yönlendirmesi: hangi türün
// hangi gövdeyle çizildiği, aç/kapa ve dokunuş bağlantıları, bozuk kaydın düz
// metne düşmesi. Görsel ince ayar (renk, boşluk) cihazda bakılır.

jest.mock("react-native", () => {
  const React = require("react");
  const passthrough = (name) => ({ children, ...rest }) => React.createElement(name, rest, children);
  return {
    View: "View",
    Text: "Text",
    TouchableOpacity: passthrough("TouchableOpacity"),
    Pressable: passthrough("Pressable"),
    FlatList: ({ data, renderItem, ListFooterComponent, ...rest }) =>
      React.createElement(
        "FlatList",
        { data, ...rest },
        data.map((item, index) => React.createElement(React.Fragment, { key: index }, renderItem({ item, index }))),
        ListFooterComponent,
      ),
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    StyleSheet: { create: (s) => s, absoluteFill: { position: "absolute" }, hairlineWidth: 1 },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    LayoutAnimation: { configureNext: () => {}, Presets: { easeInEaseOut: {} } },
    Platform: { OS: "ios" },
    UIManager: {},
  };
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("expo-image", () => ({ Image: "Image" }));
jest.mock("expo-linear-gradient", () => ({ LinearGradient: "Gradient" }));
jest.mock("@expo/vector-icons/Ionicons", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../utils/i18nText", () => ({
  i18nText: (_key, fallback, params) =>
    Object.entries(params || {}).reduce(
      (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
      fallback,
    ),
}));
const mockTheme = {
  primary: "#111111",
  secondary: "#1b1b1b",
  between: "#222222",
  border: "#333333",
  accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#bbbbbb", muted: "#888888" },
};
jest.mock("../context/ThemeContext", () => ({ useTheme: () => ({ theme: mockTheme }) }));
jest.mock("../context/LanguageContext", () => ({ useLanguage: () => ({ t: {}, language: "tr" }) }));

// Liste sayfası: kabuk ve cam düğmeler taklit (görünürlük + dokunuş bağlantısı sınanır).
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 47, bottom: 34 }) }));
jest.mock("../components/common/BottomSheetModal", () => ({
  __esModule: true,
  default: ({ visible, children }) => (visible ? children : null),
}));
jest.mock("../components/common/GlassCloseButton", () => ({ __esModule: true, default: "GlassClose" }));
jest.mock("../components/common/GlassIconButton", () => ({ __esModule: true, default: "GlassIcon" }));

// MessageBubble'ın ağır komşuları: yönlendirmeyi sınıyoruz, onları değil.
jest.mock("../components/common/UserAvatar", () => ({ __esModule: true, default: "UserAvatar" }));
jest.mock("@services/groupsService", () => ({ memberColor: () => "#44aa88" }));
jest.mock("../components/chat/BounceIn", () => ({
  __esModule: true,
  default: ({ children }) => children,
}));
jest.mock("../components/chat/SwipeReplyContainer", () => ({
  __esModule: true,
  default: ({ children }) => children,
}));
jest.mock("../components/chat/MessageReplyPreview", () => ({ __esModule: true, default: () => null }));
jest.mock("../components/chat/PollMessage", () => ({ __esModule: true, default: "PollBody" }));
jest.mock("../components/chat/SharedMediaCollection", () => ({ __esModule: true, default: "CollectionBody" }));
jest.mock("../components/chat/SharedMediaMessage", () => ({ __esModule: true, default: "MediaBody" }));
// Düello kartı gezinme/plan/Firestore kancaları kullanır; gövdesi __tests__/dailyDuel.test.js'te sınanır.
jest.mock("../components/chat/SharedChallengeMessage", () => ({ __esModule: true, default: "ChallengeBody" }));
// Düello sonucu kartı da tablo okur; gövdesi __tests__/inviteResults.test.js'te sınanır.
jest.mock("../components/chat/SharedDuelResultMessage", () => ({ __esModule: true, default: "DuelResultBody" }));

const getTmdbUrl = (path, _type, width) => `https://img.test/w${width}${path}`;

const render = (element) => {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
};
const textOf = (root) =>
  root
    .findAllByType("Text")
    .map((node) => [].concat(node.props.children).join(""))
    .join("|");
const byLabel = (root, label) =>
  root.findAll((node) => node.props.accessibilityLabel === label && typeof node.props.onPress === "function")[0];
const press = (node) => act(() => node.props.onPress());

const profileItem = (id, extra = {}) => ({
  id,
  type: id % 2 ? "movie" : "tv",
  name: `Yapım ${id}`,
  imagePath: `/p${id}.jpg`,
  ...extra,
});
const listShareOf = (count, extra = {}) =>
  buildListShare({
    title: "Hafta sonu",
    items: Array.from({ length: count }, (_, i) => profileItem(i + 1)),
    ...extra,
  });

describe("SharedListMessage", () => {
  const render7 = (props = {}) =>
    render(<SharedListMessage share={listShareOf(7)} getTmdbUrl={getTmdbUrl} {...props} />).root;

  test("shows three posters and a stacked card carrying the remaining count", () => {
    const root = render7();
    const text = textOf(root);
    expect(text).toContain("Hafta sonu");
    expect(text).toContain("7 içerik");
    // 3 düz afiş + yığın: ön kart ve 2 arka kart = 6 görsel.
    expect(root.findAllByType("Image")).toHaveLength(6);
    expect(root.findAllByType("Image")[0].props.source.uri).toBe("https://img.test/w200/p1.jpg");
    // 7 - 3 = 4 kalan; yığının altında dokunma ipucu.
    expect(text).toContain("+4");
    expect(text).toContain("Listeyi gör");
  });

  test("the bubble never grows: no expand control, no inline rows", () => {
    const root = render7({ onOpenList: () => {} });
    expect(byLabel(root, "Tümünü gör")).toBeUndefined();
    expect(byLabel(root, "Daha az")).toBeUndefined();
    // Yalnız üç düz afişin başlığı görünür; 4. ve sonrası yığının arkasında.
    const text = textOf(root);
    expect(text).toContain("Yapım 3");
    expect(text).not.toContain("Yapım 4");
  });

  test("the stack gets shallower as fewer items remain", () => {
    const imagesFor = (count) =>
      render(<SharedListMessage share={listShareOf(count)} getTmdbUrl={getTmdbUrl} />).root.findAllByType(
        "Image",
      ).length;
    expect(imagesFor(3)).toBe(3); // yığın yok
    expect(imagesFor(4)).toBe(4); // tek kart, arka kart yok
    expect(imagesFor(5)).toBe(5); // bir arka kart
    expect(imagesFor(6)).toBe(6); // iki arka kart
    expect(imagesFor(40)).toBe(6); // daha derin olmaz
  });

  test("a list of exactly three has no stack", () => {
    const text = textOf(
      render(<SharedListMessage share={listShareOf(3)} getTmdbUrl={getTmdbUrl} />).root,
    );
    expect(text).not.toContain("Listeyi gör");
    expect(text).not.toContain("+");
  });

  test("tapping the stack opens the full list sheet; so does the header", () => {
    const onOpenList = jest.fn();
    const root = render7({ onOpenList });
    press(byLabel(root, "+4 Listeyi gör"));
    expect(onOpenList).toHaveBeenCalledTimes(1);
    press(byLabel(root, "Listeyi gör"));
    expect(onOpenList).toHaveBeenCalledTimes(2);
  });

  test("without a list handler the stack still opens a title", () => {
    const onOpenItem = jest.fn();
    const root = render7({ onOpenItem });
    press(byLabel(root, "+4 Listeyi gör"));
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: 4 }));
  });

  test("tapping a poster opens that title", () => {
    const onOpenItem = jest.fn();
    const root = render7({ onOpenItem });
    press(byLabel(root, "Yapım 2"));
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: 2, media_type: "tv" }));
  });

  test("default lists use the receiver's own language label", () => {
    const share = listShareOf(2, { title: "Başka Dilde Ad", listKey: "favorites" });
    const root = render(<SharedListMessage share={share} getTmdbUrl={getTmdbUrl} />).root;
    expect(textOf(root)).toContain("Favoriler");
    expect(textOf(root)).not.toContain("Başka Dilde Ad");
  });

  test("the receiver gets a save button; the sender never does", () => {
    const onSave = jest.fn();
    const incoming = render7({ onSave });
    press(byLabel(incoming, "Listeyi kaydet"));
    expect(onSave).toHaveBeenCalledTimes(1);

    const outgoing = render7({ onSave, isOutgoing: true });
    expect(byLabel(outgoing, "Listeyi kaydet")).toBeUndefined();
  });

  test("a truncated list shows the real total on the stack", () => {
    const share = listShareOf(130);
    const root = render(<SharedListMessage share={share} getTmdbUrl={getTmdbUrl} />).root;
    expect(textOf(root)).toContain("+127");
    expect(textOf(root)).toContain("130 içerik");
  });

  test("shows the total runtime only when every duration is known", () => {
    const known = buildListShare({
      title: "Süreli",
      items: [profileItem(1, { minutes: 90 }), profileItem(3, { minutes: 30 })],
    });
    const unknown = buildListShare({ title: "Süresiz", items: [profileItem(1, { minutes: 90 }), profileItem(3)] });
    expect(textOf(render(<SharedListMessage share={known} getTmdbUrl={getTmdbUrl} />).root)).toContain(
      "2 içerik · 2 sa",
    );
    expect(textOf(render(<SharedListMessage share={unknown} getTmdbUrl={getTmdbUrl} />).root)).not.toMatch(
      /sa\b/,
    );
  });
});

describe("SharedListSheet (tam liste sayfası)", () => {
  const sheet = (props = {}) =>
    render(
      <SharedListSheet
        visible
        share={listShareOf(14, { listKey: "favorites" })}
        getTmdbUrl={getTmdbUrl}
        onClose={() => {}}
        onOpenItem={() => {}}
        {...props}
      />,
    ).root;
  const columnsOf = (root) => root.findByType("FlatList").props.numColumns;
  const pressText = (root, label) => press(byLabel(root, label));

  test("titles the sheet with the list name and total, like the friend profile sheet", () => {
    const text = textOf(sheet());
    expect(text).toContain("Favoriler");
    expect(text).toContain("14 içerik");
  });

  test("lists EVERY title as a poster grid (3 columns by default)", () => {
    const root = sheet();
    expect(root.findByType("FlatList").props.data).toHaveLength(14);
    expect(columnsOf(root)).toBe(3);
  });

  test("the 3/4 column switch re-lays the grid", () => {
    const root = sheet();
    pressText(root, "4'lü");
    expect(columnsOf(root)).toBe(4);
    pressText(root, "3'lü");
    expect(columnsOf(root)).toBe(3);
  });

  test("tapping a poster reports the title", () => {
    const onOpenItem = jest.fn();
    const root = sheet({ onOpenItem });
    press(byLabel(root, "Yapım 5"));
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
  });

  test("save button appears only when the viewer can save", () => {
    const onSave = jest.fn();
    expect(byLabel(sheet(), "Listeyi kaydet")).toBeUndefined();
    const root = sheet({ onSave });
    press(byLabel(root, "Listeyi kaydet"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  test("a truncated list says how many titles are not in the grid", () => {
    const text = textOf(sheet({ share: listShareOf(130) }));
    expect(text).toContain("130 içerik");
    expect(text).toContain("+30 içerik daha");
  });

  test("renders nothing heavy while closed", () => {
    const root = sheet({ visible: false });
    expect(root.findAllByType("FlatList")).toHaveLength(0);
  });
});

describe("SharedAiMessage", () => {
  const picks = (n, extra = {}) =>
    Array.from({ length: n }, (_, i) => ({
      media_type: "movie",
      title: `Öneri ${i + 1}`,
      id: i + 1,
      poster_path: `/o${i + 1}.jpg`,
      year: "2016",
      rating: 7.5,
      note: `Neden ${i + 1}`,
      ...extra,
    }));
  const aiShare = (overrides = {}) =>
    buildAiShare({
      variant: "recommendations",
      question: "Bu akşam ne izlesem?",
      sections: [{ picks: picks(6) }],
      ...overrides,
    });

  test("renders the brand header, the question and the first four picks", () => {
    const root = render(<SharedAiMessage share={aiShare()} getTmdbUrl={getTmdbUrl} />).root;
    const text = textOf(root);
    expect(text).toContain("CineMatch");
    expect(text).toContain("Sana Özel Öneriler");
    expect(text).toContain("Bu akşam ne izlesem?");
    expect(text).toContain("Neden 4");
    expect(text).not.toContain("Öneri 5");
    expect(text).toContain("Tümünü gör (6)");
  });

  test("'see all' reveals the rest and can fold back", () => {
    const root = render(<SharedAiMessage share={aiShare()} getTmdbUrl={getTmdbUrl} />).root;
    const seeAll = root
      .findAllByType("TouchableOpacity")
      .find((node) => node.props.accessibilityState && "expanded" in node.props.accessibilityState);
    act(() => seeAll.props.onPress());
    expect(textOf(root)).toContain("Öneri 6");
    expect(textOf(root)).toContain("Daha az");
  });

  test("a found pick opens its detail; an unresolved one is not tappable", () => {
    const onOpenItem = jest.fn();
    const share = buildAiShare({
      variant: "recommendations",
      sections: [{ picks: [...picks(1), { media_type: "movie", title: "Bulunamayan" }] }],
    });
    const root = render(<SharedAiMessage share={share} getTmdbUrl={getTmdbUrl} onOpenItem={onOpenItem} />).root;
    press(byLabel(root, "Öneri 1"));
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(byLabel(root, "Bulunamayan")).toBeUndefined();
  });

  test("a comparison draws both posters side by side with a verdict", () => {
    const share = buildAiShare({
      variant: "comparison",
      versus: true,
      summary: "Arrival daha sakin",
      sections: [{ picks: picks(2) }],
    });
    const root = render(<SharedAiMessage share={share} getTmdbUrl={getTmdbUrl} />).root;
    const text = textOf(root);
    expect(text).toContain("VS");
    expect(text).toContain("Öneri 1");
    expect(text).toContain("Öneri 2");
    expect(text).toContain("Arrival daha sakin");
    expect(text).not.toContain("Tümünü gör");
  });

  test("a text-only general answer folds long text behind 'read more'", () => {
    const share = buildAiShare({ variant: "general", summary: "Uzun cevap ".repeat(40), sections: [] });
    const root = render(<SharedAiMessage share={share} getTmdbUrl={getTmdbUrl} />).root;
    expect(textOf(root)).toContain("Devamını oku");
  });

  test("watch-plan sections keep their labels and notes", () => {
    const share = buildAiShare({
      variant: "watch_plan",
      sections: [
        { label: "Gün 1", note: "Erken yat", picks: picks(1) },
        { label: "Gün 2", picks: [{ media_type: "tv", title: "Severance", id: 9 }] },
      ],
    });
    const text = textOf(render(<SharedAiMessage share={share} getTmdbUrl={getTmdbUrl} />).root);
    ["Gün 1", "Erken yat", "Gün 2", "Severance", "Dizi"].forEach((part) => expect(text).toContain(part));
  });
});

describe("MessageBubble yönlendirmesi", () => {
  const currentUser = { uid: "me" };
  const theme = mockTheme;
  const base = {
    currentUser,
    theme,
    navigation: { push: jest.fn() },
    getTmdbUrl,
    onLongPress: () => {},
    renderMessageText: (text) => text,
    onReply: () => {},
    entrance: null,
  };
  const messageOf = (share, extra = {}) => ({
    id: "m1",
    senderId: "them",
    timestamp: null,
    ...buildShareMessage(share),
    ...extra,
  });

  test("a list share renders the list body and wires save + open", () => {
    const onSaveList = jest.fn();
    const navigation = { push: jest.fn() };
    const item = messageOf(listShareOf(6));
    const root = render(
      <MessageBubble {...base} navigation={navigation} item={item} onSaveList={onSaveList} />,
    ).root;
    expect(textOf(root)).toContain("Hafta sonu");
    press(byLabel(root, "Listeyi kaydet"));
    expect(onSaveList).toHaveBeenCalledWith(item, expect.objectContaining({ type: "list" }));

    press(byLabel(root, "Yapım 1"));
    expect(navigation.push).toHaveBeenCalledWith("MovieDetails", { id: 1 });
  });

  test("the stacked card hands the whole message to the list-sheet opener", () => {
    const onOpenList = jest.fn();
    const item = messageOf(listShareOf(9));
    const root = render(<MessageBubble {...base} item={item} onOpenList={onOpenList} />).root;
    press(byLabel(root, "+6 Listeyi gör"));
    expect(onOpenList).toHaveBeenCalledWith(item, expect.objectContaining({ type: "list", total: 9 }));
  });

  test("my own list share has no save button", () => {
    const item = messageOf(listShareOf(6), { senderId: "me" });
    const root = render(<MessageBubble {...base} item={item} onSaveList={() => {}} />).root;
    expect(byLabel(root, "Listeyi kaydet")).toBeUndefined();
  });

  test("an AI share renders the CineMatch body and opens a pick's detail", () => {
    const navigation = { push: jest.fn() };
    const share = buildAiShare({
      variant: "recommendations",
      sections: [{ picks: [{ media_type: "tv", title: "Severance", id: 77 }] }],
    });
    const root = render(<MessageBubble {...base} navigation={navigation} item={messageOf(share)} />).root;
    expect(textOf(root)).toContain("CineMatch");
    press(byLabel(root, "Severance"));
    expect(navigation.push).toHaveBeenCalledWith("TvShowsDetails", { id: 77 });
  });

  test("a corrupted share falls back to the plain text preview instead of crashing", () => {
    const item = {
      id: "m2",
      senderId: "them",
      kind: "listShare",
      text: "📋 Bozulmuş",
      share: { type: "list", items: "yok" },
    };
    const root = render(<MessageBubble {...base} item={item} />).root;
    expect(root.findAllByType("CollectionBody")).toHaveLength(0);
    expect(textOf(root)).toContain("📋 Bozulmuş");
  });

  test("legacy kind:'list' collections still render as collections", () => {
    const item = {
      id: "m3",
      senderId: "them",
      kind: "list",
      text: "eski",
      items: [{ id: 1, media_type: "movie", title: "Eski", poster_path: "/e.jpg" }],
    };
    const root = render(<MessageBubble {...base} item={item} />).root;
    expect(root.findAllByType("CollectionBody")).toHaveLength(1);
  });
});

// ─── Hub içerikleri: gönderi, turnuva, CineSwipe daveti balonları ────────────

describe("SharedPostMessage", () => {
  const post = (extra = {}) =>
    buildPostShare({
      id: "p1",
      type: "review",
      title: "Dune 2 incelemesi",
      content: "Görsel olarak muhteşem; müzikler de çok iyi.",
      userRating: 4,
      authorName: "Ayşe",
      authorAvatarIndex: 7,
      visibility: "public",
      mediaList: [
        { id: 1, type: "movie", title: "Dune: Part Two", poster: "https://image.tmdb.org/t/p/w500/d2.jpg" },
      ],
      ...extra,
    });
  const mount = (share, props = {}) =>
    render(<SharedPostMessage share={share} getTmdbUrl={getTmdbUrl} {...props} />).root;
  const manyMedia = (n) =>
    Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      type: i % 2 ? "tv" : "movie",
      title: `Yapım ${i + 1}`,
      poster: `https://image.tmdb.org/t/p/w500/m${i + 1}.jpg`,
    }));

  test("shows author, type badge, title, rating, excerpt and poster", () => {
    const root = mount(post());
    const text = textOf(root);
    ["Ayşe", "İNCELEME", "Dune 2 incelemesi", "Görsel olarak muhteşem"].forEach((part) =>
      expect(text).toContain(part),
    );
    // Puan satırı (14 dp); tür rozetinin kendi yıldız ikonu (11 dp) sayılmaz.
    const stars = root
      .findAllByType("Icon")
      .filter((icon) => /^star/.test(icon.props.name) && icon.props.size === 14);
    expect(stars.map((icon) => icon.props.name)).toEqual(["star", "star", "star", "star", "star-outline"]);
    expect(root.findAllByType("Image")[0].props.source.uri).toBe("https://img.test/w200/d2.jpg");
    expect(root.findByType("UserAvatar").props.avatarIndex).toBe(7);
  });

  test("the open button and the body both open the post", () => {
    const onOpenPost = jest.fn();
    const root = mount(post(), { onOpenPost });
    press(byLabel(root, "Gönderiyi aç"));
    expect(onOpenPost).toHaveBeenCalled();
  });

  test("without an opener there is no action button", () => {
    expect(byLabel(mount(post()), "Gönderiyi aç")).toBeUndefined();
  });

  test("a many-poster post uses the same stack; the stack opens the POST, not a title", () => {
    const onOpenPost = jest.fn();
    const onOpenItem = jest.fn();
    const root = mount(post({ type: "list", title: "Hafta sonu", mediaList: manyMedia(9) }), {
      onOpenPost,
      onOpenItem,
    });
    expect(textOf(root)).toContain("+6");
    press(byLabel(root, "+6 Tümünü gör"));
    expect(onOpenPost).toHaveBeenCalledTimes(1);
    expect(onOpenItem).not.toHaveBeenCalled();
    press(byLabel(root, "Yapım 2"));
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: 2, media_type: "tv" }));
  });

  test("a text-only post draws no poster strip", () => {
    const root = mount(buildPostShare({ id: "p2", type: "text", title: "Selam", content: "Nasılsınız?", visibility: "public" }));
    expect(root.findAllByType("Image")).toHaveLength(0);
    expect(textOf(root)).toContain("SOHBET");
  });

  test("a spoiler post hides the text and locks the posters until revealed", () => {
    const onOpenItem = jest.fn();
    const root = mount(post({ hasSpoiler: true, mediaList: manyMedia(2) }), { onOpenItem });
    expect(textOf(root)).not.toContain("Görsel olarak muhteşem");
    expect(textOf(root)).toContain("Spoiler içeriyor");
    press(byLabel(root, "Yapım 1"));
    expect(onOpenItem).not.toHaveBeenCalled();

    press(byLabel(root, "Spoiler'ı göster"));
    expect(textOf(root)).toContain("Görsel olarak muhteşem");
    press(byLabel(root, "Yapım 1"));
    expect(onOpenItem).toHaveBeenCalledTimes(1);
  });

  test("a poll shows its options and vote count without letting the viewer vote", () => {
    const share = buildPostShare({
      id: "p3",
      type: "poll",
      title: "Hangisi?",
      visibility: "public",
      poll: {
        type: "text",
        question: "Hangisi?",
        options: [{ label: "Dune" }, { label: "Arrival" }],
        votes: { u1: "o0", u2: "o1", u3: "o1" },
      },
    });
    const root = mount(share);
    const text = textOf(root);
    expect(text).toContain("Dune");
    expect(text).toContain("Arrival");
    expect(text).toContain("3 oy");
  });
});

describe("SharedTournamentMessage", () => {
  const sendTournament = (extra = {}) =>
    buildTournamentShare({ periodId: "2026-10", phase: "voting", ...extra });
  const mount = (share, props = {}) =>
    render(<SharedTournamentMessage share={share} getTmdbUrl={getTmdbUrl} {...props} />).root;
  const at = (y, m, d) => setDebugNow(new Date(y, m, d, 12).getTime());
  afterEach(() => setDebugNow(null));

  test("titles the card from the period in the viewer's language", () => {
    at(2026, 9, 10);
    const text = textOf(mount(sendTournament()));
    expect(text).toContain("AYLIK TURNUVA");
    // Ekim = Korku, film ayı.
    expect(text).toContain("Korku Film");
    expect(text).toContain("Ekim 2026");
  });

  test("a live voting month says voting and invites the viewer to join", () => {
    at(2026, 9, 10);
    const onOpen = jest.fn();
    const root = mount(sendTournament({ voters: 42 }), { onOpen });
    expect(textOf(root)).toContain("Oylama sürüyor");
    expect(textOf(root)).toContain("42 katılımcı");
    press(byLabel(root, "Turnuvaya katıl"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test("the card follows the calendar: shared in voting, opened after results", () => {
    at(2026, 9, 25);
    const root = mount(sendTournament(), { onOpen: () => {} });
    expect(textOf(root)).toContain("Sonuçlar açıklandı");
    expect(byLabel(root, "Sonuçları gör")).toBeDefined();
    expect(byLabel(root, "Turnuvaya katıl")).toBeUndefined();
  });

  test("a past month is always finished", () => {
    at(2026, 9, 10);
    expect(livePhase("2026-03", "voting")).toBe("results");
    expect(livePhase("2026-10", "voting")).toBe("voting");
    expect(livePhase("2027-01", "selection")).toBe("selection");
  });

  test("shows the champion once the tournament is over", () => {
    at(2026, 9, 25);
    const root = mount(
      sendTournament({ phase: "results", champion: { id: 5, title: "Hereditary", posterPath: "/h.jpg", mediaType: "movie" } }),
    );
    expect(textOf(root)).toContain("Şampiyon");
    expect(textOf(root)).toContain("Hereditary");
    expect(root.findAllByType("Image")[0].props.source.uri).toBe("https://img.test/w200/h.jpg");
  });

  test("a champion snapshot is ignored while the tournament is still running", () => {
    at(2026, 9, 10);
    const root = mount(
      sendTournament({ champion: { id: 5, title: "Hereditary", posterPath: "/h.jpg" } }),
    );
    expect(textOf(root)).not.toContain("Hereditary");
  });
});

describe("SharedCineRoomMessage", () => {
  const room = (extra = {}) => buildCineRoomShare({ code: "749215", host: "Ali", count: 20, ...extra });
  const mount = (share, props = {}) => render(<SharedCineRoomMessage share={share} {...props} />).root;

  test("shows the title, the inviter and the code in readable groups", () => {
    const text = textOf(mount(room()));
    ["CINESWIPE", "Birlikte ne izlesek?", "Ali seni odaya çağırıyor", "749 215", "20 kart"].forEach((part) =>
      expect(text).toContain(part),
    );
  });

  test("an anonymous invite still reads naturally", () => {
    expect(textOf(mount(room({ host: "" })))).toContain("Odaya davetlisin");
  });

  test("the receiver can join; the host sees no join button", () => {
    const onOpen = jest.fn();
    press(byLabel(mount(room(), { onOpen }), "Odaya katıl"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(byLabel(mount(room(), { onOpen, isOutgoing: true }), "Odaya katıl")).toBeUndefined();
  });

  test("formatRoomCode groups digits 3+3", () => {
    expect(formatRoomCode("012345")).toBe("012 345");
  });
});

describe("SharedTasteMatchMessage", () => {
  const taste = (over = {}) =>
    buildTasteMatchShare(
      {
        score: 72,
        watched: { overlap: [{}, {}, {}] },
        favorites: [{}],
        genres: { shared: ["Dram", "Komedi"] },
        ratings: { pairs: 4, agreement: 0.83 },
        loved: [{ name: "Film 1" }],
        highlights: [{ id: 1, type: "movie", name: "Film 1", imagePath: "/p1.jpg" }],
        breakdown: [],
        ...over,
      },
      { host: "Ali", friend: "Ada" },
    );
  const mount = (share, props = {}) => render(<SharedTasteMatchMessage share={share} getTmdbUrl={getTmdbUrl} {...props} />).root;

  test("shows the percent, the tier, both names and the shared facts in the receiver's language", () => {
    const text = textOf(mount(taste()));
    ["ZEVK UYUMU", "Ali & Ada", "%72", "Epey benzer zevkleriniz var", "3 ortak izlenen", "1 ortak favori", "Ortak türler: Dram, Komedi", "Puanlarda %83 uyum · 4 ortak puan", "Ortak sevdiğiniz: Film 1"].forEach(
      (part) => expect(text).toContain(part),
    );
  });

  test("shows the movie / show split only for the categories that have a score", () => {
    const both = textOf(mount(taste({ byType: { movie: { score: 80 }, tv: { score: 61 } } })));
    expect(both).toContain("Film %80");
    expect(both).toContain("Dizi %61");
    const onlyShows = textOf(mount(taste({ byType: { movie: { score: null }, tv: { score: 66 } } })));
    expect(onlyShows).toContain("Dizi %66");
    expect(onlyShows).not.toContain("Film %");
    expect(textOf(mount(taste()))).not.toContain("Dizi %");
  });

  test("renders the shared posters and omits empty rows", () => {
    const root = mount(taste({ favorites: [], genres: { shared: [] }, ratings: { pairs: 0, agreement: null }, loved: [], highlights: [] }));
    const text = textOf(root);
    expect(text).not.toContain("ortak favori");
    expect(text).not.toContain("Ortak türler");
    expect(text).not.toContain("Puanlarda");
    expect(root.findAllByType("Image")).toHaveLength(0);
    expect(mount(taste()).findAllByType("Image")).toHaveLength(1);
  });

  test("MessageBubble draws a taste match share with this body (no tap target)", () => {
    const base = {
      currentUser: { uid: "me" },
      theme: mockTheme,
      getTmdbUrl,
      onLongPress: () => {},
      renderMessageText: (t) => t,
      onReply: () => {},
      entrance: null,
      navigation: { push: jest.fn() },
    };
    const item = { id: "m1", senderId: "them", timestamp: null, ...buildShareMessage(taste()) };
    const root = render(<MessageBubble {...base} item={item} />).root;
    expect(textOf(root)).toContain("%72");
  });
});

describe("MessageBubble: hub paylaşımları", () => {
  const base = {
    currentUser: { uid: "me" },
    theme: mockTheme,
    getTmdbUrl,
    onLongPress: () => {},
    renderMessageText: (text) => text,
    onReply: () => {},
    entrance: null,
  };
  const incoming = (share) => ({ id: "m1", senderId: "them", timestamp: null, ...buildShareMessage(share) });

  test("a challenge share is drawn with the duel body and told who sent it", () => {
    const share = buildChallengeShare({ dayKey: "2026-10-21", score: 7450, correct: 8, total: 10, host: "Ali" });
    const root = render(<MessageBubble {...base} navigation={{ push: jest.fn() }} item={incoming(share)} />).root;
    const body = root.findByType("ChallengeBody");
    expect(body.props.share).toMatchObject({ type: "challenge", score: 7450 });
    expect(body.props.senderUid).toBe("them");
    expect(body.props.isOutgoing).toBe(false);
    // Gelen kutusu satırı simgeli önizlemedir.
    expect(incoming(share).text).toMatch(/^⚔️ /);
  });

  test("a post share opens the post detail", () => {
    const navigation = { push: jest.fn() };
    const share = buildPostShare({ id: "abc", type: "text", title: "Selam", visibility: "public" });
    const root = render(<MessageBubble {...base} navigation={navigation} item={incoming(share)} />).root;
    expect(textOf(root)).toContain("Selam");
    press(byLabel(root, "Gönderiyi aç"));
    expect(navigation.push).toHaveBeenCalledWith("PostDetailScreen", { postId: "abc" });
  });

  test("a tournament share opens the tournament screen", () => {
    setDebugNow(new Date(2026, 9, 10, 12).getTime());
    const navigation = { push: jest.fn() };
    const root = render(
      <MessageBubble
        {...base}
        navigation={navigation}
        item={incoming(buildTournamentShare({ periodId: "2026-10", phase: "voting" }))}
      />,
    ).root;
    press(byLabel(root, "Turnuvaya katıl"));
    expect(navigation.push).toHaveBeenCalledWith("TournamentScreen", undefined);
    setDebugNow(null);
  });

  test("a CineSwipe invite opens the duo lobby with the code", () => {
    const navigation = { push: jest.fn() };
    const root = render(
      <MessageBubble {...base} navigation={navigation} item={incoming(buildCineRoomShare({ code: "749215" }))} />,
    ).root;
    press(byLabel(root, "Odaya katıl"));
    expect(navigation.push).toHaveBeenCalledWith("CineSwipeScreen", { initialMode: "duo", inviteCode: "749215" });
  });

  test("my own invite shows no join button", () => {
    const item = { ...incoming(buildCineRoomShare({ code: "749215" })), senderId: "me" };
    const root = render(<MessageBubble {...base} navigation={{ push: jest.fn() }} item={item} />).root;
    expect(byLabel(root, "Odaya katıl")).toBeUndefined();
  });

  test("joining from the chat card carries this chat and accepts the matching invitation", () => {
    const navigation = { push: jest.fn() };
    const onAcceptInvite = jest.fn();
    const chatTarget = { friendUid: "them", friendName: "Ali" };
    const share = buildCineRoomShare({ code: "749215" });
    const root = render(
      <MessageBubble
        {...base}
        navigation={navigation}
        item={incoming(share)}
        chatTarget={chatTarget}
        onAcceptInvite={onAcceptInvite}
      />,
    ).root;
    press(byLabel(root, "Odaya katıl"));
    expect(onAcceptInvite).toHaveBeenCalledWith(expect.objectContaining({ code: "749215" }), "them");
    expect(navigation.push).toHaveBeenCalledWith("CineSwipeScreen", {
      initialMode: "duo",
      inviteCode: "749215",
      inviteChat: chatTarget,
    });
  });

  test("the challenge body gets this chat and an accept callback", () => {
    const onAcceptInvite = jest.fn();
    const chatTarget = { groupId: "g1", groupName: "Sinema" };
    const share = buildChallengeShare({ dayKey: "2026-10-21", score: 7450, host: "Ali" });
    const root = render(
      <MessageBubble
        {...base}
        navigation={{ push: jest.fn() }}
        item={incoming(share)}
        chatTarget={chatTarget}
        onAcceptInvite={onAcceptInvite}
      />,
    ).root;
    const body = root.findByType("ChallengeBody");
    expect(body.props.chatTarget).toBe(chatTarget);
    act(() => body.props.onAccepted());
    expect(onAcceptInvite).toHaveBeenCalledWith(expect.objectContaining({ type: "challenge" }), "them");
  });

  test("a duel result is drawn with the result body (sender = the player who accepted)", () => {
    const share = buildDuelResultShare({ dayKey: "2026-10-21", hostUid: "me", host: "Ben", guestScore: 8200, hostScore: 7450 });
    const item = { ...incoming(share), senderName: "Ali" };
    const root = render(<MessageBubble {...base} navigation={{ push: jest.fn() }} item={item} />).root;
    const body = root.findByType("DuelResultBody");
    expect(body.props.share).toMatchObject({ type: "duelResult", guestScore: 8200, hostScore: 7450, hostUid: "me" });
    expect(body.props.senderUid).toBe("them");
    expect(incoming(share).text).toMatch(/^⚔️ /);
  });

  test("CineSwipe matches arrive as a saveable list with the CineSwipe label", () => {
    const share = buildListShare({
      title: "Ali & Ayşe",
      items: [
        { id: 1, title: "Dune", media_type: "movie", poster_path: "/d.jpg" },
        { id: 2, name: "Dark", media_type: "tv", poster_path: "/k.jpg" },
      ],
      source: "cineswipe",
    });
    expect(share.source).toBe("cineswipe");
    const onSaveList = jest.fn();
    const root = render(
      <MessageBubble {...base} navigation={{ push: jest.fn() }} item={incoming(share)} onSaveList={onSaveList} />,
    ).root;
    const texts = textOf(root);
    expect(texts).toContain("CineSwipe eşleşmeleri");
    expect(texts).toContain("Ali & Ayşe");
    expect(texts).toContain("2 ortak eşleşme");
    expect(incoming(share).text).toBe("🎬 CineSwipe · 2 ortak eşleşme");
    press(byLabel(root, "Listeyi kaydet"));
    expect(onSaveList).toHaveBeenCalledTimes(1);
  });
});
