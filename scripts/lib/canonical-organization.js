const { siteConfig } = require('./docs-site-config');

function canonicalOrganization(overrides = {}) {
  const organizationId = `${siteConfig.domain}/#organization`;
  const sameAs = (siteConfig.socialLinks || [])
    .map((link) => link?.url)
    .filter(Boolean);
  const address = siteConfig.organization.address;

  return {
    ...overrides,
    '@type': 'Organization',
    '@id': organizationId,
    name: siteConfig.organization.name,
    legalName: siteConfig.organization.legalName,
    taxID: siteConfig.organization.taxID,
    url: siteConfig.organization.url,
    logo: {
      ...(overrides.logo || {}),
      '@type': 'ImageObject',
      url: siteConfig.organization.logoUrl,
    },
    brand: {
      '@type': 'Brand',
      name: siteConfig.organization.name,
    },
    ...(address
      ? {
          address: {
            '@type': 'PostalAddress',
            ...address,
          },
        }
      : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

function normalizeCanonicalOrganization(blocks) {
  const organizationId = `${siteConfig.domain}/#organization`;
  const canonicalName = siteConfig.organization.name;

  function visit(node) {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== 'object') return;

    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    const isCanonicalOrganization =
      types.includes('Organization') &&
      (node['@id'] === organizationId || node.name === canonicalName);

    if (isCanonicalOrganization) {
      Object.assign(node, canonicalOrganization(node));
    }

    for (const value of Object.values(node)) visit(value);
  }

  return (Array.isArray(blocks) ? blocks : []).map((block) => {
    const parsed =
      typeof block === 'string' ? JSON.parse(block.trim()) : JSON.parse(JSON.stringify(block));
    visit(parsed);
    return parsed;
  });
}

module.exports = {
  canonicalOrganization,
  normalizeCanonicalOrganization,
};
