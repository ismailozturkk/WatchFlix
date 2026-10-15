const axios = require('axios');
const fs = require('fs');

// TMDB "API Read Access Token" depoda tutulmaz: calistirmadan once ortam degiskeni olarak ver.
//   PowerShell:  $env:TMDB_READ_TOKEN = "..."
if (!process.env.TMDB_READ_TOKEN) {
  console.error("TMDB_READ_TOKEN ortam degiskeni gerekli.");
  process.exit(1);
}
const API_KEY = 'Bearer ' + process.env.TMDB_READ_TOKEN;

// Yıllara göre 6 dalda Oscar kazanan filmlerin isimleri (ve gerekirse yapım yılı)
const OSCAR_WINNERS_RAW = {
  2026: {
    best_picture: "Oppenheimer", // Not: 2026 Oscar (98.) veya 2025/2026
    best_international_feature: "The Zone of Interest",
    best_animated_feature: "The Boy and the Heron",
    best_visual_effects: "Godzilla Minus One",
    best_documentary_feature: "20 Days in Mariupol",
    best_cinematography: "Oppenheimer"
  },
  2025: {
    best_picture: "Anora",
    best_international_feature: "I'm Still Here",
    best_animated_feature: "Flow",
    best_visual_effects: "Dune: Part Two",
    best_documentary_feature: "No Other Land",
    best_cinematography: "Dune: Part Two"
  },
  2024: {
    best_picture: "Oppenheimer",
    best_international_feature: "The Zone of Interest",
    best_animated_feature: "The Boy and the Heron",
    best_visual_effects: "Godzilla Minus One",
    best_documentary_feature: "20 Days in Mariupol",
    best_cinematography: "Oppenheimer"
  },
  2023: {
    best_picture: "Everything Everywhere All at Once",
    best_international_feature: "All Quiet on the Western Front",
    best_animated_feature: "Guillermo del Toro's Pinocchio",
    best_visual_effects: "Avatar: The Way of Water",
    best_documentary_feature: "Navalny",
    best_cinematography: "All Quiet on the Western Front"
  },
  2022: {
    best_picture: "CODA",
    best_international_feature: "Drive My Car",
    best_animated_feature: "Encanto",
    best_visual_effects: "Dune",
    best_documentary_feature: "Summer of Soul",
    best_cinematography: "Dune"
  },
  2021: {
    best_picture: "Nomadland",
    best_international_feature: "Another Round",
    best_animated_feature: "Soul",
    best_visual_effects: "Tenet",
    best_documentary_feature: "My Octopus Teacher",
    best_cinematography: "Mank"
  },
  2020: {
    best_picture: "Parasite",
    best_international_feature: "Parasite",
    best_animated_feature: "Toy Story 4",
    best_visual_effects: "1917",
    best_documentary_feature: "American Factory",
    best_cinematography: "1917"
  },
  2019: {
    best_picture: "Green Book",
    best_international_feature: "Roma",
    best_animated_feature: "Spider-Man: Into the Spider-Verse",
    best_visual_effects: "First Man",
    best_documentary_feature: "Free Solo",
    best_cinematography: "Roma"
  },
  2018: {
    best_picture: "The Shape of Water",
    best_international_feature: "A Fantastic Woman",
    best_animated_feature: "Coco",
    best_visual_effects: "Blade Runner 2049",
    best_documentary_feature: "Icarus",
    best_cinematography: "Blade Runner 2049"
  },
  2017: {
    best_picture: "Moonlight",
    best_international_feature: "The Salesman",
    best_animated_feature: "Zootopia",
    best_visual_effects: "The Jungle Book",
    best_documentary_feature: "O.J.: Made in America",
    best_cinematography: "La La Land"
  },
  2016: {
    best_picture: "Spotlight",
    best_international_feature: "Son of Saul",
    best_animated_feature: "Inside Out",
    best_visual_effects: "Ex Machina",
    best_documentary_feature: "Amy",
    best_cinematography: "The Revenant"
  },
  2015: {
    best_picture: "Birdman",
    best_international_feature: "Ida",
    best_animated_feature: "Big Hero 6",
    best_visual_effects: "Interstellar",
    best_documentary_feature: "Citizenfour",
    best_cinematography: "Birdman"
  },
  2014: {
    best_picture: "12 Years a Slave",
    best_international_feature: "The Great Beauty",
    best_animated_feature: "Frozen",
    best_visual_effects: "Gravity",
    best_documentary_feature: "20 Feet from Stardom",
    best_cinematography: "Gravity"
  },
  2013: {
    best_picture: "Argo",
    best_international_feature: "Amour",
    best_animated_feature: "Brave",
    best_visual_effects: "Life of Pi",
    best_documentary_feature: "Searching for Sugar Man",
    best_cinematography: "Life of Pi"
  },
  2012: {
    best_picture: "The Artist",
    best_international_feature: "A Separation",
    best_animated_feature: "Rango",
    best_visual_effects: "Hugo",
    best_documentary_feature: "Undefeated",
    best_cinematography: "Hugo"
  },
  2011: {
    best_picture: "The King's Speech",
    best_international_feature: "In a Better World",
    best_animated_feature: "Toy Story 3",
    best_visual_effects: "Inception",
    best_documentary_feature: "Inside Job",
    best_cinematography: "Inception"
  },
  2010: {
    best_picture: "The Hurt Locker",
    best_international_feature: "The Secret in Their Eyes",
    best_animated_feature: "Up",
    best_visual_effects: "Avatar",
    best_documentary_feature: "The Cove",
    best_cinematography: "Avatar"
  },
  2009: {
    best_picture: "Slumdog Millionaire",
    best_international_feature: "Departures",
    best_animated_feature: "WALL-E",
    best_visual_effects: "The Curious Case of Benjamin Button",
    best_documentary_feature: "Man on Wire",
    best_cinematography: "Slumdog Millionaire"
  },
  2008: {
    best_picture: "No Country for Old Men",
    best_international_feature: "The Counterfeiters",
    best_animated_feature: "Ratatouille",
    best_visual_effects: "The Golden Compass",
    best_documentary_feature: "Taxi to the Dark Side",
    best_cinematography: "There Will Be Blood"
  },
  2007: {
    best_picture: "The Departed",
    best_international_feature: "The Lives of Others",
    best_animated_feature: "Happy Feet",
    best_visual_effects: "Pirates of the Caribbean: Dead Man's Chest",
    best_documentary_feature: "An Inconvenient Truth",
    best_cinematography: "Pan's Labyrinth"
  },
  2006: {
    best_picture: "Crash",
    best_international_feature: "Tsotsi",
    best_animated_feature: "Wallace & Gromit: The Curse of the Were-Rabbit",
    best_visual_effects: "King Kong",
    best_documentary_feature: "March of the Penguins",
    best_cinematography: "Memoirs of a Geisha"
  },
  2005: {
    best_picture: "Million Dollar Baby",
    best_international_feature: "The Sea Inside",
    best_animated_feature: "The Incredibles",
    best_visual_effects: "Spider-Man 2",
    best_documentary_feature: "Born into Brothels",
    best_cinematography: "The Aviator"
  },
  2004: {
    best_picture: "The Lord of the Rings: The Return of the King",
    best_international_feature: "The Barbarian Invasions",
    best_animated_feature: "Finding Nemo",
    best_visual_effects: "The Lord of the Rings: The Return of the King",
    best_documentary_feature: "The Fog of War",
    best_cinematography: "Master and Commander: The Far Side of the World"
  },
  2003: {
    best_picture: "Chicago",
    best_international_feature: "Nowhere in Africa",
    best_animated_feature: "Spirited Away",
    best_visual_effects: "The Lord of the Rings: The Two Towers",
    best_documentary_feature: "Bowling for Columbine",
    best_cinematography: "Road to Perdition"
  },
  2002: {
    best_picture: "A Beautiful Mind",
    best_international_feature: "No Man's Land",
    best_animated_feature: "Shrek",
    best_visual_effects: "The Lord of the Rings: The Fellowship of the Ring",
    best_documentary_feature: "Murder on a Sunday Morning",
    best_cinematography: "The Lord of the Rings: The Fellowship of the Ring"
  },
  2001: {
    best_picture: "Gladiator",
    best_international_feature: "Crouching Tiger, Hidden Dragon",
    best_visual_effects: "Gladiator",
    best_documentary_feature: "Into the Arms of Strangers",
    best_cinematography: "Crouching Tiger, Hidden Dragon"
  },
  2000: {
    best_picture: "American Beauty",
    best_international_feature: "All About My Mother",
    best_visual_effects: "The Matrix",
    best_documentary_feature: "One Day in September",
    best_cinematography: "American Beauty"
  },
  1999: {
    best_picture: "Shakespeare in Love",
    best_international_feature: "Life Is Beautiful",
    best_visual_effects: "What Dreams May Come",
    best_documentary_feature: "The Last Days",
    best_cinematography: "Saving Private Ryan"
  },
  1998: {
    best_picture: "Titanic",
    best_international_feature: "Character",
    best_visual_effects: "Titanic",
    best_documentary_feature: "4 Little Girls",
    best_cinematography: "Titanic"
  },
  1997: {
    best_picture: "The English Patient",
    best_international_feature: "Kolya",
    best_visual_effects: "Independence Day",
    best_documentary_feature: "When We Were Kings",
    best_cinematography: "The English Patient"
  },
  1996: {
    best_picture: "Braveheart",
    best_international_feature: "Antonia's Line",
    best_visual_effects: "Babe",
    best_documentary_feature: "Anne Frank Remembered",
    best_cinematography: "Braveheart"
  },
  1995: {
    best_picture: "Forrest Gump",
    best_international_feature: "Burnt by the Sun",
    best_visual_effects: "Forrest Gump",
    best_documentary_feature: "Maya Lin: A Strong Clear Vision",
    best_cinematography: "Legends of the Fall"
  },
  1994: {
    best_picture: "Schindler's List",
    best_international_feature: "Belle Époque",
    best_visual_effects: "Jurassic Park",
    best_documentary_feature: "I Am a Promise",
    best_cinematography: "Schindler's List"
  },
  1993: {
    best_picture: "Unforgiven",
    best_international_feature: "Indochine",
    best_visual_effects: "Death Becomes Her",
    best_documentary_feature: "The Panama Deception",
    best_cinematography: "A River Runs Through It"
  },
  1992: {
    best_picture: "The Silence of the Lambs",
    best_international_feature: "Mediterraneo",
    best_visual_effects: "Terminator 2: Judgment Day",
    best_documentary_feature: "In the Shadow of the Stars",
    best_cinematography: "JFK"
  },
  1991: {
    best_picture: "Dances with Wolves",
    best_international_feature: "Journey of Hope",
    best_visual_effects: "Total Recall",
    best_documentary_feature: "American Dream",
    best_cinematography: "Dances with Wolves"
  },
  1990: {
    best_picture: "Driving Miss Daisy",
    best_international_feature: "Cinema Paradiso",
    best_visual_effects: "The Abyss",
    best_documentary_feature: "Common Threads: Stories from the Quilt",
    best_cinematography: "Glory"
  },
  1989: {
    best_picture: "Rain Man",
    best_international_feature: "Pelle the Conqueror",
    best_visual_effects: "Who Framed Roger Rabbit",
    best_documentary_feature: "Hotel Terminus",
    best_cinematography: "Mississippi Burning"
  },
  1988: {
    best_picture: "The Last Emperor",
    best_international_feature: "Babette's Feast",
    best_visual_effects: "Innerspace",
    best_documentary_feature: "The Ten-Year Lunch",
    best_cinematography: "The Last Emperor"
  },
  1987: {
    best_picture: "Platoon",
    best_international_feature: "The Assault",
    best_visual_effects: "Aliens",
    best_documentary_feature: "Artie Shaw: Time Is All You've Got",
    best_cinematography: "The Mission"
  },
  1986: {
    best_picture: "Out of Africa",
    best_international_feature: "The Official Story",
    best_visual_effects: "Cocoon",
    best_documentary_feature: "Broken Rainbow",
    best_cinematography: "Out of Africa"
  },
  1985: {
    best_picture: "Amadeus",
    best_international_feature: "Dangerous Moves",
    best_visual_effects: "Indiana Jones and the Temple of Doom",
    best_documentary_feature: "The Times of Harvey Milk",
    best_cinematography: "The Killing Fields"
  },
  1984: {
    best_picture: "Terms of Endearment",
    best_international_feature: "Fanny and Alexander",
    best_visual_effects: "Return of the Jedi",
    best_documentary_feature: "He Makes Me Feel Like Dancin'",
    best_cinematography: "Fanny and Alexander"
  },
  1983: {
    best_picture: "Gandhi",
    best_international_feature: "Volver a Empezar",
    best_visual_effects: "E.T. the Extra-Terrestrial",
    best_documentary_feature: "Just Another Missing Kid",
    best_cinematography: "Gandhi"
  },
  1982: {
    best_picture: "Chariots of Fire",
    best_international_feature: "Mephisto",
    best_visual_effects: "Raiders of the Lost Ark",
    best_documentary_feature: "Genocide",
    best_cinematography: "Reds"
  },
  1981: {
    best_picture: "Ordinary People",
    best_international_feature: "Moscow Does Not Believe in Tears",
    best_visual_effects: "The Empire Strikes Back",
    best_documentary_feature: "From Mao to Mozart: Isaac Stern in China",
    best_cinematography: "Tess"
  },
  1980: {
    best_picture: "Kramer vs. Kramer",
    best_international_feature: "The Tin Drum",
    best_visual_effects: "Alien",
    best_documentary_feature: "Best Boy",
    best_cinematography: "Apocalypse Now"
  },
  1979: {
    best_picture: "The Deer Hunter",
    best_international_feature: "Get Out Your Handkerchiefs",
    best_visual_effects: "Superman",
    best_documentary_feature: "Scared Straight!",
    best_cinematography: "Days of Heaven"
  },
  1978: {
    best_picture: "Annie Hall",
    best_international_feature: "Madame Rosa",
    best_visual_effects: "Star Wars",
    best_documentary_feature: "The Whoopee Boys",
    best_cinematography: "Close Encounters of the Third Kind"
  },
  1977: {
    best_picture: "Rocky",
    best_international_feature: "Black and White in Color",
    best_visual_effects: "King Kong",
    best_documentary_feature: "Harlan County, USA",
    best_cinematography: "Bound for Glory"
  },
  1976: {
    best_picture: "One Flew Over the Cuckoo's Nest",
    best_international_feature: "Dersu Uzala",
    best_visual_effects: "The Hindenburg",
    best_documentary_feature: "The Man Who Skied Down Everest",
    best_cinematography: "Barry Lyndon"
  },
  1975: {
    best_picture: "The Godfather Part II",
    best_international_feature: "Amarcord",
    best_visual_effects: "Earthquake",
    best_documentary_feature: "Hearts and Minds",
    best_cinematography: "The Towering Inferno"
  },
  1974: {
    best_picture: "The Sting",
    best_international_feature: "Day for Night",
    best_visual_effects: "The Exorcist",
    best_documentary_feature: "The Great American Cowboy",
    best_cinematography: "Cries and Whispers"
  },
  1973: {
    best_picture: "The Godfather",
    best_international_feature: "The Discreet Charm of the Bourgeoisie",
    best_visual_effects: "The Poseidon Adventure",
    best_documentary_feature: "Marjoe",
    best_cinematography: "Cabaret"
  },
  1972: {
    best_picture: "The French Connection",
    best_international_feature: "The Garden of the Finzi-Continis",
    best_visual_effects: "Bedknobs and Broomsticks",
    best_documentary_feature: "The Hellstrom Chronicle",
    best_cinematography: "Fiddler on the Roof"
  },
  1971: {
    best_picture: "Patton",
    best_international_feature: "Investigation of a Citizen Above Suspicion",
    best_visual_effects: "Tora! Tora! Tora!",
    best_documentary_feature: "Woodstock",
    best_cinematography: "Ryan's Daughter"
  },
  1970: {
    best_picture: "Midnight Cowboy",
    best_international_feature: "Z",
    best_visual_effects: "Marooned",
    best_documentary_feature: "Arthur Rubinstein – The Love of Life",
    best_cinematography: "Butch Cassidy and the Sundance Kid"
  }
};

async function searchTMDB(title) {
  if (!title) return null;
  try {
    const res = await axios.get('https://api.themoviedb.org/3/search/movie', {
      headers: { Authorization: API_KEY },
      params: { query: title }
    });
    const first = res.data.results?.[0];
    return first ? { tmdbId: first.id, title: first.title, poster_path: first.poster_path } : null;
  } catch (e) {
    console.error('Search error for:', title, e.message);
    return null;
  }
}

async function buildDatabase() {
  console.log('Building Oscar 6-Category database from TMDB...');
  const years = Object.keys(OSCAR_WINNERS_RAW).map(Number).sort((a, b) => b - a);
  const items = [];

  // 2027 Placeholder
  items.push({
    year: 2027,
    isConfirmed: false,
    categories: {}
  });

  for (const year of years) {
    const raw = OSCAR_WINNERS_RAW[year];
    const categories = {};

    for (const [catKey, title] of Object.entries(raw)) {
      if (!title) continue;
      const found = await searchTMDB(title);
      if (found?.tmdbId) {
        categories[catKey] = found.tmdbId;
      } else {
        console.warn(`[WARN] Not found: Year ${year}, Category ${catKey}, Title "${title}"`);
      }
    }

    items.push({
      year,
      isConfirmed: true,
      categories
    });
    console.log(`[OK] Year ${year} resolved (${Object.keys(categories).length} categories)`);
  }

  const result = {
    updatedAt: Date.now(),
    totalYears: items.length,
    items
  };

  fs.writeFileSync('scripts/oscar_6cat_database.json', JSON.stringify(result, null, 2));
  console.log('\n[SUCCESS] Wrote scripts/oscar_6cat_database.json successfully!');
}

buildDatabase();
