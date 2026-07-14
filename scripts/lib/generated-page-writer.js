const fs = require('fs');

function materializeGeneratedPage({
  filePath,
  renderedHtml,
  finalizeHtml = (html) => html,
  dryRun = false,
  fileSystem = fs,
}) {
  const html = finalizeHtml(renderedHtml);
  const currentHtml = fileSystem.existsSync(filePath)
    ? fileSystem.readFileSync(filePath, 'utf8')
    : null;
  const changed = currentHtml !== html;

  if (changed && !dryRun) {
    fileSystem.writeFileSync(filePath, html, 'utf8');
  }

  return { changed, html };
}

module.exports = { materializeGeneratedPage };
