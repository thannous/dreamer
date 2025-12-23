const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const EXCLUDED_DIRS = ['node_modules', '.git'];

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // 1. Fix Canonicals: href="... .html" -> href="... "
    content = content.replace(/<link rel="canonical" href="(https:\/\/noctalia\.app\/[^"]+)\.html"/g, '<link rel="canonical" href="$1"');

    // 2. Fix Hreflangs: href="... .html" -> href="... "
    content = content.replace(/<link rel="alternate" hreflang="[^"]+" href="(https:\/\/noctalia\.app\/[^"]+)\.html"/g, (match, url) => {
        return match.replace('.html"', '"');
    });

    // 3. Fix Internal Links: href="....html" -> href="..."
    // This is trickier. matches href="foo.html" or href="/foo/bar.html" or href="../foo.html"
    // We want to avoid external links but the regex below catches mostly relative or absolute internal paths ending in .html
    // We exclude http/https to avoid breaking external links if any (though we targeted noctalia.app above)
    // Actually, we should only target relative links or links starting with /
    
    // Group 1: Quote ( or ')
    // Group 2: URL
    // Group 3: Quote
    content = content.replace(/href=(["'])(?!(http|https|mailto|\/\/))([^"']+)\.html(["'])/g, 'href=$1$3$4');

    // Also fix absolute links to noctalia.app
    content = content.replace(/href=(["'])https:\/\/noctalia\.app\/([^"']+)\.html(["'])/g, 'href=$1https://noctalia.app/$2$3');

    // 4. Fix OpenGraph URLs: remove .html from og:url
    content = content.replace(/<meta property="og:url" content="(https:\/\/noctalia\.app\/[^"]+)\.html"/g, '<meta property="og:url" content="$1"');

    // 5. Fix JSON-LD and other absolute URLs pointing to .html
    content = content.replace(/https:\/\/noctalia\.app\/([^"\\]+)\.html/g, 'https://noctalia.app/$1');

    // 6. Fix meta refresh redirects to clean paths
    content = content.replace(/(http-equiv="refresh" content="[^"]*url=\/[^"]+)\.html"/gi, '$1"');

    if (content !== originalContent) {
        console.log(`Updating ${filePath}`);
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            if (!EXCLUDED_DIRS.includes(file)) {
                walk(fullPath);
            }
        } else if (file.endsWith('.html')) {
            processFile(fullPath);
        }
    }
}

console.log('Starting Clean URLs fix...');
walk(DOCS_DIR);
console.log('Done.');
