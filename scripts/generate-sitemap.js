#!/usr/bin/env node

/**
 * Deprecated entrypoint kept for backwards compatibility.
 * Delegate to the maintained generator so direct script calls cannot
 * accidentally emit the legacy 3-language sitemap.
 */

require('./generate-sitemap-v2');
