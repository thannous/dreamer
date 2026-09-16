import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isHdIllustrationsEnabled, requireHdIllustrationsEnabled } from './illustrationFlags.ts';
import { serializeImageJobError } from '../services/imageJobs.ts';

Deno.test('HD worker guard fails closed and disabled jobs are terminal', () => {
  const previous = Deno.env.get('HD_ILLUSTRATIONS_ENABLED');
  Deno.env.delete('HD_ILLUSTRATIONS_ENABLED');
  try {
    assertEquals(isHdIllustrationsEnabled(), false);
    const error = assertThrows(() => requireHdIllustrationsEnabled());
    const failure = serializeImageJobError(error);
    assertEquals(failure.errorCode, 'HD_IMAGE_DISABLED');
    assertEquals(failure.retryable, false);
    Deno.env.set('HD_ILLUSTRATIONS_ENABLED', 'true');
    requireHdIllustrationsEnabled();
    assertEquals(isHdIllustrationsEnabled(), true);
  } finally {
    if (previous === undefined) Deno.env.delete('HD_ILLUSTRATIONS_ENABLED');
    else Deno.env.set('HD_ILLUSTRATIONS_ENABLED', previous);
  }
});
