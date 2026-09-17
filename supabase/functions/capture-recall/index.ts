import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createApiHandler } from '../api/router.ts';
import { handleRecallQuestion } from '../api/routes/recall.ts';

// Reuse the verified user/guest guards and journal product scope. Deploying this
// small function cannot overwrite unrelated production API/image fixes.
serve(createApiHandler({ routes: new Map([['POST /recall-question', handleRecallQuestion]]) }));
