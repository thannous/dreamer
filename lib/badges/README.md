# Badge collection

Twenty families, each earned in bronze, silver and gold (60 cards). The catalogue
(`catalog.ts`) holds the thresholds; `ledger.ts` decides what counts; the store
(`services/badgeLedgerStore.ts`) keeps it on the device, with an account backup via
`services/badgeLedgerSync.ts`; `app/collection.tsx` and
`components/badges/` show it. Family ids match Codex's artwork files
(`assets/images/badges/<family-id>-v1.png`, see its `catalogue.json`).

## What counts

A family never rates a dream or its feelings. Days, weeks (Monday to Sunday) and
months are distinct, never consecutive. A tier once earned keeps its date and is
never taken back, whatever happens to the journal later.

| Family | Counted | From |
| --- | --- | --- |
| night-journal, gentle-rhythm, night-thread, moon-cycles | dreams, local days, weeks, months of the journal (by the dream's date, `dream.id`) | the journal, history included |
| memory-keeper | dreams saved as memories (`memory.origin === 'remembered'`), Lucid hand-overs excepted | the journal, history included |
| treasure-keeper | dreams marked as favourite at least once | the journal, kept once seen |
| dream-painter | personal images that stayed (`imageSource === 'user'`, synced clean); a failed upload strips them | the journal, kept once seen |
| ink-dreamer, night-voice | new dreams saved after typing only, or after recognised speech (a Siri capture is speech); a restored draft alone is neither | save in `app/recording.tsx`, Siri import |
| dream-reader, favorite-echoes, time-traveler | a dream page read for 2 s on a later local day than its saving; favourites; the longest gap in days | `app/journal/[id].tsx` |
| dream-weaver, dream-namer, night-cartographer | story, title, type or theme changed by hand, then saved; the AI's own naming never counts | edit save in `app/journal/[id].tsx` |
| dream-seeker, path-finder | days a journal result was opened under a typed search, or a filter chosen by hand (a link's preset is not) | `app/(tabs)/journal.tsx` |
| symbol-explorer | dictionary entries read for 2 s | symbol screen |
| night-scholar | guides explicitly marked completed by the reader; existing earned levels remain; gold is all eight | guide screen |
| observatory | days the dreamer changed the period, chose a theme or opened a symbol in Trends holding dreams | `app/(tabs)/statistics.tsx` |

Readings, searches and edits were never recorded before the collection: they
count from the day it ships. A tier earned by actions is stamped with the action;
a tier earned by the journal is stamped after its changes or when the collection opens.
The ledger is per scope (`guest` or `user:<id>`). A guest's actions join the first
account that opens after it; journal facts come from that account's own dreams.
Unreadable local ledgers are never overwritten. Signed-in accounts also merge with a private Supabase
`badge_ledgers` row. Every device unions distinct facts, preserves maxima and the
first acquisition date of each tier. An optimistic revision check prevents a late
client overwriting another device; an ambiguous acknowledgement can be replayed.
Journal identities/days are retained up to each family's gold threshold, so deleted
dreams still contribute once. Older ledgers that stored only a maximum keep that
maximum, but cannot reconstruct identities that were never recorded.

Cloud retry runs after local changes, on foreground/reconnection and every 30 seconds
while active. The local ledger itself is the pending state: offline or a missing
migration does not block progress. The collection shows when the account backup is
pending; it never claims local-only or mock data is backed up. The RPC binds the
expected user as well as enforcing RLS, so a changed session cannot upload A's
ledger into B's account. Confirmed account deletion cascades the server row and
removes that account's local copy after pending writes. Ordinary dream deletion
does not revoke earned cards.

Dream keys are identity aliases only (`c:`, `r:`, `l:`), never content. Neither
stories, notes, search strings nor emotion data are in the payload. The server
accepts only the twenty known families and bounded identifiers/counts/dates.
The migration must be deployed through an explicitly authorized backend release;
local implementation/tests alone do not make account backup available in production.

## Presentation

The album shows one card per family, at its highest tier, grouped in five
chapters. A tier just earned waits face down until it is turned over (the
reveal is stored). The held card leans under a sideways drag. Bronze is a matte
copper frame; silver adds an inner rim, a halo and a moving sheen; gold adds
rays, four corner stars and a holographic film. A family not earned yet shows
its illustration blurred. Reduced motion removes the lean, the turn and the
burst; text keeps its tier name, since colour alone never tells the tier.
