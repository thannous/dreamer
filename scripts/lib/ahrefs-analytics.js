const AHREFS_ANALYTICS_KEY = 'qDwc7i0RM0aLBY/cZLkOxA';
const AHREFS_ANALYTICS_SRC = 'https://analytics.ahrefs.com/analytics.js';

function renderAhrefsAnalyticsScript(indent = '    ') {
  return [
    `${indent}<script`,
    `${indent}  src="${AHREFS_ANALYTICS_SRC}"`,
    `${indent}  data-key="${AHREFS_ANALYTICS_KEY}"`,
    `${indent}  async`,
    `${indent}></script>`,
  ].join('\n');
}

module.exports = {
  AHREFS_ANALYTICS_KEY,
  AHREFS_ANALYTICS_SRC,
  renderAhrefsAnalyticsScript,
};
