const fs = require('fs');
let file = 'screens/search/SearchAll.js';
let content = fs.readFileSync(file, 'utf-8');
if (content.includes('const IMAGE_URL = `https://image.tmdb.org/t/p/${imageQuality.poster}`;')) {
  content = content.replace(
    'const IMAGE_URL = `https://image.tmdb.org/t/p/${imageQuality.poster}`;',
    'const { getTmdbUrl } = useImageQualitySettings();'
  );
  content = content.replace(/import \{ useAppSettings \} from "\.\.\/\.\.\/context\/AppSettingsContext";/, 'import { useAppSettings, useImageQualitySettings } from "../../context/AppSettingsContext";');
  content = content.replace(/const \{ API_KEY, language, adultContent, imageQuality \} = useAppSettings\(\);/, 'const { API_KEY, language, adultContent } = useAppSettings();');
  content = content.replace(/`\$\{IMAGE_URL\}\$\{([^}]+)\}`/g, (match, p1) => `getTmdbUrl(${p1}, 'poster', 200)`);
  fs.writeFileSync(file, content, 'utf-8');
  console.log('Fixed SearchAll.js');
}
