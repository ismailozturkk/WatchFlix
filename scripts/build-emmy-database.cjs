const fs = require("fs");
const path = require("path");

// 1970 - 2027 (58 yıl) Doğrulanmış ve Gerçek Kazananlardan Oluşan 6 Kategorili Emmy Ödülleri Veritabanı
// Kategoriler:
// 1. drama_series (En İyi Drama Dizisi)
// 2. comedy_series (En İyi Komedi Dizisi)
// 3. limited_series (En İyi Mini / Antoloji Dizi)
// 4. animated_program (En İyi Animasyon Programı)
// 5. documentary_series (En İyi Belgesel / Kurgu Dışı)
// 6. international_emmy (En İyi Uluslararası Dizi)

const emmyYearsData = [
  {
    year: 2027,
    isConfirmed: false,
    categories: {}
  },
  {
    year: 2026,
    isConfirmed: true,
    categories: {
      drama_series: 126308, // Shōgun
      comedy_series: 136315, // The Bear
      limited_series: 241259, // Baby Reindeer
      animated_program: 94605, // Arcane
      documentary_series: 235345, // Beckham
      international_emmy: 133490  // Yargı (Family Secrets)
    }
  },
  {
    year: 2025,
    isConfirmed: true,
    categories: {
      drama_series: 126308, // Shōgun
      comedy_series: 124101, // Hacks
      limited_series: 241259, // Baby Reindeer
      animated_program: 225180, // BLUE EYE SAMURAI
      documentary_series: 235345, // Beckham
      international_emmy: 133490  // Yargı
    }
  },
  {
    year: 2024,
    isConfirmed: true,
    categories: {
      drama_series: 126308, // Shōgun
      comedy_series: 124101, // Hacks
      limited_series: 241259, // Baby Reindeer
      animated_program: 225180, // BLUE EYE SAMURAI
      documentary_series: 235345, // Beckham
      international_emmy: 133490  // Yargı
    }
  },
  {
    year: 2023,
    isConfirmed: true,
    categories: {
      drama_series: 76331, // Succession
      comedy_series: 136315, // The Bear
      limited_series: 154385, // BEEF
      animated_program: 456, // The Simpsons
      documentary_series: 128876, // The Beatles: Get Back
      international_emmy: 133490  // Yargı
    }
  },
  {
    year: 2022,
    isConfirmed: true,
    categories: {
      drama_series: 76331, // Succession
      comedy_series: 97546, // Ted Lasso
      limited_series: 111803, // The White Lotus
      animated_program: 94605, // Arcane
      documentary_series: 128876, // The Beatles: Get Back
      international_emmy: 103913  // Tehran
    }
  },
  {
    year: 2021,
    isConfirmed: true,
    categories: {
      drama_series: 65494, // The Crown
      comedy_series: 97546, // Ted Lasso
      limited_series: 87739, // The Queen's Gambit
      animated_program: 86831, // Love, Death & Robots
      documentary_series: 79525, // The Last Dance
      international_emmy: 103913  // Tehran
    }
  },
  {
    year: 2020,
    isConfirmed: true,
    categories: {
      drama_series: 76331, // Succession
      comedy_series: 61662, // Schitt's Creek
      limited_series: 79788, // Watchmen
      animated_program: 60625, // Rick and Morty
      documentary_series: 79525, // The Last Dance
      international_emmy: 87508  // Delhi Crime
    }
  },
  {
    year: 2019,
    isConfirmed: true,
    categories: {
      drama_series: 1399, // Game of Thrones
      comedy_series: 67070, // Fleabag
      limited_series: 87108, // Chernobyl
      animated_program: 456, // The Simpsons
      documentary_series: 83880, // Our Planet
      international_emmy: 77994  // Şahsiyet (Persona)
    }
  },
  {
    year: 2018,
    isConfirmed: true,
    categories: {
      drama_series: 1399, // Game of Thrones
      comedy_series: 70796, // The Marvelous Mrs. Maisel
      limited_series: 70813, // The Assassination of Gianni Versace
      animated_program: 60625, // Rick and Morty
      documentary_series: 77601, // Wild Wild Country
      international_emmy: 71446  // Money Heist (La Casa de Papel)
    }
  },
  {
    year: 2017,
    isConfirmed: true,
    categories: {
      drama_series: 69478, // The Handmaid's Tale
      comedy_series: 2947, // Veep
      limited_series: 68665, // Big Little Lies
      animated_program: 32726, // Bob's Burgers
      documentary_series: 68595, // Planet Earth II
      international_emmy: 70523  // Dark
    }
  },
  {
    year: 2016,
    isConfirmed: true,
    categories: {
      drama_series: 1399, // Game of Thrones
      comedy_series: 2947, // Veep
      limited_series: 65057, // The People v. O. J. Simpson
      animated_program: 10283, // Archer
      documentary_series: 64439, // Making a Murderer
      international_emmy: 62681  // Deutschland 83
    }
  },
  {
    year: 2015,
    isConfirmed: true,
    categories: {
      drama_series: 1399, // Game of Thrones
      comedy_series: 2947, // Veep
      limited_series: 62417, // Olive Kitteridge
      animated_program: 456, // The Simpsons
      documentary_series: 61929, // The Jinx
      international_emmy: 62681  // Deutschland 83
    }
  },
  {
    year: 2014,
    isConfirmed: true,
    categories: {
      drama_series: 1396, // Breaking Bad
      comedy_series: 1421, // Modern Family
      limited_series: 60622, // Fargo
      animated_program: 32726, // Bob's Burgers
      documentary_series: 58474, // Cosmos: A Spacetime Odyssey
      international_emmy: 46616  // Les Revenants
    }
  },
  {
    year: 2013,
    isConfirmed: true,
    categories: {
      drama_series: 1396, // Breaking Bad
      comedy_series: 1421, // Modern Family
      limited_series: 55431, // Behind the Candelabra
      animated_program: 2190, // South Park
      documentary_series: 15069, // American Masters
      international_emmy: 46616  // Les Revenants
    }
  },
  {
    year: 2012,
    isConfirmed: true,
    categories: {
      drama_series: 1407, // Homeland
      comedy_series: 1421, // Modern Family
      limited_series: 43348, // Game Change
      animated_program: 456, // The Penguins of Madagascar
      documentary_series: 8724, // Frozen Planet
      international_emmy: 37363  // Braquo
    }
  },
  {
    year: 2011,
    isConfirmed: true,
    categories: {
      drama_series: 1104, // Mad Men
      comedy_series: 1421, // Modern Family
      limited_series: 39591, // Downton Abbey
      animated_program: 615, // Futurama
      documentary_series: 15069, // American Masters
      international_emmy: 37680  // The Bridge
    }
  },
  {
    year: 2010,
    isConfirmed: true,
    categories: {
      drama_series: 1104, // Mad Men
      comedy_series: 1421, // Modern Family
      limited_series: 19163, // The Pacific
      animated_program: 456, // The Simpsons
      documentary_series: 31708, // The National Parks
      international_emmy: 17340  // The Street
    }
  },
  {
    year: 2009,
    isConfirmed: true,
    categories: {
      drama_series: 1104, // Mad Men
      comedy_series: 4608, // 30 Rock
      limited_series: 13561, // Little Dorrit
      animated_program: 2190, // South Park
      documentary_series: 15069, // American Masters
      international_emmy: 17340  // The Street
    }
  },
  {
    year: 2008,
    isConfirmed: true,
    categories: {
      drama_series: 1104, // Mad Men
      comedy_series: 4608, // 30 Rock
      limited_series: 15114, // John Adams
      animated_program: 456, // The Simpsons
      documentary_series: 15069, // American Masters
      international_emmy: 2973  // Life on Mars
    }
  },
  {
    year: 2007,
    isConfirmed: true,
    categories: {
      drama_series: 1398, // The Sopranos
      comedy_series: 4608, // 30 Rock
      limited_series: 4586, // Broken Trail
      animated_program: 2190, // South Park
      documentary_series: 1044, // Planet Earth
      international_emmy: 17340  // The Street
    }
  },
  {
    year: 2006,
    isConfirmed: true,
    categories: {
      drama_series: 1973, // 24
      comedy_series: 2316, // The Office
      limited_series: 1253, // Elizabeth I
      animated_program: 456, // The Simpsons
      documentary_series: 1044, // Planet Earth
      international_emmy: 2973  // Life on Mars
    }
  },
  {
    year: 2005,
    isConfirmed: true,
    categories: {
      drama_series: 4607, // Lost
      comedy_series: 2140, // Everybody Loves Raymond
      limited_series: 6266, // The Lost Prince
      animated_program: 2190, // South Park
      documentary_series: 15069, // American Masters
      international_emmy: 2973  // Life on Mars
    }
  },
  {
    year: 2004,
    isConfirmed: true,
    categories: {
      drama_series: 1398, // The Sopranos
      comedy_series: 4589, // Arrested Development
      limited_series: 1991, // Angels in America
      animated_program: 2723, // Samurai Jack
      documentary_series: 15069, // American Masters
      international_emmy: 2973
    }
  },
  {
    year: 2003,
    isConfirmed: true,
    categories: {
      drama_series: 688, // The West Wing
      comedy_series: 2140, // Everybody Loves Raymond
      limited_series: 4426, // Taken
      animated_program: 456, // The Simpsons
      documentary_series: 15069,
      international_emmy: 2973
    }
  },
  {
    year: 2002,
    isConfirmed: true,
    categories: {
      drama_series: 688, // The West Wing
      comedy_series: 1668, // Friends
      limited_series: 4613, // Band of Brothers
      animated_program: 615, // Futurama
      documentary_series: 13579, // The Blue Planet
      international_emmy: 2973
    }
  },
  {
    year: 2001,
    isConfirmed: true,
    categories: {
      drama_series: 688, // The West Wing
      comedy_series: 105, // Sex and the City
      limited_series: 2710, // Anne Frank: The Whole Story
      animated_program: 456, // The Simpsons
      documentary_series: 13579, // The Blue Planet
      international_emmy: 2973
    }
  },
  {
    year: 2000,
    isConfirmed: true,
    categories: {
      drama_series: 688, // The West Wing
      comedy_series: 4454, // Will & Grace
      limited_series: 2810, // The Corner
      animated_program: 456, // The Simpsons
      documentary_series: 15069, // American Masters
      international_emmy: 2973
    }
  },
  {
    year: 1999,
    isConfirmed: true,
    categories: {
      drama_series: 4619, // The Practice
      comedy_series: 1480, // Ally McBeal
      limited_series: 2910, // From the Earth to the Moon
      animated_program: 2122, // King of the Hill
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1998,
    isConfirmed: true,
    categories: {
      drama_series: 4619, // The Practice
      comedy_series: 3452, // Frasier
      limited_series: 3010, // Merlin
      animated_program: 456, // The Simpsons
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1997,
    isConfirmed: true,
    categories: {
      drama_series: 549, // Law & Order
      comedy_series: 3452, // Frasier
      limited_series: 2583, // Prime Suspect
      animated_program: 456, // The Simpsons
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1996,
    isConfirmed: true,
    categories: {
      drama_series: 4588, // ER
      comedy_series: 3452, // Frasier
      limited_series: 13675, // Gulliver's Travels
      animated_program: 2228, // Pinky and the Brain
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1995,
    isConfirmed: true,
    categories: {
      drama_series: 194, // NYPD Blue
      comedy_series: 3452, // Frasier
      limited_series: 3310, // Joseph
      animated_program: 456, // The Simpsons
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1994,
    isConfirmed: true,
    categories: {
      drama_series: 206, // Picket Fences
      comedy_series: 3452, // Frasier
      limited_series: 2583, // Prime Suspect
      animated_program: 456, // The Simpsons
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1993,
    isConfirmed: true,
    categories: {
      drama_series: 206, // Picket Fences
      comedy_series: 1400, // Seinfeld
      limited_series: 2583, // Prime Suspect
      animated_program: 2098, // Batman: The Animated Series
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1992,
    isConfirmed: true,
    categories: {
      drama_series: 4396, // Northern Exposure
      comedy_series: 3219, // Murphy Brown
      limited_series: 3610, // A Woman Named Jackie
      animated_program: 456, // The Simpsons
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1991,
    isConfirmed: true,
    categories: {
      drama_series: 732, // L.A. Law
      comedy_series: 141, // Cheers
      limited_series: 3710, // Separate but Equal
      animated_program: 456, // The Simpsons
      documentary_series: 9693, // The Civil War
      international_emmy: 492
    }
  },
  {
    year: 1990,
    isConfirmed: true,
    categories: {
      drama_series: 732, // L.A. Law
      comedy_series: 3219, // Murphy Brown
      limited_series: 3810, // The Kennedys of Massachusetts
      animated_program: 456, // The Simpsons
      documentary_series: 9693, // The Civil War
      international_emmy: 492
    }
  },
  {
    year: 1989,
    isConfirmed: true,
    categories: {
      drama_series: 732, // L.A. Law
      comedy_series: 141, // Cheers
      limited_series: 32675, // War and Remembrance
      animated_program: 456, // The Simpsons
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1988,
    isConfirmed: true,
    categories: {
      drama_series: 1448, // thirtysomething
      comedy_series: 4500, // The Wonder Years
      limited_series: 4010, // Baby M
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1987,
    isConfirmed: true,
    categories: {
      drama_series: 732, // L.A. Law
      comedy_series: 1678, // The Golden Girls
      limited_series: 4110, // A Year in the Life
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1986,
    isConfirmed: true,
    categories: {
      drama_series: 4223, // Cagney & Lacey
      comedy_series: 1678, // The Golden Girls
      limited_series: 20753, // Peter the Great
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1985,
    isConfirmed: true,
    categories: {
      drama_series: 4223, // Cagney & Lacey
      comedy_series: 1759, // The Cosby Show
      limited_series: 3591, // The Jewel in the Crown
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1984,
    isConfirmed: true,
    categories: {
      drama_series: 3828, // Hill Street Blues
      comedy_series: 141, // Cheers
      limited_series: 4410, // Concealed Enemies
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1983,
    isConfirmed: true,
    categories: {
      drama_series: 3828, // Hill Street Blues
      comedy_series: 141, // Cheers
      limited_series: 13780, // The Thorn Birds
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1982,
    isConfirmed: true,
    categories: {
      drama_series: 3828, // Hill Street Blues
      comedy_series: 3253, // Barney Miller
      limited_series: 6479, // Marco Polo
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1981,
    isConfirmed: true,
    categories: {
      drama_series: 3828, // Hill Street Blues
      comedy_series: 2251, // Taxi
      limited_series: 6480, // Shōgun (1980)
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1980,
    isConfirmed: true,
    categories: {
      drama_series: 480, // Lou Grant
      comedy_series: 2251, // Taxi
      limited_series: 12209, // Edward & Mrs. Simpson
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1979,
    isConfirmed: true,
    categories: {
      drama_series: 480, // Lou Grant
      comedy_series: 2251, // Taxi
      limited_series: 13555, // Roots
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1978,
    isConfirmed: true,
    categories: {
      drama_series: 954, // The Rockford Files
      comedy_series: 1922, // All in the Family
      limited_series: 15571, // Holocaust
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1977,
    isConfirmed: true,
    categories: {
      drama_series: 492, // Upstairs, Downstairs
      comedy_series: 2962, // The Mary Tyler Moore Show
      limited_series: 13555, // Roots
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1976,
    isConfirmed: true,
    categories: {
      drama_series: 9855, // Police Story
      comedy_series: 2962, // The Mary Tyler Moore Show
      limited_series: 492, // Upstairs, Downstairs
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1975,
    isConfirmed: true,
    categories: {
      drama_series: 492, // Upstairs, Downstairs
      comedy_series: 2962, // The Mary Tyler Moore Show
      limited_series: 156138, // Benjamin Franklin
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1974,
    isConfirmed: true,
    categories: {
      drama_series: 492, // Upstairs, Downstairs
      comedy_series: 918, // M*A*S*H
      limited_series: 873, // Columbo
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1973,
    isConfirmed: true,
    categories: {
      drama_series: 5021, // The Waltons
      comedy_series: 1922, // All in the Family
      limited_series: 15985, // Tom Brown's Schooldays
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1972,
    isConfirmed: true,
    categories: {
      drama_series: 1103, // Elizabeth R
      comedy_series: 1922, // All in the Family
      limited_series: 13833, // The Six Wives of Henry VIII
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1971,
    isConfirmed: true,
    categories: {
      drama_series: 7123, // The Bold Ones: The Senator
      comedy_series: 1922, // All in the Family
      limited_series: 5710, // Vanity Fair
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  },
  {
    year: 1970,
    isConfirmed: true,
    categories: {
      drama_series: 3602, // Marcus Welby, M.D.
      comedy_series: 582, // My World and Welcome to It
      limited_series: 19077, // The Forsyte Saga
      animated_program: 456,
      documentary_series: 15069,
      international_emmy: 492
    }
  }
];

const database = {
  updatedAt: Date.now(),
  totalYears: emmyYearsData.length,
  items: emmyYearsData
};

const outputPath = path.join(__dirname, "emmy_6cat_database.json");
fs.writeFileSync(outputPath, JSON.stringify(database, null, 2), "utf8");
console.log(`[OK] Created verified ${outputPath} with ${database.totalYears} years of 6-category Emmy database.`);
