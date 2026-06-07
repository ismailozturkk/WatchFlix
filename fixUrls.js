const fs = require('fs');

const filesToFix = [
  'screens/tabs/profile/SearchAll.js',
  'screens/tabs/profile/ActorSearch.js',
  'screens/actor/ActorViewScreen.js',
  'screens/tv/OnGoingSeries.js',
  'components/ImageGalleryModal.js',
  'screens/tabs/SettingsScreen.js'
];

filesToFix.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf-8');
  let original = content;

  // Replace `const IMAGE_URL = \`https://image.tmdb.org/t/p/${imageQuality.poster}\`;`
  // with nothing, and change imports
  if (content.includes('const IMAGE_URL = `https://image.tmdb.org/t/p/${imageQuality.poster}`;')) {
     content = content.replace(
       'const { imageQuality } = useImageQualitySettings();\n  const IMAGE_URL = `https://image.tmdb.org/t/p/${imageQuality.poster}`;',
       'const { getTmdbUrl } = useImageQualitySettings();'
     );
     // also handle ActorSearch where it uses `const IMAGE_URL ...` inside a component
     content = content.replace(
       /const IMAGE_URL = `https:\/\/image\.tmdb\.org\/t\/p\/\$\{imageQuality\.poster\}`;\n/g,
       'const { getTmdbUrl } = useImageQualitySettings();\n'
     );

     // Replace `${IMAGE_URL}${image}` with `getTmdbUrl(image, 'poster', 200)`
     content = content.replace(/\$\{IMAGE_URL\}\$\{([^}]+)\}/g, (match, p1) => {
        let type = 'poster';
        if (p1.includes('profile')) type = 'profile';
        if (p1.includes('backdrop')) type = 'backdrop';
        return `getTmdbUrl(${p1}, '${type}', 200)`;
     });

     // Replace `\`${IMAGE_URL}${...}\`` with `getTmdbUrl(...)`
     content = content.replace(/`\$\{IMAGE_URL\}\$\{([^}]+)\}`/g, (match, p1) => {
        let type = 'poster';
        if (p1.includes('profile')) type = 'profile';
        if (p1.includes('backdrop')) type = 'backdrop';
        return `getTmdbUrl(${p1}, '${type}', 200)`;
     });
  }
  
  // Replace `const TMDB_IMG = ...` in OnGoingSeries.js
  if (content.includes('const TMDB_IMG = `https://image.tmdb.org/t/p/${imageQuality.poster}`;')) {
    content = content.replace(
      'const TMDB_IMG = `https://image.tmdb.org/t/p/${imageQuality.poster}`;',
      'const { getTmdbUrl } = useImageQualitySettings();'
    );
    content = content.replace(/`\$\{TMDB_IMG\}\$\{([^}]+)\}`/g, (match, p1) => {
        return `getTmdbUrl(${p1}, 'poster', 200)`;
    });
    content = content.replace(/\$\{TMDB_IMG\}\$\{([^}]+)\}/g, (match, p1) => {
        return `getTmdbUrl(${p1}, 'poster', 200)`;
    });
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf-8');
    console.log('Fixed', file);
  }
});
