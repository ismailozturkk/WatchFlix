import {
  Animated,
  FlatList,
  Image,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useProfileScreen } from "../../../context/ProfileScreenContext";
import { useTheme } from "../../../context/ThemeContext";
import { Picker } from "@react-native-picker/picker"; // veya başka bir dropdown kütüphanesi
import Fontisto from "@expo/vector-icons/Fontisto";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
const TvStatisticsScreen = ({ navigation }) => {
  const {
    formatDate,
    groupedDataTv,
    uniqueDatesTv,
    t,
    isLoadingTv,
    onPressIn,
    onPressOut,
    scaleValues,
    formatTotalDurationTime,
    timeDisplayMode,
    handleTimeClick,
    totalWatchedTimeTv,
    watchedTvCount,
    totalMinutesTimeTv,
    mostWatchedGenreTv,
    secondWatchedGenreTv,
    thirdWatchedGenreTv,
    totalEpisodesCount,
    selectedDateTv,
    setSelectedDateTv,
    flatEpisodesTv,
    totalSeasonsCount,
  } = useProfileScreen();
  const { theme } = useTheme();
  const [searchVisible, setSearchVisible] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filteredGroupedData = groupedDataTv
    .map((section) => ({
      ...section,
      data: section.data.filter(
        (item) =>
          !search ||
          item.showName?.toLowerCase().includes(search.toLowerCase()) ||
          item.episodeName?.toLowerCase().includes(search.toLowerCase()) ||
          item.seasonNumber == search
      ),
    }))
    .filter((section) => section.data.length > 0);

  // flatEpisodesTv: tüm bölümlerin düz hali (context’ten alabilirsin)
  const [openedSeason, setOpenedSeason] = useState(null);

  const seasonGroupedData = filteredGroupedData.map((section) => {
    const group = section.data.map((item) => {
      item.episodeWatchTime = item.episodeWatchTime || 0;
      return item;
    });
  });
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.primary,
      }}
    >
      <TouchableOpacity onPress={() => setInfoOpen(!infoOpen)}>
        <View
          style={[
            styles.watchStats,
            {
              backgroundColor: theme.border,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View
            style={[
              {
                flexDirection: "row",
                justifyContent: "space-around",
                alignItems: "center",
                gap: 5,
              },
            ]}
          >
            <View
              style={{
                width: "22%",
                justifyContent: "center",
                alignItems: "center",
                //flexDirection: "row",
                backgroundColor: theme.secondary,
                borderColor: theme.border,
                //borderWidth: 1,
                padding: 5,
                borderRadius: 5,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 1,
                shadowRadius: 5,
                elevation: 10, // Android için güçlü gölge efekti
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  color: theme.text.secondary,
                  fontSize: 22,
                  fontWeight: "bold",
                }}
              >
                {watchedTvCount}
              </Text>
              <Text
                style={{
                  textAlign: "center",
                  color: theme.text.muted,
                  fontSize: 12,
                }}
              >
                {t.profileScreen.tvShowWatched}
              </Text>
            </View>
            <View
              style={{
                width: "21%",
                justifyContent: "center",
                alignItems: "center",
                //flexDirection: "row",
                backgroundColor: theme.secondary,
                borderColor: theme.border,
                //borderWidth: 1,
                padding: 5,
                borderRadius: 5,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 1,
                shadowRadius: 5,
                elevation: 10, // Android için güçlü gölge efekti
              }}
            >
              <Text
                style={{
                  textAlign: "center",
                  color: theme.text.secondary,
                  fontSize: 22,
                  fontWeight: "bold",
                }}
              >
                {totalEpisodesCount}
              </Text>
              <Text
                style={{
                  textAlign: "center",
                  color: theme.text.muted,
                  fontSize: 12,
                }}
              >
                {t.profileScreen.tvShowEpisodetotalCount}
              </Text>
            </View>
            <View
              style={{
                width: "55%",
                height: "100%",
                flexDirection: "row",
                justifyContent: "space-around",
                alignItems: "center",
                backgroundColor: theme.secondary,
                borderColor: theme.border,
                //borderWidth: 1,
                padding: 5,
                borderRadius: 5,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 1,
                shadowRadius: 5,
                elevation: 10, // Android için güçlü gölge efekti
              }}
            >
              <View>
                <Text
                  style={{
                    textAlign: "center",
                    color: theme.text.secondary,
                    fontSize: 22,
                    fontWeight: "bold",
                  }}
                >
                  {totalWatchedTimeTv?.years}
                </Text>
                <Text
                  style={{
                    textAlign: "center",
                    color: theme.text.muted,
                    fontSize: 12,
                  }}
                >
                  {t.profileScreen.years}
                </Text>
              </View>
              <View>
                <Text
                  style={{
                    textAlign: "center",
                    color: theme.text.secondary,
                    fontSize: 22,
                    fontWeight: "bold",
                  }}
                >
                  {totalWatchedTimeTv?.months}
                </Text>
                <Text
                  style={{
                    textAlign: "center",
                    color: theme.text.muted,
                    fontSize: 12,
                  }}
                >
                  {t.profileScreen.months}
                </Text>
              </View>
              <View>
                <Text
                  style={{
                    textAlign: "center",
                    color: theme.text.secondary,
                    fontSize: 22,
                    fontWeight: "bold",
                  }}
                >
                  {totalWatchedTimeTv?.days}
                </Text>
                <Text
                  style={{
                    textAlign: "center",
                    color: theme.text.muted,
                    fontSize: 12,
                  }}
                >
                  {t.profileScreen.days}
                </Text>
              </View>
              <View>
                <Text
                  style={{
                    textAlign: "center",
                    color: theme.text.secondary,
                    fontSize: 22,
                    fontWeight: "bold",
                  }}
                >
                  {totalWatchedTimeTv?.hours}
                </Text>
                <Text
                  style={{
                    textAlign: "center",
                    color: theme.text.muted,
                    fontSize: 12,
                  }}
                >
                  {t.profileScreen.hours}
                </Text>
              </View>
              <View>
                <Text
                  style={{
                    textAlign: "center",
                    color: theme.text.secondary,
                    fontSize: 22,
                    fontWeight: "bold",
                  }}
                >
                  {totalWatchedTimeTv?.minutes}
                </Text>
                <Text
                  style={{
                    textAlign: "center",
                    color: theme.text.muted,
                    fontSize: 12,
                  }}
                >
                  {t.profileScreen.minutes}
                </Text>
              </View>
            </View>
          </View>
          {infoOpen && (
            <>
              <View
                style={[
                  {
                    flexDirection: "row",
                    justifyContent: "space-around",
                    alignItems: "center",
                    gap: 5,
                  },
                ]}
              >
                <View
                  style={{
                    width: "44%",

                    justifyContent: "center",
                    alignItems: "center",
                    paddingVertical: 3,
                    paddingHorizontal: 6,
                    borderRadius: 5,
                    backgroundColor: theme.secondary,
                    flexDirection: "row",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 1,
                    shadowRadius: 5,
                    elevation: 10, // Android için güçlü gölge efekti
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.text.muted,
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    Toplam izlenme:
                  </Text>
                </View>
                <TouchableOpacity
                  style={{
                    width: "55%",
                    justifyContent: "center",
                    alignItems: "center",
                    paddingVertical: 3,
                    paddingHorizontal: 6,
                    borderRadius: 5,

                    backgroundColor: theme.secondary,
                    flexDirection: "row",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 1,
                    shadowRadius: 5,
                    elevation: 10, // Android için güçlü gölge efekti
                  }}
                  onPress={() => handleTimeClick()}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: "row", gap: 5 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        color: theme.text.muted,
                        fontWeight: "bold",
                        textAlign: "center",
                      }}
                    >
                      {formatTotalDurationTime(
                        totalMinutesTimeTv || 0,
                        timeDisplayMode
                      )}
                    </Text>
                    <Fontisto
                      name="arrow-h"
                      size={16}
                      color={theme.text.muted}
                    />
                  </View>
                </TouchableOpacity>
              </View>
              <View
                style={[
                  {
                    flexDirection: "row",
                    justifyContent: "space-around",
                    alignItems: "center",
                    gap: 5,
                  },
                ]}
              >
                <View
                  style={{
                    width: "22%",
                    justifyContent: "center",
                    alignItems: "center",
                    //flexDirection: "row",
                    backgroundColor: theme.secondary,
                    borderColor: theme.border,
                    //borderWidth: 1,
                    padding: 5,
                    borderRadius: 5,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 1,
                    shadowRadius: 5,
                    elevation: 10, // Android için güçlü gölge efekti
                  }}
                >
                  <Text
                    style={{
                      textAlign: "center",
                      color: theme.text.secondary,
                      fontSize: 22,
                      fontWeight: "bold",
                    }}
                  >
                    {totalSeasonsCount}
                  </Text>
                  <Text
                    style={{
                      textAlign: "center",
                      color: theme.text.muted,
                      fontSize: 12,
                    }}
                  >
                    {t.profileScreen.tvShowSeasonCount}
                  </Text>
                </View>
                <View
                  style={{
                    width: "22%",

                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: theme.secondary,
                    borderColor: theme.border,
                    //borderWidth: 1,
                    padding: 5,
                    borderRadius: 5,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 1,
                    shadowRadius: 5,
                    elevation: 10, // Android için güçlü gölge efekti
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      fontSize: 12,
                      color: theme.text.muted,
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    En Çok İzlenen Türeler
                  </Text>
                </View>

                <View
                  style={{
                    width: "55%",
                    //flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: theme.secondary,
                    borderColor: theme.border,
                    //borderWidth: 1,
                    padding: 5,
                    borderRadius: 5,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 1,
                    shadowRadius: 5,
                    elevation: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      borderRadius: 10,
                      color: theme.text.muted,
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    {mostWatchedGenreTv}
                  </Text>

                  <Text
                    style={{
                      fontSize: 12,
                      borderRadius: 10,
                      color: theme.text.muted,
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    {secondWatchedGenreTv}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      borderRadius: 10,
                      color: theme.text.muted,
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                  >
                    {thirdWatchedGenreTv}
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <View
          style={{
            //width: searchVisible ? "70%" : "15%",
            paddingHorizontal: 10,
            //paddingVertical: 5,
            backgroundColor: theme.secondary,
            borderRadius: 15,
            justifyContent: "space-between",
            alignItems: "center",
            flexDirection: "row",
          }}
        >
          {searchVisible && (
            <TextInput
              style={{ color: theme.text.primary, width: "60%" }}
              placeholder={t.searchMovies}
              placeholderTextColor={theme.text.muted}
              value={search}
              onChangeText={(text) => setSearch(text)}
            />
          )}
          <TouchableOpacity
            style={{
              justifyContent: "center",
              alignItems: "center",
              padding: 5,
            }}
            onPress={() => {
              setSearchVisible(!searchVisible);
            }}
          >
            <Ionicons name="search" size={24} color={theme.text.primary} />
          </TouchableOpacity>
        </View>
        <View
          style={{
            width: searchVisible ? "15%" : "70%",
            backgroundColor: theme.secondary,

            borderRadius: 15,
          }}
        >
          <Picker
            selectedValue={selectedDateTv}
            onValueChange={(itemValue) => {
              setSearchVisible(false), setSelectedDateTv(itemValue);
            }}
            style={{
              color: theme.text.primary,
              fontWeight: "bold",
              fontSize: 12,
              borderRadius: 10,

              // paddingHorizontal: 10, // iOS'ta çalışmaz
            }}
            itemStyle={{
              color: theme.text.primary,

              fontSize: 12,
              fontWeight: "bold",
            }}
            dropdownIconRippleColor={theme.secondary}
            dropdownIconColor={theme.text.secondary}
          >
            <Picker.Item
              label="Tüm Tarihler"
              value={null}
              style={{
                // backgroundColor: theme.secondary,
                fontSize: 16,
              }}
            />
            {uniqueDatesTv.map((date) => (
              <Picker.Item
                key={date}
                label={formatDate(date)}
                value={date}
                style={{
                  fontSize: 12,
                  color: theme.text.secondary,
                }}
              />
            ))}
          </Picker>
        </View>
      </View>

      <SectionList
        sections={filteredGroupedData}
        keyExtractor={(item, index) => item.id.toString() + index}
        style={{
          width: "100%",
          paddingLeft: 15,
          paddingVertical: 10,
        }}
        renderSectionHeader={({ section: { title, data } }) => {
          const uniqueGenres = [
            ...new Set(
              data.flatMap((film) => film.genres || []).filter(Boolean)
            ),
          ];
          const totalMinutes = data.reduce(
            (acc, item) =>
              acc + (item.episodeMinutes ? item.episodeMinutes : 0),
            0
          );

          return title === selectedDateTv || selectedDateTv == null ? (
            <View>
              <View
                style={{
                  paddingVertical: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderWidth: 1,
                    borderRadius: 10,
                    borderColor: theme.between,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 5,
                      backgroundColor: theme.between,
                    }}
                  />
                </View>
                <Text
                  style={{
                    width: 120,
                    paddingVertical: 3,
                    paddingHorizontal: 6,
                    borderRadius: 10,
                    color: theme.text.primary,
                    fontWeight: "bold",
                    backgroundColor: theme.secondary,
                    textAlign: "center",
                  }}
                >
                  {formatDate(title)}
                </Text>

                <Text
                  style={{
                    paddingVertical: 3,
                    paddingHorizontal: 6,
                    borderRadius: 10,
                    fontSize: 12,
                    color: theme.notesColor.yellow,
                    fontWeight: "500",
                    backgroundColor: theme.notesColor.yellowBackground,
                    textAlign: "center",
                  }}
                >
                  {totalMinutes} {t.minutes}
                </Text>

                <FlatList
                  data={uniqueGenres}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(genre, idx) => genre + idx}
                  style={{ paddingVertical: 0 }}
                  renderItem={({ item }) => (
                    <Text
                      style={{
                        paddingVertical: 3,
                        paddingHorizontal: 6,
                        borderRadius: 10,
                        fontSize: 10,
                        color: theme.text.primary,
                        fontWeight: "500",
                        backgroundColor: theme.secondary,
                        textAlign: "center",
                        marginRight: 5,
                      }}
                    >
                      {item}
                    </Text>
                  )}
                />
              </View>
              <View
                style={{
                  paddingVertical: 0,
                  paddingLeft: 10,
                }}
              >
                <View
                  style={{
                    borderLeftWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <FlatList
                    data={data}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.id.toString()}
                    style={{ marginBottom: 10, paddingHorizontal: 15 }}
                    renderItem={({ item, index }) => (
                      <Animated.View
                        style={[
                          {
                            transform: [{ scale: scaleValues[item.id] || 1 }],
                            marginRight: index === data.length - 1 ? 25 : 0, // Son öğeye ekstra margin
                          },
                        ]}
                      >
                        <TouchableOpacity
                          onPressIn={() => onPressIn(item.id)}
                          onPressOut={() => onPressOut(item.id)}
                          activeOpacity={0.8}
                          onPress={() =>
                            navigation.navigate("TvShowsDetails", {
                              id: item.showId,
                            })
                          }
                        >
                          <View
                            style={{
                              marginRight: 10,
                              marginTop: 15,
                              alignItems: "center",
                            }}
                          >
                            <Image
                              source={
                                item.showImage
                                  ? {
                                      uri: `https://image.tmdb.org/t/p/w500${item.seasonPosterPath}`,
                                    }
                                  : require("../../../assets/image/no_image.png")
                              }
                              style={styles.image}
                            />
                            <Text
                              style={{
                                color: theme.text.primary,
                                width: 100,
                                textAlign: "center",
                              }}
                            >
                              {item.episodeName}
                            </Text>
                            <Text
                              style={{
                                position: "absolute",
                                top: 2,
                                right: 2,
                                fontSize: 9,
                                fontWeight: "500",
                                backgroundColor: theme.secondaryt,
                                color: theme.text.primary,
                                paddingVertical: 2,
                                paddingHorizontal: 4,
                                borderRadius: 10,
                                textAlign: "center",
                                backgroundColor: theme.secondaryt,
                              }}
                            >
                              {item.episodeMinutes} {t.minutes}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                  />
                </View>
              </View>
            </View>
          ) : null;
        }}
        renderItem={() => null} // renderItem'ı boş bırak!
      />
    </View>
  );
};

export default TvStatisticsScreen;

const styles = StyleSheet.create({
  watchStats: {
    marginTop: 40,
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 7,
    marginHorizontal: 15,

    gap: 5,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    //borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
    elevation: 10, // Android için güçlü gölge efekti
  },
  image: {
    width: 100,
    height: 150,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.94,
    shadowRadius: 10.32,
    elevation: 5,
  },
});
