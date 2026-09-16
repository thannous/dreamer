import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { encodeBase64, decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { prepareIllustrationForStorage } from './imagePipeline.ts';

Deno.test('HD storage preserves the generated 4K bytes while standard keeps its lightweight image', async () => {
  const source = new Image(2304, 4096).fill(0x24324aff);
  const image = { base64: encodeBase64(await source.encode()), contentType: 'image/png' };
  const hd = await prepareIllustrationForStorage(image, '4K');
  assertEquals(hd, image);
  const decodedHd = await Image.decode(decodeBase64(hd.base64));
  assertEquals(decodedHd.height, 4096);
  const standard = await prepareIllustrationForStorage(image, '1K');
  const decodedStandard = await Image.decode(decodeBase64(standard.base64));
  assertEquals(decodedStandard.height, 1024);
});
