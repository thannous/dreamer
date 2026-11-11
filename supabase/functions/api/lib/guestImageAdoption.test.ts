import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { adoptGuestImages, type GuestImageStorage } from './guestImageAdoption.ts';

type Listed = { name: string; id: string | null };

function storage(listed: Listed[] | null, options: { listError?: boolean; existing?: string[] } = {}) {
  const copies: [string, string][] = [];
  const lists: string[] = [];
  const client: GuestImageStorage = {
    from: (_bucket: string) => ({
      list: async (path: string) => {
        lists.push(path);
        return { data: options.listError ? null : listed, error: options.listError ? new Error('down') : null };
      },
      copy: async (from: string, to: string) => {
        copies.push([from, to]);
        return { error: options.existing?.includes(to) ? new Error('The resource already exists') : null };
      },
    }),
  };
  return { client, copies, lists };
}

const USER = '11111111-1111-4111-8111-111111111111';
const FINGERPRINT = 'a'.repeat(64);

Deno.test('copies every picture of the guest folder into the account folder, files only', async () => {
  const { client, copies, lists } = storage([
    { name: 'one.webp', id: 'object-1' },
    { name: 'one-thumb.webp', id: 'object-2' },
    { name: 'nested', id: null },
  ]);

  assertEquals(await adoptGuestImages(client, 'dream-images', FINGERPRINT, USER), 2);
  assertEquals(lists, [`guest_${FINGERPRINT}`]);
  assertEquals(copies, [
    [`guest_${FINGERPRINT}/one.webp`, `${USER}/one.webp`],
    [`guest_${FINGERPRINT}/one-thumb.webp`, `${USER}/one-thumb.webp`],
  ]);
});

Deno.test('leaves a picture already copied as it is and still copies the others', async () => {
  const { client, copies } = storage(
    [{ name: 'one.webp', id: 'object-1' }, { name: 'two.webp', id: 'object-2' }],
    { existing: [`${USER}/one.webp`] },
  );

  assertEquals(await adoptGuestImages(client, 'dream-images', FINGERPRINT, USER), 1);
  assertEquals(copies.length, 2);
});

Deno.test('copies nothing when the folder cannot be listed or is empty', async () => {
  assertEquals(await adoptGuestImages(storage(null, { listError: true }).client, 'dream-images', FINGERPRINT, USER), 0);
  assertEquals(await adoptGuestImages(storage([]).client, 'dream-images', FINGERPRINT, USER), 0);
});

Deno.test('never reads a folder named by a fingerprint that is more than one path segment', async () => {
  for (const fingerprint of ['../other-account', `${FINGERPRINT}/..`, 'a b', '', 'short']) {
    const { client, lists, copies } = storage([{ name: 'one.webp', id: 'object-1' }]);
    assertEquals(await adoptGuestImages(client, 'dream-images', fingerprint, USER), 0);
    assertEquals(lists, []);
    assertEquals(copies, []);
  }
});
