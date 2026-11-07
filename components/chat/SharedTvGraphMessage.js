// components/chat/SharedTvGraphMessage.js
//
// Sohbette paylaşılan dizi BÖLÜM GRAFİĞİ (mesaj kind: "tvGraphShare", gövde utils/tvGraphShare.buildTvGraphShare).
// Kart components/tv/TvGraphShareCard (akış gönderisiyle aynı); sohbet içinde sezon sayısından bağımsız
// her sezon yatay bölüm şeridi olarak çizilir. Dokununca dizinin canlı grafiği (TvGraphDetailScreen) açılır.

import React, { memo } from "react";
import { useNavigation } from "@react-navigation/native";
import { i18nText } from "../../utils/i18nText";
import TvGraphShareCard from "../tv/TvGraphShareCard";
import { balancedEpisodesPerRow } from "../../utils/tvGraphShare";

const CARD_WIDTH = 260;
const MAX_EPISODES_PER_ROW = 10;

function SharedTvGraphMessage({ share, isOutgoing = false, cardWidth = CARD_WIDTH }) {
  const navigation = useNavigation();
  const footer = !isOutgoing && share.host ? i18nText("autoI18n.tvgraph_gonderen", "{{name}} gönderdi", { name: share.host }) : "";
  const seasons = Array.isArray(share.seasons) ? share.seasons : [];
  const maxEpisodes = seasons.reduce((max, season) => Math.max(max, season?.r?.length || 0), 0);
  const totalEpisodes = share.totalEpisodes || seasons.reduce((sum, season) => sum + (season?.r?.length || 0), 0);
  // Kart her zaman sohbet kartı genişliğindedir (diğer özel kartlarla aynı hiza;
  // daralan kartta alt satır "1 sezon · …" diye kesiliyordu). Kısa grafikte kareler
  // 30 dp tavanında kalır ve ortalanır; çok sezonlu/uzun grafik genişliği doldurur.
  const compactGraph = seasons.length <= 2 && maxEpisodes <= 10 && totalEpisodes <= 14;
  return (
    <TvGraphShareCard
      graph={share}
      width={cardWidth}
      maxGraphHeight={320}
      layoutMode="rows"
      episodesPerRow={balancedEpisodesPerRow(seasons, MAX_EPISODES_PER_ROW)}
      fillRowsWidth={!compactGraph}
      footer={footer}
      onPress={() => navigation.navigate("TvGraphDetailScreen", { id: share.id })}
      style={{ alignSelf: "flex-start", marginBottom: 2 }}
      testID="tvgraph-share-bubble"
    />
  );
}

export default memo(SharedTvGraphMessage);
