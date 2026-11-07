// components/feed/PostTvGraphBlock.js
//
// Paylaşımlardaki BÖLÜM GRAFİĞİ gönderisinin kartı (post.tvGraph — services/postsService.js anlık görüntüsü).
// Sohbet balonuyla aynı kart (components/tv/TvGraphShareCard), genişlik ölçülür; akışta kısaltılmış, gönderi
// detayında daha uzun (`maxGraphHeight`). Dokununca dizinin canlı grafiği açılır.

import React, { memo } from "react";
import { useNavigation } from "@react-navigation/native";
import TvGraphShareCard from "../tv/TvGraphShareCard";

function PostTvGraphBlock({ tvGraph, maxGraphHeight = 460, showLegend = true, style }) {
  const navigation = useNavigation();
  if (!tvGraph?.id) return null;
  return (
    <TvGraphShareCard
      graph={tvGraph}
      maxGraphHeight={maxGraphHeight}
      showLegend={showLegend}
      onPress={() => navigation.navigate("TvGraphDetailScreen", { id: tvGraph.id })}
      style={style}
      testID="post-tv-graph"
    />
  );
}

export default memo(PostTvGraphBlock);
