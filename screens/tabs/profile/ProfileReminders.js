import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import { useTheme } from "../../../context/ThemeContext";
import { useLanguage } from "../../../context/LanguageContext";
import { useProfileScreen } from "../../../context/ProfileScreenContext";

const { width } = Dimensions.get("window");

export default function ProfileReminders({ navigation }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const {
    loading,
    activeTab,
    reminders,
    setActiveTab,
    formatDate,
    calculateDateDifference,
  } = useProfileScreen();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
        {t.profileScreen.ProfileReminder.reminder}
      </Text>
      <View
        style={[
          styles.tabContainer,
          {
            backgroundColor: theme.secondary,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tab,
            {
              backgroundColor:
                activeTab === "movie" ? theme.primary : theme.secondary,
            },
          ]}
          onPress={() => setActiveTab("movie")}
        >
          <Text
            style={{
              color:
                activeTab === "movie"
                  ? theme.text.primary
                  : theme.text.secondary,
            }}
          >
            {t.profileScreen.ProfileReminder.movieReminder}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            {
              backgroundColor:
                activeTab === "tv" ? theme.primary : theme.secondary,
            },
          ]}
          onPress={() => setActiveTab("tv")}
        >
          <Text
            style={{
              color:
                activeTab === "tv" ? theme.text.primary : theme.text.secondary,
            }}
          >
            {t.profileScreen.ProfileReminder.tvSeriesReminder}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.reminderList}
        contentContainerStyle={{ paddingHorizontal: 15, gap: 5 }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {loading ? (
          <Text style={{ color: theme.text.muted }}>Yükleniyor...</Text>
        ) : activeTab === "tv" ? (
          reminders.tvReminders?.length > 0 ? (
            reminders.tvReminders.map((show) => (
              <ScrollView key={show.showId} style={styles.showContainer}>
                <Text style={[styles.showTitle, { color: theme.text.primary }]}>
                  {show.showName}
                </Text>
                {show.seasons.map((season) => (
                  <View
                    key={`${show.showId}-${season.seasonNumber}`}
                    style={styles.seasonContainer}
                  >
                    <Text
                      style={[
                        styles.seasonTitle,
                        { color: theme.text.secondary },
                      ]}
                    >
                      Sezon {season.seasonNumber}
                    </Text>
                    {season.episodes.map((episode) => (
                      <TouchableOpacity
                        key={
                          episode.episodeId ||
                          `${show.showId}-${season.seasonNumber}-${episode.episodeNumber}`
                        }
                        onPress={() =>
                          navigation.navigate("TvShowsDetails", {
                            id: show.showId,
                          })
                        }
                      >
                        <View
                          style={[
                            styles.reminderCard,
                            {
                              backgroundColor: theme.secondary,
                              borderColor: theme.border,
                            },
                          ]}
                        >
                          <Image
                            source={{
                              uri: `https://image.tmdb.org/t/p/w500${season.seasonPosterPath}`,
                            }}
                            style={styles.image}
                          />
                          <View style={styles.reminderInfo}>
                            <Text
                              style={[
                                styles.episodeName,
                                { color: theme.text.primary },
                              ]}
                            >
                              {episode.episodeNumber}. Bölüm
                            </Text>
                            <Text
                              style={[
                                styles.episodeInfo,
                                { color: theme.text.secondary },
                              ]}
                            >
                              {episode.episodeMinutes} dakika
                            </Text>
                            <Text
                              style={[
                                styles.airDate,
                                { color: theme.text.secondary },
                              ]}
                            >
                              {formatDate(episode.airDate)}
                            </Text>
                            <Text
                              style={[
                                styles.airDate,
                                {
                                  color:
                                    calculateDateDifference(episode.airDate)
                                      .days < 4
                                      ? theme.colors.green
                                      : calculateDateDifference(episode.airDate)
                                            .days < 7
                                        ? theme.colors.blue
                                        : calculateDateDifference(
                                              episode.airDate
                                            ).months < 1
                                          ? theme.colors.orange
                                          : calculateDateDifference(
                                                episode.airDate
                                              ).months < 3
                                            ? theme.colors.red
                                            : theme.colors.purple,
                                },
                              ]}
                            >
                              {calculateDateDifference(episode.airDate).text}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </ScrollView>
            ))
          ) : (
            <Text style={{ color: theme.text.muted }}>
              {t.profileScreen.ProfileReminder.noTvSeriesReminder}
            </Text>
          )
        ) : reminders.movieReminders?.length > 0 ? (
          reminders.movieReminders
            .slice() // orijinal diziyi bozmamak için kopya al
            .sort((a, b) => new Date(a.releaseDate) - new Date(b.releaseDate))
            .map((reminder, index) => (
              <TouchableOpacity
                key={reminder.movieId}
                onPress={() =>
                  navigation.navigate("MovieDetails", { id: reminder.movieId })
                }
              >
                <View
                  style={[
                    styles.reminderCard,
                    {
                      backgroundColor: theme.secondary,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Image
                    source={{
                      uri: `https://image.tmdb.org/t/p/w500${reminder.posterPath}`,
                    }}
                    style={styles.image}
                  />
                  <View style={styles.reminderInfo}>
                    <Text
                      style={[styles.showName, { color: theme.text.primary }]}
                    >
                      {reminder.movieName}
                    </Text>
                    <Text
                      style={[styles.airDate, { color: theme.text.secondary }]}
                    >
                      {formatDate(reminder.releaseDate)}
                    </Text>
                    <Text
                      style={[
                        styles.airDate,
                        {
                          color:
                            calculateDateDifference(reminder.releaseDate).days <
                            4
                              ? theme.colors.green
                              : calculateDateDifference(reminder.releaseDate)
                                    .days < 7
                                ? theme.colors.blue
                                : calculateDateDifference(reminder.releaseDate)
                                      .months < 1
                                  ? theme.colors.orange
                                  : calculateDateDifference(
                                        reminder.releaseDate
                                      ).months < 3
                                    ? theme.colors.red
                                    : theme.colors.purple,
                        },
                      ]}
                    >
                      {calculateDateDifference(reminder.releaseDate).text}
                    </Text>
                    <Text
                      style={[
                        styles.episodeInfo,
                        { color: theme.text.secondary },
                      ]}
                    >
                      {reminder.movieMinutes} dakika
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
        ) : (
          <Text style={{ color: theme.text.muted }}>
            {t.profileScreen.ProfileReminder.noMovieReminder}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    width: "100%", // height: 150,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 20,
    textTransform: "uppercase",
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginHorizontal: 15,
    marginBottom: 15,
    gap: 10,
    borderRadius: 15,
    padding: 5,
  },
  tab: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  reminderList: {
    flex: 1,
  },
  reminderCard: {
    flexDirection: "row",
    padding: 3,
    marginBottom: 10,
    borderRadius: 10,
    paddingRight: 5,
    borderWidth: 1,
    width: 160, // Ekran genişliğinden padding çıkarıldı
  },
  image: {
    width: 50, // Ekranın %25'i
    height: 75,
    borderRadius: 7,
  },
  reminderInfo: {
    flex: 1,
    marginLeft: 10,
    justifyContent: "center",
  },
  showName: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 5,
    flexWrap: "wrap", // Uzun metinlerin alt satıra geçmesini sağlar
  },

  showContainer: {},
  showTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  seasonContainer: {
    marginBottom: 15,
  },
  seasonTitle: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 8,
    paddingHorizontal: 10,
  },

  episodeName: {
    fontSize: 11,
    fontWeight: "500",
    marginBottom: 4,
  },
  episodeInfo: {
    fontSize: 10,
  },
  airDate: {
    fontSize: 10,
    fontStyle: "italic",
  },
});
