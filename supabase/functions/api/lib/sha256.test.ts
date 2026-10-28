import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { sha256Hex } from './sha256.ts';

Deno.test('sha256Hex keeps the lowercase hex form of stored hashes', async () => {
  assertEquals(await sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assertEquals(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  // UTF-8 bytes, not UTF-16 code units: accented dream text hashes like the database does.
  assertEquals(await sha256Hex('rêve'), '4dad7032c63cf6448d7210cb863b86126ed943b411d23611e6e18b1851b0b67f');
});
