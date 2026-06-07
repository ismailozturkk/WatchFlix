// Backward-compatibility re-export shim.
// Active consumers have been migrated to the specific hooks below.
// Only unused imports (TabScreen, TabScreenNavigator) still reference this file.
export { ProfileStatsProvider, useProfileStats } from "./ProfileStatsContext";
export { ProfileNotesProvider, useProfileNotes } from "./ProfileNotesContext";
export { ProfileRemindersProvider, useProfileReminders } from "./ProfileRemindersContext";
export { ProfileUiProvider, useProfileUi } from "./ProfileUiContext";

// Merged hook — kept so stale imports don't throw at runtime.
import { useProfileStats } from "./ProfileStatsContext";
import { useProfileNotes } from "./ProfileNotesContext";
import { useProfileReminders } from "./ProfileRemindersContext";
import { useProfileUi } from "./ProfileUiContext";

export const useProfileScreen = () => ({
  ...useProfileStats(),
  ...useProfileNotes(),
  ...useProfileReminders(),
  ...useProfileUi(),
});
