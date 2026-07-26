/**
 * Liste kartlarının vurgu rengi ve ikonu — tek kaynak.
 *
 * Aynı eşleme üç yüzeyde birebir aynı görünmek zorunda: profil rayı
 * (ProfileLists), tüm listeler ekranı (ListsViewScreen) ve Android ana ekran
 * widget'ı (services/listsWidgetService.js → ListsWidgetProvider.kt). Kopya
 * tanımlar sessizce ayrışıp aynı listeyi iki farklı renkte gösteriyordu.
 *
 * İkon adları Ionicons setinden; widget tarafı bunları drawable'a çevirir
 * (bkz. ListsWidgetRemoteViewsService.kt / iconRes).
 */

// Ortak (paylaşılan) listelerin sabit aksanı.
export const SHARED_LIST_ACCENT = "#38bdf8";

export const getListAccent = (listName) => {
  switch (listName) {
    case "watchedMovies":
      return "#4fc3f7";
    case "watchedTv":
      return "#a78bfa";
    case "favorites":
      return "#f87171";
    case "watchList":
      return "#34d399";
    default:
      return "#fbbf24";
  }
};

export const getListIcon = (listName) => {
  switch (listName) {
    case "watchedMovies":
      return "film";
    case "watchedTv":
      return "tv";
    case "favorites":
      return "heart";
    case "watchList":
      return "bookmark";
    default:
      return "list";
  }
};
