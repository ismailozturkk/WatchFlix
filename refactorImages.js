const fs = require('fs');
const path = require('path');

// Directories to scan
const DIRS = ['./screens', './components', './modules'];

// Regex to find: `https://image.tmdb.org/t/p/${imageQuality.poster}${item.poster_path}`
// It looks like: `https://image.tmdb.org/t/p/${imageQuality.X}${Y}` or `https://image.tmdb.org/t/p/original${Y}`
const URL_REGEX = /`https:\/\/image\.tmdb\.org\/t\/p\/\$\{imageQuality\.([a-zA-Z]+)\}\$\{([^}]+)\}`/g;
const URL_REGEX_ORIGINAL = /`https:\/\/image\.tmdb\.org\/t\/p\/original\$\{([^}]+)\}`/g;
// also handle cases where they might just use string concatenation, though backticks seem most common from my grep search.

// For the third parameter to getTmdbUrl, we will guess width based on context.
// Let's just pass `200` as a safe default for lists, `1200` for backdrops.
function getWidthGuess(type) {
    if (type === 'backdrop') return 1000;
    if (type === 'profile') return 150;
    if (type === 'logo') return 150;
    return 200; // default for posters/stills
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let originalContent = content;
    let modified = false;

    // Check if it has getTmdbUrl import. If not, we might need to add it, 
    // but most files already have `useImageQualitySettings`.
    let hasGetTmdbUrl = content.includes('getTmdbUrl');

    // Replace dynamic quality ones
    content = content.replace(URL_REGEX, (match, type, pathVar) => {
        modified = true;
        // e.g. type="poster", pathVar="item.poster_path"
        return `getTmdbUrl(${pathVar}, '${type}', ${getWidthGuess(type)})`;
    });

    // Replace original ones
    // Usually original is used for backdrops or detailed posters. 
    // Let's guess 'backdrop' or 'poster' based on variable name
    content = content.replace(URL_REGEX_ORIGINAL, (match, pathVar) => {
        modified = true;
        let type = 'poster';
        if (pathVar.toLowerCase().includes('backdrop') || pathVar.toLowerCase().includes('still')) {
            type = 'backdrop';
        }
        return `getTmdbUrl(${pathVar}, '${type}', ${getWidthGuess(type)})`;
    });

    if (modified) {
        // Make sure getTmdbUrl is extracted from useImageQualitySettings
        // Look for: const { imageQuality, imageQualityLevel, changeImageQuality } = useImageQualitySettings();
        // Or just `const { imageQuality } = useImageQualitySettings();`
        const hookRegex = /const\s+\{([^}]*)\}\s*=\s*useImageQualitySettings\s*\(\s*\)\s*;/g;
        
        let hasHook = false;
        content = content.replace(hookRegex, (match, vars) => {
            hasHook = true;
            let parts = vars.split(',').map(s => s.trim());
            if (!parts.includes('getTmdbUrl')) {
                parts.push('getTmdbUrl');
            }
            return `const { ${parts.join(', ')} } = useImageQualitySettings();`;
        });

        if (!hasHook) {
            // Need to insert it if missing? But if it uses imageQuality.xxx, it must have it!
            // Wait, what if it was nested? `const { imageQuality } = useContext(...)` -> Rare.
        }

        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${filePath}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.tsx')) {
            processFile(fullPath);
        }
    }
}

DIRS.forEach(walkDir);
console.log("Refactoring complete.");
