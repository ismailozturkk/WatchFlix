import { copyLanguage, normalizeAppLanguage } from "../../utils/appLanguages";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import GlassIconButton from "@components/common/GlassIconButton";
import BottomSheetModal from "@components/common/BottomSheetModal";
import { useAuth } from "@context/AuthContext";
import { useFriends } from "@context/FriendsContext";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { fetchDailyLeaderboard } from "@services/sceneGameService";
import { fetchGameBoard, fetchOverallBoard } from "@services/gameLeaderboards";
import { BOARD_GAME_IDS, OVERALL_BOARD, POSTER_BOARD_GAME, SCENE_BOARD_GAME, compareBoardRows, isBoardGame } from "@utils/gameBoards";
import { getGameBoardsCopy } from "@utils/gameBoardsCopy";
import { DAILY_MODE_ID, DAILY_QUESTION_COUNT, DAILY_SOURCE_ID, dayKeyOf } from "@utils/dailyChallenge";
import UserAvatar from "@components/common/UserAvatar";
import { GameScreenShell, gameSharedStyles } from "./GameScreenShell";
import usePremiumScreenGuard from "@hooks/usePremiumScreenGuard";
import { SCENE_GAME_ID } from "./gameConfig";
import { getBoardGameTitle } from "./gameLabels";
import GlassTouchable from "../../components/common/GlassTouchable";

const PODIUM_COLORS = ["#E8B931", "#C7CDD6", "#CD7F32"];

// Kapsam filtreleri (Part 14.1). Arkadaslar/Global SECILI OYUNUN tablosundan
// (ya da Genel siralamadan — utils/gameBoards.js), Gunluk ise bugunun Gunluk
// Meydan Okuma tablosundan (GameLeaderboards/scene_daily_<gun>) okunur; Gunluk
// yalniz Sahne Tahmin'e ait oldugundan secilince oyun secicisi gizlenir. Haftalik/Sezonluk dereceli tablo backend uretimi gerektirdiginden
// (Part 14.4 / 17 — Faz E) bu surumde kilitli "Yakinda" durumundadir.
const SCOPES = [
  { id: "friends", icon: "people-outline", tr: "Arkadaşlar", en: "Friends", es: "Amigos", pt: "Amigos", de: "Freunde", available: true },
  { id: "global", icon: "earth-outline", tr: "Global", en: "Global", es: "Global", pt: "Global", de: "Global", available: true },
  { id: "daily", icon: "sunny-outline", tr: "Günlük", en: "Daily", es: "Diario", pt: "Diário", de: "Täglich", available: true },
  { id: "weekly", icon: "calendar-outline", tr: "Haftalık", en: "Weekly", es: "Semanal", pt: "Semanal", de: "Wöchentlich", available: false },
  { id: "season", icon: "ribbon-outline", tr: "Sezonluk", en: "Seasonal", es: "De temporada", pt: "Sazonais", de: "Saison", available: false },
];

const accuracyOf = (entry) => {
  const total = (Number(entry?.totalCorrect) || 0) + (Number(entry?.totalWrong) || 0);
  return total ? Math.round(((Number(entry?.totalCorrect) || 0) / total) * 100) : 0;
};

// Hub ve sonuc ekrani `scope` gonderir; gecersiz/kilitli kapsam Global'e duser.
const initialScopeOf = (value) => (SCOPES.find((item) => item.id === value && item.available) ? value : "global");
// `gameId` (sonuc ekrani: o oyunun tablosu); yoksa/gecersizse Genel.
const initialGameOf = (value) => (isBoardGame(value) ? value : OVERALL_BOARD);
// Tablo durumu anahtari: gunluk ya da secili oyun.
const boardKeyOf = (scope, game) => (scope === "daily" ? "daily" : game);
const IDLE = { status: "idle", data: [], failed: [] };

export default function GameLeaderboardScreen({ navigation, route }) {
  usePremiumScreenGuard("games", navigation);
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { friends = [] } = useFriends() || {};
  const tr = copyLanguage(language, ["tr", "en"]) === "tr";
  const es = normalizeAppLanguage(language) === "es";
  const pt = normalizeAppLanguage(language) === "pt";
  const de = normalizeAppLanguage(language) === "de";
  const boardCopy = getGameBoardsCopy(language);
  // Her tablo (oyun basina + gunluk) ayri kaynaktir; ilk secildiginde yuklenir.
  const [boards, setBoards] = useState({});
  const [scope, setScope] = useState(() => initialScopeOf(route?.params?.scope));
  const [game, setGame] = useState(() => initialGameOf(route?.params?.gameId));
  const source = boardKeyOf(scope, game);
  const state = boards[source] || IDLE;
  const isOverall = source === OVERALL_BOARD;
  const [rulesVisible, setRulesVisible] = useState(false);

  const load = useCallback((which, fresh = false) => {
    const put = (next) => setBoards((current) => ({ ...current, [which]: next }));
    put({ status: "loading", data: [], failed: [] });
    const request =
      which === "daily"
        ? fetchDailyLeaderboard(dayKeyOf(), 50).then((data) => ({ rows: data, failed: [] }))
        : which === OVERALL_BOARD
          ? fetchOverallBoard({ fresh })
          : fetchGameBoard(which, { fresh }).then((data) => ({ rows: data, failed: [] }));
    request
      .then(({ rows, failed }) => put({ status: "success", data: Array.isArray(rows) ? rows : [], failed: failed || [] }))
      .catch(() => put({ status: "error", data: [], failed: [] }));
  }, []);
  useEffect(() => {
    if (state.status === "idle") load(source);
  }, [source, state.status, load]);
  const reload = useCallback(() => load(source, true), [load, source]);
  const playDaily = () =>
    navigation.navigate("SceneGamePlayScreen", {
      gameId: SCENE_GAME_ID,
      modeId: DAILY_MODE_ID,
      difficultyId: "normal",
      sourceId: DAILY_SOURCE_ID,
    });

  const friendUids = useMemo(() => {
    const set = new Set(friends.map((f) => f.friendUid || f.id));
    if (user?.uid) set.add(user.uid);
    return set;
  }, [friends, user?.uid]);

  const entries = useMemo(() => {
    const filtered = scope === "friends" ? state.data.filter((e) => friendUids.has(e.uid)) : state.data;
    // Genel satirlar servisten sirali gelir (sira puani + birincilik + oyun sayisi); oyun tablolari burada siralanir.
    return isOverall ? filtered : [...filtered].sort(compareBoardRows);
  }, [scope, state.data, friendUids, isOverall]);

  // Satirin alt bilgisi tabloya gore: Genel → oyun/birincilik, Sahne → dogruluk + seri, digerleri → dogru sayisi.
  const metaOf = useCallback((item) => {
    if (item.isDaily) return `${Number(item.totalCorrect) || 0}/${DAILY_QUESTION_COUNT} ${tr ? "doğru" : es ? "aciertos" : pt ? "acertos" : de ? "richtig" : "correct"} · 🔥 ${Number(item.bestStreak) || 0}`;
    if (isOverall) return boardCopy.overallMeta(item.games || 0, item.firsts || 0);
    if (source === SCENE_BOARD_GAME) return `${accuracyOf(item)}% ${tr ? "doğruluk" : es ? "precisión" : pt ? "precisão" : de ? "Genauigkeit" : "accuracy"} · 🔥 ${Number(item.bestStreak) || 0}`;
    if (source === POSTER_BOARD_GAME) return `${boardCopy.correctMeta(Number(item.totalCorrect) || 0)} · 🔥 ${Number(item.bestStreak) || 0}`;
    return boardCopy.correctMeta(Number(item.totalCorrect) || 0);
  }, [boardCopy, isOverall, source, tr, es, pt, de]);

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  const renderRow = useCallback(({ item, index }) => {
    const rank = index + 4; // FlatList podyumdan sonrasini gosterir
    const isSelf = item.uid === user?.uid;
    return (
      <View style={[styles.row, { backgroundColor: isSelf ? `${theme.accent}1A` : theme.secondary, borderColor: isSelf ? theme.accent : theme.border }]}>
        <Text style={[styles.rank, { color: theme.text.muted }]}>#{rank}</Text>
        <UserAvatar avatarIndex={item.avatarIndex} photoURL={item.photoURL} isCustomPhoto size={36} />
        <View style={styles.player}>
          <Text style={[styles.name, { color: theme.text.primary }]} numberOfLines={1}>{isSelf ? (tr ? "Sen" : es ? "Tú" : pt ? "Você" : de ? "Du" : "You") : item.displayName || (tr ? "Anonim" : es ? "Anónimo" : pt ? "Anônimo" : de ? "Anonym" : "Anonymous")}</Text>
          <Text style={[styles.meta, { color: theme.text.muted }]} numberOfLines={1}>{metaOf(item)}</Text>
        </View>
        <Text style={[styles.points, { color: theme.accent }]}>{Number(item.bestScore) || 0}</Text>
      </View>
    );
  }, [theme, user?.uid, tr, es, pt, de, metaOf]);

  const headerRight = (
    <GlassIconButton
      icon="information-circle-outline"
      iconSize={19}
      size={38}
      fallbackRadius={12}
      color={theme.text.primary}
      accessibilityLabel={tr ? "Sıralama kuralları" : es ? "Reglas de la clasificación" : pt ? "Regras do ranking" : de ? "Ranglistenregeln" : "Ranking rules"}
      onPress={() => setRulesVisible(true)}
    />
  );

  const listHeader = (
    <View style={styles.listHeader}>
      {podium.length > 0 ? <Podium entries={podium} currentUid={user?.uid} theme={theme} tr={tr} es={es} pt={pt} de={de} /> : null}
      {rest.length > 0 ? <Text style={[styles.restLabel, { color: theme.text.muted }]}>{tr ? "DİĞER OYUNCULAR" : es ? "OTROS JUGADORES" : pt ? "OUTROS JOGADORES" : de ? "ANDERE SPIELER" : "OTHER PLAYERS"}</Text> : null}
    </View>
  );

  return (
    <GameScreenShell navigation={navigation} scroll={false} title={tr ? "Liderlik" : es ? "Clasificación" : pt ? "Ranking" : de ? "Bestenliste" : "Leaderboard"} subtitle={scope === "daily" ? getBoardGameTitle(SCENE_BOARD_GAME, language) : isOverall ? boardCopy.overallSubtitle : boardCopy.gameSubtitle(getBoardGameTitle(game, language))} headerRight={headerRight}>
      <ScopeBar scope={scope} onChange={setScope} theme={theme} tr={tr} es={es} pt={pt} de={de} />
      {scope !== "daily" ? <GameBar game={game} onChange={setGame} theme={theme} language={language} /> : null}
      {state.status === "success" && state.failed.length > 0 ? (
        <Text style={[styles.partial, { color: theme.text.muted }]}>{boardCopy.partial}</Text>
      ) : null}

      {state.status === "loading" || state.status === "idle" ? (
        <State icon="trophy-outline" text={tr ? "Sıralamalar yükleniyor..." : es ? "Cargando clasificaciones..." : pt ? "Carregando rankings..." : de ? "Ranglisten werden geladen..." : "Loading rankings..."} theme={theme} loading />
      ) : state.status === "error" ? (
        <State icon="cloud-offline-outline" text={tr ? "Liderlik tablosu yüklenemedi" : es ? "No se pudo cargar la clasificación" : pt ? "Não foi possível carregar o ranking" : de ? "Die Bestenliste konnte nicht geladen werden" : "Could not load the leaderboard"} theme={theme} action={reload} actionText={tr ? "Tekrar Dene" : es ? "Reintentar" : pt ? "Tentar novamente" : de ? "Erneut versuchen" : "Try Again"} />
      ) : entries.length === 0 ? (
        <State
          icon={scope === "friends" ? "people-outline" : scope === "daily" ? "sunny-outline" : "trophy-outline"}
          text={scope === "friends" ? (tr ? "Arkadaşların henüz sıralamada değil" : es ? "Tus amigos aún no están en la clasificación" : pt ? "Seus amigos ainda não estão no ranking" : de ? "Deine Freunde sind noch nicht platziert" : "Your friends aren't ranked yet") : scope === "daily" ? (tr ? "Bugün henüz kimse Günlük Meydan Okuma'yı oynamadı" : es ? "Nadie ha jugado todavía el reto diario de hoy" : pt ? "Ninguém jogou o desafio diário de hoje ainda" : de ? "Niemand hat die heutige tägliche Challenge bisher gespielt" : "Nobody has played today's Daily Challenge yet") : (tr ? "Henüz sıralamaya giren oyuncu yok" : es ? "Aún no hay jugadores clasificados" : pt ? "Ainda não há jogadores classificados" : de ? "Noch keine platzierten Spieler" : "No ranked players yet")}
          theme={theme}
          action={scope === "daily" ? playDaily : undefined}
          actionText={tr ? "Günlüğü Oyna" : es ? "Jugar el reto diario" : pt ? "Jogar o desafio diário" : de ? "Tägliche Challenge spielen" : "Play Daily"}
        />
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(item, index) => item.uid || String(index)}
          renderItem={renderRow}
          ListHeaderComponent={listHeader}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          windowSize={9}
          removeClippedSubviews
        />
      )}

      <RulesModal visible={rulesVisible} onClose={() => setRulesVisible(false)} theme={theme} tr={tr} es={es} pt={pt} de={de} board={source} boardCopy={boardCopy} />
    </GameScreenShell>
  );
}

function ScopeBar({ scope, onChange, theme, tr, es, pt, de }) {
  return (
    <FlatList
      horizontal
      data={SCOPES}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scopeBar}
      style={styles.scopeBarWrap}
      renderItem={({ item }) => {
        const active = scope === item.id;
        const locked = !item.available;
        return (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: locked }}
            disabled={locked}
            activeOpacity={0.8}
            onPress={() => onChange(item.id)}
            style={[styles.scopeChip, { backgroundColor: active ? theme.accent : theme.secondary, borderColor: active ? theme.accent : theme.border, opacity: locked ? 0.5 : 1 }]}
          >
            <AppIcon family="Ionicons" name={item.icon} size={14} color={active ? "#fff" : theme.text.secondary} />
            <Text style={[styles.scopeText, { color: active ? "#fff" : theme.text.secondary }]}>{tr ? item.tr : es ? item.es : pt ? item.pt : de ? item.de : item.en}</Text>
            {locked ? <View style={[styles.soonDot, { backgroundColor: theme.text.muted }]} /> : null}
          </TouchableOpacity>
        );
      }}
    />
  );
}

/** Oyun secicisi: Genel + her oyun (utils/gameBoards BOARD_GAME_IDS sirasiyla). */
function GameBar({ game, onChange, theme, language }) {
  return (
    <FlatList
      horizontal
      data={BOARD_GAME_IDS}
      keyExtractor={(item) => item}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scopeBar}
      style={styles.scopeBarWrap}
      renderItem={({ item }) => {
        const active = game === item;
        const label = getBoardGameTitle(item, language);
        return (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            activeOpacity={0.8}
            onPress={() => onChange(item)}
            style={[styles.gameChip, { backgroundColor: active ? `${theme.accent}22` : "transparent", borderColor: active ? theme.accent : theme.border }]}
          >
            {item === OVERALL_BOARD ? <AppIcon family="Ionicons" name="podium-outline" size={13} color={active ? theme.accent : theme.text.secondary} /> : null}
            <Text style={[styles.gameChipText, { color: active ? theme.accent : theme.text.secondary }]} numberOfLines={1}>{label}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

function Podium({ entries, currentUid, theme, tr, es, pt, de }) {
  // Gorsel sira: 2 - 1 - 3 (ortada birinci).
  const order = [entries[1], entries[0], entries[2]].filter(Boolean);
  return (
    <View style={styles.podium}>
      {order.map((entry) => {
        const realRank = entries.indexOf(entry);
        const isWinner = realRank === 0;
        const isSelf = entry.uid === currentUid;
        return (
          <View key={entry.uid} style={[styles.podiumCol, isWinner && styles.podiumColWinner]}>
            <View style={[styles.podiumAvatarWrap, { borderColor: PODIUM_COLORS[realRank] }, isWinner && styles.podiumAvatarWrapWinner]}>
              <UserAvatar
                avatarIndex={entry.avatarIndex}
                photoURL={entry.photoURL}
                isCustomPhoto
                size={isWinner ? 59 : 49}
              />
              <View style={[styles.podiumRank, { backgroundColor: PODIUM_COLORS[realRank] }]}><Text style={styles.podiumRankText}>{realRank + 1}</Text></View>
            </View>
            <Text style={[styles.podiumName, { color: theme.text.primary }]} numberOfLines={1}>{isSelf ? (tr ? "Sen" : es ? "Tú" : pt ? "Você" : de ? "Du" : "You") : entry.displayName || (tr ? "Anonim" : es ? "Anónimo" : pt ? "Anônimo" : de ? "Anonym" : "Anonymous")}</Text>
            <View style={[styles.podiumBar, { backgroundColor: theme.secondary, borderColor: PODIUM_COLORS[realRank], height: isWinner ? 64 : realRank === 1 ? 50 : 40 }]}>
              <Text style={[styles.podiumScore, { color: PODIUM_COLORS[realRank] }]}>{Number(entry.bestScore) || 0}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function State({ icon, text, theme, loading, action, actionText }) {
  return (
    <View style={[styles.state, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      {loading ? <ActivityIndicator color={theme.accent} /> : <AppIcon family="Ionicons" name={icon} size={35} color={theme.text.muted} />}
      <Text style={[styles.stateText, { color: theme.text.secondary }]}>{text}</Text>
      {action ? <GlassTouchable onPress={action} style={[styles.stateAction, { backgroundColor: theme.accent }]}><Text style={styles.stateActionText}>{actionText}</Text></GlassTouchable> : null}
    </View>
  );
}

function RulesModal({ visible, onClose, theme, tr, es, pt, de, board, boardCopy }) {
  const overall = board === OVERALL_BOARD;
  const rules = overall ? boardCopy.overallRules : tr
    ? ["Önce daha yüksek skor sıralanır.", "Skor eşitse daha çok doğru cevap öne geçer.", "Sonra daha uzun en iyi seri.", "Kalan eşitlikler daha az joker ve skora daha erken ulaşma ile çözülür."]
    : es
      ? ["Primero va quien tiene la puntuación más alta.", "Si hay empate, gana quien tenga más aciertos.", "Después, quien tenga la mejor racha más larga.", "Los empates restantes se deshacen por menos comodines usados y por haber llegado antes a la puntuación."]
      : pt ? ["Quem tem a maior pontuação vem primeiro.", "Em caso de empate, vence quem tiver mais acertos.", "Depois, quem tiver a maior melhor sequência.", "Os empates restantes são desfeitos por menos coringas usados e por ter chegado antes à pontuação."] : de ? ["Die höhere Punktzahl steht vorn.", "Bei Punktgleichheit gewinnen mehr richtige Antworten.", "Danach die längere beste Serie.", "Verbleibende Gleichstände entscheiden weniger Joker und das frühere Erreichen der Punktzahl."] : ["Higher score ranks first.", "If scores tie, more correct answers win.", "Then the longer best streak.", "Remaining ties break on fewer jokers and reaching the score earlier."];
  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      intensity={35}
      dimColor="rgba(0,0,0,0.4)"
    >
      <SafeAreaView edges={["bottom"]} style={[styles.sheet, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
          <Text style={[styles.sheetTitle, { color: theme.text.primary }]}>{tr ? "Sıralama Nasıl Belirlenir?" : es ? "Cómo funciona la clasificación" : pt ? "Como funciona o ranking" : de ? "So wird der Rang bestimmt" : "How Ranking Works"}</Text>
          <Text style={[styles.sheetSubtitle, { color: theme.text.muted }]}>{tr ? "Eşit skorlarda kullanılan sıra (tie-break) kuralları" : es ? "Reglas de desempate para puntuaciones iguales" : pt ? "Regras de desempate para pontuações iguais" : de ? "Regeln zur Auflösung von Gleichständen bei gleichen Punktzahlen" : "Tie-break rules used for equal scores"}</Text>
          <View style={styles.rulesList}>
            {rules.map((rule, index) => (
              <View key={rule} style={styles.ruleRow}>
                <View style={[styles.ruleNumber, { backgroundColor: `${theme.accent}18` }]}><Text style={[styles.ruleNumberText, { color: theme.accent }]}>{index + 1}</Text></View>
                <Text style={[styles.ruleText, { color: theme.text.secondary }]}>{rule}</Text>
              </View>
            ))}
          </View>
          <Text style={[styles.sheetNote, { color: theme.text.muted }]}>{overall ? boardCopy.overallNote : board === POSTER_BOARD_GAME ? boardCopy.posterNote : board !== SCENE_BOARD_GAME && board !== "daily" ? boardCopy.quickNote : tr ? "Global tablo Klasik + Normal sonuçlarından beslenir; kişisel liste oyunları tabloyu etkilemez. Günlük sekme yalnızca bugünün Günlük Meydan Okuma sonuçlarını gösterir." : es ? "La clasificación global usa los resultados del modo Clásico con dificultad Normal; las partidas con listas personales no la afectan. La pestaña Diario solo muestra los resultados del reto diario de hoy." : pt ? "O ranking global usa os resultados do modo Clássico com dificuldade Normal; partidas com listas pessoais não o afetam. A aba Diário mostra apenas os resultados do desafio diário de hoje." : de ? "Die globale Tabelle nutzt Ergebnisse aus Klassik + Normal; Spiele mit eigenen Listen haben darauf keinen Einfluss. Der Tab „Täglich“ zeigt nur die Ergebnisse der heutigen täglichen Challenge." : "The global board uses Classic + Normal results; personal-list games don't affect it. The Daily tab only shows today's Daily Challenge results."}</Text>
          <GlassTouchable onPress={onClose} style={[gameSharedStyles.primaryButton, { backgroundColor: theme.accent }]}><Text style={gameSharedStyles.primaryButtonText}>{tr ? "Anladım" : es ? "Entendido" : pt ? "Entendi" : de ? "Verstanden" : "Got it"}</Text></GlassTouchable>
      </SafeAreaView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  scopeBarWrap: { flexGrow: 0, marginHorizontal: -16 },
  scopeBar: { gap: 8, paddingHorizontal: 16, paddingVertical: 2 },
  scopeChip: { minHeight: 38, borderRadius: 12, borderWidth: 1, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 6 },
  scopeText: { fontSize: 12, fontWeight: "800" },
  soonDot: { width: 5, height: 5, borderRadius: 3, marginLeft: 1 },
  gameChip: { minHeight: 32, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 5 },
  gameChipText: { fontSize: 12, fontWeight: "800" },
  partial: { fontSize: 11, fontWeight: "650", textAlign: "center" },
  list: { flex: 1, marginTop: 4 },
  listContent: { paddingBottom: 30, gap: 9 },
  listHeader: { gap: 9 },
  podium: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 10, paddingTop: 8, paddingBottom: 4 },
  podiumCol: { flex: 1, alignItems: "center", maxWidth: 116 },
  podiumColWinner: { marginBottom: 4 },
  podiumAvatarWrap: { width: 54, height: 54, borderRadius: 28, borderWidth: 2.5, alignItems: "center", justifyContent: "center", marginBottom: 7 },
  podiumAvatarWrapWinner: { width: 64, height: 64, borderRadius: 33 },
  podiumRank: { position: "absolute", bottom: -4, alignSelf: "center", minWidth: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, borderWidth: 2, borderColor: "rgba(0,0,0,0.2)" },
  podiumRankText: { color: "#160C24", fontSize: 11, fontWeight: "900" },
  podiumName: { fontSize: 11, fontWeight: "850", maxWidth: "100%" },
  podiumBar: { alignSelf: "stretch", borderRadius: 12, borderWidth: 1, marginTop: 6, alignItems: "center", justifyContent: "center" },
  podiumScore: { fontSize: 16, fontWeight: "900" },
  restLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 0.7, marginTop: 6, marginLeft: 2 },
  row: { minHeight: 64, borderRadius: 16, borderWidth: 1, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  rank: { width: 32, fontSize: 14, fontWeight: "900" },
  player: { flex: 1 },
  name: { fontSize: 14, fontWeight: "850" },
  meta: { fontSize: 10, fontWeight: "700", marginTop: 3 },
  points: { fontSize: 18, fontWeight: "900" },
  state: { flex: 1, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, marginTop: 10 },
  stateText: { textAlign: "center", fontSize: 13, fontWeight: "650" },
  stateAction: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  stateActionText: { color: "#fff", fontWeight: "850" },
  sheet: { borderTopLeftRadius: 27, borderTopRightRadius: 27, borderWidth: 1, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 12 },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: "900" },
  sheetSubtitle: { fontSize: 11, fontWeight: "650", marginTop: 3 },
  rulesList: { marginVertical: 15, gap: 12 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  ruleNumber: { width: 27, height: 27, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  ruleNumberText: { fontSize: 12, fontWeight: "900" },
  ruleText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "650" },
  sheetNote: { fontSize: 10, lineHeight: 15, fontWeight: "650", marginBottom: 14 },
});
