const fs = require('fs');

const replaceInFile = (file, replacements) => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf-8');
  let original = content;
  
  replacements.forEach(({from, to}) => {
    content = content.replace(from, to);
  });

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf-8');
    console.log('Fixed', file);
  }
};

// 1. EpisodeDetails.js
replaceInFile('screens/tv/EpisodeDetails.js', [
  {
    from: /uri: `https:\/\/image\.tmdb\.org\/t\/p\/\$\{imageQuality\}\$\{person\.profile_path\}`/g,
    to: "uri: getTmdbUrl(person.profile_path, 'profile', 200)"
  }
]);

// 2. ListsViewScreen.js
replaceInFile('screens/ListsViewScreen.js', [
  {
    from: /uri: `https:\/\/image\.tmdb\.org\/t\/p\/\$\{imageQuality\?\.poster \?\? "w185"\}\$\{item\.imagePath\}`/g,
    to: "uri: getTmdbUrl(item.imagePath, 'poster', 200)"
  },
  {
    from: /const \{ imageQuality \} = useImageQualitySettings\(\);/,
    to: "const { imageQuality, getTmdbUrl } = useImageQualitySettings();"
  }
]);

// 3. CommentSheetModal.js
replaceInFile('components/CommentSheetModal.js', [
  {
    from: /uri: `https:\/\/image\.tmdb\.org\/t\/p\/\$\{imageQuality\?\.poster \|\| "w185"\}\$\{details\.poster_path\}`/g,
    to: "uri: getTmdbUrl(details.poster_path, 'poster', 200)"
  },
  {
    from: /const \{ imageQuality \} = useImageQualitySettings\(\);/,
    to: "const { imageQuality, getTmdbUrl } = useImageQualitySettings();"
  }
]);

// 4. CaseOpeningModal.js
replaceInFile('components/CaseOpeningModal.js', [
  {
    from: /const posterBase = `https:\/\/image\.tmdb\.org\/t\/p\/\$\{imageQuality\?\.poster \|\| "w185"\}`;/g,
    to: "const { getTmdbUrl } = useImageQualitySettings();"
  },
  {
    from: /uri: `\$\{posterBase\}\$\{item\.imagePath\}`/g,
    to: "uri: getTmdbUrl(item.imagePath, 'poster', 200)"
  }
]);

// 5. context/CalendarContext.js
replaceInFile('context/CalendarContext.js', [
  {
    from: /const POSTER_BASE = `https:\/\/image\.tmdb\.org\/t\/p\/\$\{imageQuality\.poster \|\| "w185"\}`;/g,
    to: "const { getTmdbUrl } = useImageQualitySettings();"
  },
  {
    from: /poster:    ep\.seasonPosterPath \? `https:\/\/image\.tmdb\.org\/t\/p\/w185\$\{ep\.seasonPosterPath\}` : null,/g,
    to: "poster: ep.seasonPosterPath ? getTmdbUrl(ep.seasonPosterPath, 'poster', 200) : null,"
  },
  {
    from: /poster: ep\.seasonPosterPath \? `\$\{POSTER_BASE\}\$\{ep\.seasonPosterPath\}` : null,/g,
    to: "poster: ep.seasonPosterPath ? getTmdbUrl(ep.seasonPosterPath, 'poster', 200) : null,"
  }
]);
