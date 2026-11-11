// components/hub/TournamentWidget.js
//
// Hub ekranındaki interaktif turnuva widget'ı. Bu ayın türünü, fazını ve geri
// sayımını gösterir; faza göre KİŞİSEL durum satırı ekler:
//   • selection → hype hakkın duruyor mu ("1 hype hakkın var" / "Hype'ın kayıtlı")
//   • voting    → aktif turda kaç maça oy verdiğin (ör. "3/16 maç")
//   • results   → şampiyon posteri
// Tüm fazlarda sayacın altında, kartın tam genişliğini kullanan bracket
// önizlemesi gösterilir (components/tournament/TournamentTreePreview — sohbete
// gönderilen kart da aynısını çizer): 31 maçın TAMAMI (her yarıda 8+4+2+1 çentik,
// merkezde final) tek bakışta okunan iki taraflı bir huni olarak çizilir.
// Basınca TournamentScreen'e gider.
//
// Kartın rengi ve köşedeki animasyonlu simge AYIN TÜRÜNDEN gelir
// (components/tournament/genreMeta.js + GenreGlyph) — karta basıp açılan
// ekranın hero'suyla aynı gradyan ve aynı simge. Faz, durum satırı ve ağaç
// çipiyle anlatılır. Üst satır: kimlik çipi + katılımcı sayısı + "sohbete
// gönder" + beyaz "aç" düğmesi; altında başlık/durum/geri sayım bloğu ve
// sağında türün üç animasyonlu simgesi.
//
// Hafiftir: aday listesini OLUŞTURMAZ (getTournamentDoc — yoksa null); sayımlar
// tek agregat dokümandan (fetchAggOnce), kişisel durum tek kendi-oy dokümanından
// (fetchMyVoteOnce) okunur. Tür/faz/geri sayım motordan (ağ gerekmez) gelir.

import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import HubCard, { GlassPill, HubArrow, HubSendButton } from "@components/hub/HubCard";
import ShareToChatSheet from "@components/chat/ShareToChatSheet";
import { buildTournamentShare } from "@utils/chatShare";
import { encodeBracketSnapshot } from "@utils/tournamentShare";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useImageQualitySettings, useLanguageSettings } from "@context/AppSettingsContext";
import { i18nText } from "@utils/i18nText";
import {
  getPeriodId, parsePeriodId, getScheduleEntry, getPhaseInfo, ROUNDS,
  roundLabel, mediaLabel, themeLabel, buildBracket, tallyVotes, tallyNominations,
  selectFinalists, now,
} from "@services/tournamentEngine";
import {
  getTournamentDoc, fetchVotesOnce, fetchAggOnce, fetchMyVoteOnce,
} from "@services/tournamentService";
import CountdownTimer from "@components/tournament/CountdownTimer";
import { GenreEmblem } from "@components/tournament/GenreGlyph";
import { genreMetaFor } from "@components/tournament/genreMeta";
import TournamentTreePreview, { TOTAL_MATCHES } from "@components/tournament/TournamentTreePreview";
import useLoopActive from "../../hooks/useLoopActive";

export default function TournamentWidget({ navigation }) {
  const { theme } = useTheme();
  // Amblem dar ekranda (360 dp) küçülür: geri sayım (≈187) sol sütuna aralıkla sığsın diye.
  const { width: screenW } = useWindowDimensions();
  const emblemSize = screenW >= 380 ? 92 : 78;
  const { user } = useAuth();
  const { getTmdbUrl } = useImageQualitySettings();
  const { selectedLanguage: lang } = useLanguageSettings();
  const uid = user?.uid;

  const periodId = useMemo(() => getPeriodId(), []);
  const { monthIndex } = useMemo(() => parsePeriodId(periodId), [periodId]);
  const entry = useMemo(() => getScheduleEntry(monthIndex), [monthIndex]);

  const [nowMs, setNowMs] = useState(now());
  const [seed, setSeed] = useState(null);     // { finalists, tallies } | null
  const [agg, setAgg] = useState(null);       // { noms, picks, voters } | null
  const [myVote, setMyVote] = useState(null); // kendi oy dokümanım | null
  const [sendVisible, setSendVisible] = useState(false);

  const clockActive = useLoopActive();
  useEffect(() => {
    if (!clockActive) return undefined;
    setNowMs(now());
    const id = setInterval(() => setNowMs(now()), 30000);
    return () => clearInterval(id);
  }, [clockActive]);

  const phaseInfo = useMemo(() => getPhaseInfo(periodId, nowMs), [periodId, nowMs]);

  // Hafif önizleme verisi (oluşturmadan oku): meta + agg + kendi oyum.
  // Tally için oy koleksiyonunun tamamı YALNIZ agg yoksa (eski ay) çekilir.
  useEffect(() => {
    let active = true;
    (async () => {
      const [d, a, mine] = await Promise.all([
        getTournamentDoc(periodId),
        fetchAggOnce(periodId),
        uid ? fetchMyVoteOnce(periodId, uid) : Promise.resolve(null),
      ]);
      if (!active) return;
      setAgg(a);
      setMyVote(mine);
      if (d?.nominees?.length) {
        let nomTally = a?.noms || {};
        let tallies = a?.picks || {};
        // Agg dokümanı YOKSA (Cloud Function henüz kurulmadıysa) tüm oy
        // koleksiyonundan say — TournamentScreen ile AYNI kural. Aksi halde
        // tallies boş kalır ve ağaç, oylara değil seed sırasına göre kazanan
        // gösterirdi; yani detay ekranından farklı bir şampiyon çıkardı.
        if (!a) {
          const votes = await fetchVotesOnce(periodId);
          if (!active) return;
          nomTally = tallyNominations(votes);
          tallies = tallyVotes(votes);
        }
        // Havuz > 32 ise finalistler hype oylarından türer (ekranla aynı kural).
        setSeed({ finalists: selectFinalists(d.nominees, nomTally), tallies });
      } else {
        setSeed(null);
      }
    })();
    return () => { active = false; };
  }, [periodId, phaseInfo.phase, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bracket AĞDAN değil, çekilen tohumdan türer: nowMs değiştikçe (30 sn'de bir)
  // yeniden hesaplanır, böylece bir tur Hub açıkken KAPANDIĞINDA ağaç kendi
  // kendine ilerler. (Oy sayımları tek seferlik okunur; tazelenmeleri için
  // ekran yeniden odaklanmalı — Hub'ı hafif tutmak bilinçli bir ödün.)
  const bracketPreview = useMemo(
    () => (seed
      ? buildBracket({ nominees: seed.finalists, tallies: seed.tallies, periodId, ms: nowMs })
      : null),
    [seed, periodId, nowMs],
  );

  const genre = genreMetaFor(entry);
  const theTheme = themeLabel(entry, lang);

  // Kişisel durum: hype hakkı / aktif turdaki oy sayısı.
  const myNomCount = useMemo(
    () => Object.keys(myVote?.noms || {}).filter((k) => myVote.noms[k]).length,
    [myVote],
  );
  // Ağaç için sabit kimlik: myVote her tazelemede yeni nesne olur, picks değil.
  const myPicks = useMemo(() => myVote?.picks || null, [myVote]);
  const activeRoundDef =
    phaseInfo.phase === "voting" ? ROUNDS[phaseInfo.activeRound] : null;
  const myRoundPicks = useMemo(() => {
    if (!activeRoundDef) return 0;
    return Object.keys(myVote?.picks || {}).filter((k) =>
      k.startsWith(`${activeRoundDef.key}_`),
    ).length;
  }, [myVote, activeRoundDef]);

  const phaseLabel =
    phaseInfo.phase === "selection"
      ? myNomCount > 0
        ? i18nText("autoI18n.tournament_widget_hyped", "🔥 Hype'ın kayıtlı — sıralamayı izle")
        : i18nText("autoI18n.tournament_widget_hype_left", "🔥 1 hype hakkın var — İlk 32'yi sen seç")
      : phaseInfo.phase === "voting"
        ? `${roundLabel(activeRoundDef, lang)}${
            uid
              ? ` · ${myRoundPicks}/${activeRoundDef.matches} ${i18nText("autoI18n.tournament_widget_match", "maç")}`
              : ""
          }`
        : i18nText("autoI18n.tournament_next_in", "Yeni turnuvaya");

  // Ekran okuyucu için ağacın ilerlemesi (ağaç paneli sessizdir).
  const bracketProgress = useMemo(() => {
    if (!bracketPreview) return null;
    const done = bracketPreview.rounds.reduce(
      (n, r) => n + r.matches.filter((m) => m.decided && m.winnerSide).length, 0,
    );
    return lang === "tr" ? `${TOTAL_MATCHES} maçın ${done} tanesi tamamlandı` : lang === "es" ? `${done} de ${TOTAL_MATCHES} partidos completados` : lang === "pt" ? `${done} de ${TOTAL_MATCHES} partidas concluídas` : lang === "de" ? `${done} von ${TOTAL_MATCHES} Duellen abgeschlossen` : `${done} of ${TOTAL_MATCHES} matches complete`;
  }, [bracketPreview, lang]);

  // Katılımcı sayısı (agg varsa). Kartta yalnız sayı + ikon görünür (dar
  // ekranda İngilizce kimlik çipiyle yan yana sığsın); kelime ekran okuyucuda.
  const voters = agg?.voters > 0 ? agg.voters : 0;
  const votersLabel = voters
    ? `${voters} ${voters === 1 ? i18nText("autoI18n.tournament_voter_one", "katılımcı") : i18nText("autoI18n.tournament_widget_voters", "katılımcı")}`
    : null;

  // Sohbete gönderilecek gövde (utils/chatShare.js): ay + faz + (bittiyse) şampiyon
  // + katılımcı sayısı + kartın altındaki ağacın GÖNDERİM ANINDAKİ hâli (seçimde
  // öne çıkan ilk üç aday da). Tür/tema adı ve güncel faz alıcının cihazında çözülür.
  const sendShare = useMemo(() => {
    const champion = bracketPreview?.championDecided ? bracketPreview.champion : null;
    return buildTournamentShare({
      periodId,
      phase: phaseInfo.phase,
      champion: champion
        ? {
            id: champion.id,
            title: champion.title,
            posterPath: champion.posterPath,
            mediaType: champion.mediaType,
          }
        : undefined,
      voters,
      bracket: encodeBracketSnapshot(bracketPreview, {
        activeRound: phaseInfo.activeRound,
        top: phaseInfo.phase === "selection" ? seed?.finalists : undefined,
      }),
    });
  }, [periodId, phaseInfo.phase, phaseInfo.activeRound, bracketPreview, seed, voters]);

  return (
    <>
    <HubCard
      colors={genre.gradient}
      shadowColor={genre.gradient[1]}
      onPress={() => navigation.navigate("TournamentScreen")}
      accessibilityRole="button"
      accessibilityLabel={`${i18nText("autoI18n.tournament_open", "Aylık turnuvayı aç")} — ${theTheme}, ${phaseLabel}${votersLabel ? `, ${votersLabel}` : ""}${bracketProgress ? `, ${bracketProgress}` : ""}`}
      cardStyle={styles.card}
    >
      <View style={styles.topRow}>
        {/* Kimlik çipi dar ekranda küçülüp kısalabilir; sayı ve ok yerinde kalır. */}
        <GlassPill
          icon="trophy"
          text={i18nText("autoI18n.tournament_monthly", "AYLIK TURNUVA")}
          style={styles.kickerPill}
        />
        {voters > 0 && (
          <GlassPill icon="people" text={String(voters)} tone="dark" textStyle={styles.votersText} />
        )}
        <View style={styles.topSpacer} />
        <HubSendButton
          onPress={() => setSendVisible(true)}
          label={i18nText("autoI18n.sohbete_gonder", "Sohbete gönder")}
        />
        <HubArrow color={genre.ink} />
      </View>

      {/* Sol: tür başlığı + durum + geri sayım.
          Sağ: türün üç animasyonlu simgesi — düğmelerin altında, bloğun dikey
          ortasında bir amblem. */}
      <View style={styles.bodyRow}>
        <View style={styles.bodyCol}>
          <Text style={styles.theme} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
            {theTheme} {mediaLabel(entry.mediaType, lang)}
          </Text>
          <Text style={styles.phaseLabel} numberOfLines={2}>{phaseLabel}</Text>
          <View style={styles.countdownRow}>
            <CountdownTimer
              deadlineMs={phaseInfo.nextDeadlineMs}
              lang={lang}
              size="sm"
              boxColor="rgba(0,0,0,0.24)"
            />
          </View>
        </View>
        <GenreEmblem meta={genre} size={emblemSize} />
      </View>

      <TournamentTreePreview
        bracket={bracketPreview}
        getTmdbUrl={getTmdbUrl}
        accent={theme.accent}
        lang={lang}
        phase={phaseInfo.phase}
        activeRound={phaseInfo.activeRound}
        myPicks={myPicks}
      />
    </HubCard>
    <ShareToChatSheet
      visible={sendVisible && !!sendShare}
      share={sendShare}
      onClose={() => setSendVisible(false)}
    />
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },

  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  kickerPill: { flexShrink: 1 },
  topSpacer: { flex: 1 },
  votersText: { letterSpacing: 0 },

  // Metin sütunu esner; simge rozeti sağda sabit genişlikte durur (hale
  // rozetin dışına taşar, bu yüzden araya biraz fazla boşluk).
  bodyRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  bodyCol: { flex: 1, minWidth: 0 },
  theme: {
    color: "#fff", fontSize: 24, lineHeight: 30, fontWeight: "900", letterSpacing: -0.4,
    textShadowColor: "rgba(0,0,0,0.18)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  phaseLabel: {
    color: "rgba(255,255,255,0.92)", fontSize: 12, lineHeight: 16, fontWeight: "800", marginTop: 3,
  },
  countdownRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
});
