const fs = require('fs');
const path = require('path');
const DIRS = ['./screens', './components', './modules'];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('getTmdbUrl') && !content.includes('useImageQualitySettings')) {
        console.log("Missing hook:", filePath);
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
console.log("Check complete.");
