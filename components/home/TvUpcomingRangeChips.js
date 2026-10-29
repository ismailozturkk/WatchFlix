// components/home/TvUpcomingRangeChips.js
//
// "Yaklaşan Diziler" rafının çip satırı — ana ekrandaki rafta (screens/tv/TvShowsUpcoming.js) ve
// "Tümü" ekranında (screens/shared/SeeAllScreen.js) AYNI satır:
//
//   [1 hafta] [1 ay] [3 ay] [6 ay] [1 yıl] [Tümü]
//
// Etiketler "Yaklaşan Filmler"in hazır aralıklarıyla ortak (utils/upcomingFiltersCopy.js). Seçim
// TvShowContex'te (`selectedUpcomingRange`) durur; iki yüzey aynı kök sağlayıcıyı okur.
import React, { memo } from "react";
import DiscoverFilterChip from "./DiscoverFilterChip";
import { SectionChipRail } from "./SectionChips";
import { useLanguage } from "../../context/LanguageContext";
import { TV_UPCOMING_RANGES } from "../../utils/tvUpcoming";
import { getUpcomingFiltersCopy } from "../../utils/upcomingFiltersCopy";

/**
 * @param {string} props.range                  seçili aralık (TV_UPCOMING_RANGES)
 * @param {(range: string) => void} props.onSelectRange
 * @param {object} [props.style]                SectionChipRail dış kabı
 */
function TvUpcomingRangeChips({ range, onSelectRange, style }) {
  const { language } = useLanguage();
  const copy = getUpcomingFiltersCopy(language);

  return (
    <SectionChipRail
      data={TV_UPCOMING_RANGES}
      keyExtractor={(item) => item}
      extraData={`${range}|${language}`}
      renderChip={(item) => (
        <DiscoverFilterChip
          testID={`tv-upcoming-chip-${item}`}
          label={copy.ranges[item]}
          selected={range === item}
          onPress={() => onSelectRange(item)}
        />
      )}
      style={style}
    />
  );
}

export default memo(TvUpcomingRangeChips);
