'use strict';

function parseRedirectRules(source) {
  return String(source || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const [from, to, status = '302'] = line.split(/\s+/);
      return { from, to, status };
    });
}

function validateCloudflarePagesRedirects(source) {
  const errors = [];

  for (const rule of parseRedirectRules(source)) {
    if (!rule.from?.startsWith('/')) {
      errors.push(
        `unsupported domain-level redirect source "${rule.from}"; configure host/protocol redirects in Cloudflare zone or account rules`
      );
    }
  }

  return errors;
}

module.exports = {
  parseRedirectRules,
  validateCloudflarePagesRedirects,
};
