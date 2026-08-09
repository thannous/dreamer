/* global describe, it, expect, jest */

const { exportListing, listingUrl, parseArgs } = require('./export-google-play-listing');

function response(document, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Forbidden',
    text: async () => JSON.stringify(document),
  };
}

describe('Google Play listing read-only exporter', () => {
  it('requires an existing edit id instead of creating one', () => {
    expect(() => parseArgs([])).toThrow('Le script refuse de créer un edit');
  });

  it('builds the official localized listing endpoint', () => {
    expect(
      listingUrl({
        packageName: 'com.tanuki75.noctalia',
        editId: 'existing-edit',
        language: 'fr-FR',
      })
    ).toBe(
      'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.tanuki75.noctalia/edits/existing-edit/listings/fr-FR'
    );
  });

  it('uses GET only and normalizes the listing without exposing the edit id', async () => {
    const fetchImpl = jest.fn(async (_url, options) => {
      expect(options.method).toBe('GET');
      expect(options.body).toBeUndefined();
      return response({
        language: 'fr-FR',
        title: 'Noctalia : Journal de rêves',
        shortDescription: 'Description courte',
        fullDescription: 'Description longue',
      });
    });
    const document = await exportListing(
      {
        packageName: 'com.tanuki75.noctalia',
        editId: 'secret-edit-id',
        language: 'fr-FR',
        checkedAt: '2026-08-09T00:00:00.000Z',
      },
      { accessToken: 'test-token', fetchImpl }
    );

    expect(document).toMatchObject({
      package_name: 'com.tanuki75.noctalia',
      language: 'fr-FR',
      read_only: true,
      listing: { title: 'Noctalia : Journal de rêves' },
    });
    expect(JSON.stringify(document)).not.toContain('secret-edit-id');
  });
});
