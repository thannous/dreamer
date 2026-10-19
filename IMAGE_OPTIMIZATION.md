# Journal image loading

The current image contract lives in [lib/imageUtils.ts](lib/imageUtils.ts) and
[services/dreamMediaService.ts](services/dreamMediaService.ts).

[DreamCard](components/journal/DreamCard.tsx) resolves media through the media
service, prefers a supplied thumbnail and derives a thumbnail URL when needed.
`getDreamThumbnailUri` versions the URL using `imageUpdatedAt`,
`analysisRequestId`, `analyzedAt` or the dream ID. `withCacheBuster` preserves local
`file:` and inline `data:` sources.

`getDreamThumbnailCacheKey` keeps a supplied thumbnail's identity separate from
a thumbnail derived from the full image. The
[journal route](<app/(tabs)/journal.tsx>) uses that identity while preloading;
`preloadImage` releases the decoded image after warming the native cache. The
thumbnail utility defaults to 160 pixels and retains provider-specific URL
rewrites with the original URL as fallback.

`getImageConfig('thumbnail')` supplies the card's cache policy, priority and
transition. The [dream detail](<app/journal/[id].tsx>) and
[chat detail](<app/dream-chat/[id].tsx>) use the full-image configuration. Cached
images skip the network-load fade through `skipOnCacheHit`.

Preserve the media service's ownership checks, signed-URL lifetime and cache
identity when changing image loading. A representative check includes a list
thumbnail, opening its full image, replacing the illustration, cache reuse after
reopening and the visible fallback after a failed image load. Keep bandwidth,
memory and frame-time results tied to the measured build, fixtures and device.
