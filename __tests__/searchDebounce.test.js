// Yazarken arama gecikmesi tek kaynakta (utils/searchDebounce.js). Ağa giden her arama kutusu bu sabiti kullanır;
// ekran ekran farklı sayı (280 / 350 / 450 / 500 ms) geri gelmesin.
import fs from "fs";
import path from "path";
import { SEARCH_DEBOUNCE_MS } from "../utils/searchDebounce";
import { CHAT_SEARCH_DEBOUNCE_MS } from "../utils/chatMediaSearch";

const USERS = [
  "screens/search/ActorSearch.js",
  "screens/search/MovieSearch.js",
  "screens/search/TvShowSearch.js",
  "screens/search/SearchFriendsScreen.js",
  "screens/fun/Top100Screen.js",
  "screens/game/DailyFrameScreen.js",
  "screens/lists/ListsScreen.js",
  "screens/lists/SharedListScreen.js",
  "components/modals/CreatePostModal.js",
  "components/club/ClubCandidatePicker.js",
  "components/favorites/FavoritePickerSheet.js",
  "components/tournament/NomineeSearchModal.js",
  "components/tierList/TierListAddSheet.js",
];

it("gecikme 300 ms ve sohbet medya araması aynı sabiti kullanır", () => {
  expect(SEARCH_DEBOUNCE_MS).toBe(300);
  expect(CHAT_SEARCH_DEBOUNCE_MS).toBe(SEARCH_DEBOUNCE_MS);
});

it.each(USERS)("%s ortak sabiti kullanır", (file) => {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  expect(source).toMatch(/import \{ SEARCH_DEBOUNCE_MS \} from "[./]+utils\/searchDebounce";/);
  expect(source).toMatch(/SEARCH_DEBOUNCE_MS\)/);
});
