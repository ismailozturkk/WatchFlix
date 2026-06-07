const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf-8');
  let original = content;
  if (content.includes('const IMAGE_URL = `https://image.tmdb.org/t/p/${imageQuality.poster}`;')) {
    content = content.replace(
      'const IMAGE_URL = `https://image.tmdb.org/t/p/${imageQuality.poster}`;',
      'const { getTmdbUrl } = useImageQualitySettings();'
    );
    // Remove duplicate getTmdbUrl from earlier failed replaces if any
    content = content.replace(
      'const { imageQuality } = useImageQualitySettings();\n  const { getTmdbUrl } = useImageQualitySettings();',
      'const { imageQuality, getTmdbUrl } = useImageQualitySettings();'
    );
    
    // Replace URL usages:
    content = content.replace(/`\$\{IMAGE_URL\}\$\{([^}]+)\}`/g, (match, p1) => `getTmdbUrl(${p1}, 'poster', 200)`);
  }
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf-8');
    console.log('Fixed ' + file);
  }
}

fixFile('screens/tabs/profile/SearchAll.js');
fixFile('screens/tabs/profile/ActorSearch.js');
