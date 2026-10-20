const axios = require("axios");

// TMDB "API Read Access Token" depoda tutulmaz: calistirmadan once ortam degiskeni olarak ver.
//   PowerShell:  $env:TMDB_READ_TOKEN = "..."
if (!process.env.TMDB_READ_TOKEN) {
  console.error("TMDB_READ_TOKEN ortam degiskeni gerekli.");
  process.exit(1);
}
const token = "Bearer " + process.env.TMDB_READ_TOKEN;

async function searchTv(name) {
  try {
    const res = await axios.get("https://api.themoviedb.org/3/search/tv", {
      params: { query: name, language: "en-US" },
      headers: { Authorization: token },
    });
    return res.data.results?.[0];
  } catch (e) {
    return null;
  }
}

async function run() {
  const queries = [
    "Love, Death & Robots",
    "Pinky and the Brain",
    "King of the Hill",
    "Todd McFarlane's Spawn",
    "American Masters",
    "Frozen Planet",
    "The National Parks",
    "The War",
    "The Blue Planet",
    "The Bridge",
    "Dark",
    "Lupin",
    "Squid Game",
    "The Forsyte Saga",
    "The Six Wives of Henry VIII",
    "Tom Brown's Schooldays",
    "Benjamin Franklin",
    "Edward & Mrs. Simpson",
    "Marco Polo",
    "The Thorn Birds",
    "The Jewel in the Crown",
    "Peter the Great",
    "War and Remembrance",
    "Little Dorrit",
    "Gulliver's Travels",
    "Prime Suspect"
  ];

  for (const q of queries) {
    const show = await searchTv(q);
    if (show) {
      console.log(`"${q}" => ID: ${show.id}, Name: "${show.name}", Air: ${show.first_air_date}`);
    } else {
      console.log(`NOT FOUND: ${q}`);
    }
  }
}

run();
