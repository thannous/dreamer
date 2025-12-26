const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Sharp is not installed. Please run: npm install -D sharp');
  process.exit(1);
}

const DOCS_DIR = path.join(__dirname, '../docs');
const IMG_DIR = path.join(DOCS_DIR, 'img/blog');

// Ensure image directory exists
if (!fs.existsSync(IMG_DIR)) {
  fs.mkdirSync(IMG_DIR, { recursive: true });
}

function findBlogArticleFiles() {
  const langs = ['fr', 'en', 'es'];
  const out = [];
  for (const lang of langs) {
    const dir = path.join(DOCS_DIR, lang, 'blog');
    if (!fs.existsSync(dir)) continue;
    
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (!entry.endsWith('.html')) continue;
      if (entry === 'index.html') continue;
      out.push(path.join(lang, 'blog', entry));
    }
  }
  return out.sort();
}

async function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

function getOptimizedFilename(slug) {
  return `${slug}.webp`;
}

async function processFile(relPath) {
  const absPath = path.join(DOCS_DIR, relPath);
  let content = fs.readFileSync(absPath, 'utf8');
  const slug = path.basename(relPath, '.html');
  
  // Find unsplash images
  // Regex to capture src and alt. 
  // Looks for <img ... src="https://images.unsplash.com..." ... >
  // Note: HTML attributes order varies.
  
  const imgRegex = /<img\s+[^>]*src=["'](https:\/\/images\.unsplash\.com\/[^"']+)["'][^>]*>/gi;
  let match;
  let modified = false;

  // We use a loop with manual replacement or string manipulation because we need async operations.
  // Actually, string.replace(regex, callback) doesn't support async.
  // So we'll gather all matches first.
  
  const matches = [];
  while ((match = imgRegex.exec(content)) !== null) {
    matches.push({
      fullTag: match[0],
      url: match[1],
      index: match.index
    });
  }

  if (matches.length === 0) return false;

  console.log(`Processing ${relPath} (${matches.length} images)...`);

  for (const item of matches) {
    const tempFile = path.join(IMG_DIR, `temp_${slug}_${Date.now()}.jpg`);
    const finalFile = path.join(IMG_DIR, getOptimizedFilename(slug));
    
    // Only process if we haven't already (or optimized file doesn't exist)
    // For simplicity, we assume one main image per blog post usually.
    // If there are multiple, we might overwrite. 
    // BUT the audit suggests main featured images.
    // Let's assume unique slugs or append index if multiple.
    
    // Reuse existing if possible?
    if (fs.existsSync(finalFile)) {
        // console.log(`  Skipping download, ${finalFile} exists.`);
    } else {
        try {
            // console.log(`  Downloading ${item.url}...`);
            await downloadImage(item.url, tempFile);
            
            // Convert to webp
            await sharp(tempFile)
                .resize(1200, 630, { fit: 'cover', position: 'center' }) // OG standard size
                .webp({ quality: 80 })
                .toFile(finalFile);
                
            fs.unlinkSync(tempFile);
            console.log(`  Optimized to ${path.basename(finalFile)}`);
        } catch (e) {
            console.error(`  Error processing image for ${slug}:`, e.message);
            continue; // Skip replacement if failed
        }
    }

    // Replace in content
    // We need to be careful about replacement content.
    // We only want to replace the src attribute.
    // Or replace the whole tag? 
    // The current tag might have width/height/loading.
    // Let's just string replace the URL.
    
    // Calculate relative path from the html file to the image folder.
    // HTML is in docs/{lang}/blog/
    // Img is in docs/img/blog/
    // Path: ../../img/blog/{filename}
    
    const relativePath = `../../img/blog/${getOptimizedFilename(slug)}`;
    
    // Check if we need to adjust the width/height attributes or extension in the tag
    // Ideally we update the src.
    
    const newTag = item.fullTag.replace(item.url, relativePath);
    content = content.replace(item.fullTag, newTag);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(absPath, content, 'utf8');
  }
  
  return modified;
}

async function main() {
  const files = findBlogArticleFiles();
  let count = 0;
  
  for (const file of files) {
    try {
        const changed = await processFile(file);
        if (changed) count++;
    } catch (e) {
        console.error(`Failed to process ${file}`, e);
    }
  }
  
  console.log(`Finished. Updated ${count} files.`);
}

main();
