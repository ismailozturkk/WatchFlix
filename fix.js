const fs = require('fs');
const file = 'c:/Users/ismail/Desktop/projeler/MainProject/WhatchFlix/screens/lists/ListsViewScreen.js';
let content = fs.readFileSync(file, 'utf8');

const regex = /\/\/ ── Listeye özgü ikon ────────────────────────────────────────────────────────[\s\S]*?(?=\/\/ ── Liste kartı ──────────────────────────────────────────────────────────────)/g;

const replacement = `// ── Listeye özgü ikon ────────────────────────────────────────────────────────
const getListIcon = (listName) => {
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

// ── Listeye özgü vurgu rengi ─────────────────────────────────────────────────
const getListAccent = (listName) => {
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

// ── Kart destesi poster bileşeni ─────────────────────────────────────────────
const PosterStack = ({ items, accent, imageQuality, getTmdbUrl }) => {
  const angles = [0, -6, 6];
  const offsets = [0, -22, 22];
  const zIndexes = [3, 2, 1];

  return (
    <View style={stackStyles.container}>
      {[2, 1, 0].map((i) => {
        const item = items && items[i];
        return (
          <View
            key={i}
            style={[
              stackStyles.poster,
              {
                transform: [
                  { rotate: \`\${angles[i]}deg\` },
                  { translateX: offsets[i] },
                ],
                zIndex: zIndexes[i],
                shadowColor: accent,
              },
            ]}
          >
            {item?.imagePath ? (
              <Image
                source={{
                  uri: getTmdbUrl(item.imagePath, "poster", 200),
                }}
                style={stackStyles.posterImage}
              />
            ) : (
              <View
                style={[
                  stackStyles.posterEmpty,
                  { borderColor: accent + "40" },
                ]}
              >
                <Ionicons name="film-outline" size={20} color={accent + "80"} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
};

const stackStyles = StyleSheet.create({
  container: {
    width: "100%",
    height: CARD_H * 0.58,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  poster: {
    position: "absolute",
    width: CARD_W * 0.44,
    height: CARD_H * 0.54,
    borderRadius: 10,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  posterImage: { width: "100%", height: "100%", contentFit: "cover" },
  posterEmpty: {
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
});

`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content);
console.log('Fixed ListsViewScreen.js');
