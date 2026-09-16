import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createApiHandler } from '../api/router.ts';
import { handleCreateImageJob } from '../api/routes/imageJobs.ts';

// Isolate HD admission from the production API. Shared guards validate the
// caller, product scope, subscription and durable job ownership as usual.
serve(createApiHandler({ routes: new Map([['POST /image-jobs', handleCreateImageJob]]) }));
