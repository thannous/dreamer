# Badge collection

Nine families earned tier by tier, and six cards earned once (43 cards): five families
grow from bronze to diamond, four stop at gold, and the chapter « First steps » holds
the cards earned the first time a gesture is made. The catalogue (`catalog.ts`) holds
the thresholds; `ledger.ts` decides what counts; the store
(`services/badgeLedgerStore.ts`) keeps it on the device, with an account backup via
`services/badgeLedgerSync.ts`; `app/collection.tsx` and `components/badges/` show it.
Card ids match Codex's artwork files (`assets/images/badges/<family-id>-v1.png`, see its
`catalogue.json`), except `night-echoes` and `dream-questions`, which wear the paintings
of the retired `favorite-echoes` and `night-thread`.

## What counts

A family never rates a dream or its feelings, and only gestures that enrich the journal
earn tiers. A gesture that can be repeated without thought earns one card, the first
time, so the dreamer discovers what it does. Months and days are distinct, never
consecutive. A tier once earned keeps its date and is never taken back, whatever happens
to the journal later. Thresholds assume about three dreams a week: bronze in the first
week, silver within a month, gold within three, platinum within six, diamond within a year.

| Family | Tiers | Counted | From |
| --- | --- | --- | --- |
| night-journal, moon-cycles | 5 | dreams and calendar months of the journal (by the dream's date, `dream.id`) | the journal, history included |
| memory-keeper | 3 | dreams the journal's « memories » filter shows (`isRememberedDream`) | the journal, history included |
| dream-reader, time-traveler | 5 | dreams given a personal note on a later local day than their own; the longest gap in days between a dream and such a note | the journal, kept once seen |
| dream-weaver | 3 | saved stories completed by hand with at least 20 more words | edit save in `app/journal/[id].tsx` |
| symbol-explorer | 5 | dictionary entries read to their end | symbol screen |
| night-scholar | 3 | guides explicitly marked completed by the reader; gold is all eight | guide screen |
| night-echoes | 3 | dreams whose share sheet opened with their card (the app cannot know whether the share was sent), or whose web share or copy succeeded | share in the journal |
| night-voice, dream-questions | once | a new dream saved after recognised speech (a Siri capture is speech), or after an answer to one of the assistant's questions; a restored draft alone is neither | save in `app/recording.tsx`, Siri import |
| treasure-keeper, dream-painter | once | a dream marked as favourite; a personal image that stayed (`imageSource === 'user'`, synced clean) | the journal, kept once seen |
| dream-seeker, observatory | once | a journal result opened under a search or any filter; Trends opened over at least one dream | `app/(tabs)/journal.tsx`, `app/(tabs)/statistics.tsx` |

Readings, stories, shares, searches and Trends were never recorded before the
collection: they count from the day it ships. A tier earned by actions is stamped with the action;
a tier earned by the journal is stamped after its changes or when the collection opens.
The ledger is per scope (`guest` or `user:<id>`). Cards belong to accounts only: a
guest's ledger keeps counting everything (actions and journal facts, deleted dreams and
favourites let go included), and the first account that opens after it receives all of it
and earns, at that moment, every tier it reaches (`claimGuestLedger`). Tiers a
first-collection guest already held stay, even where a rule changed, earned that day too.
Unreadable local ledgers are never overwritten. Signed-in accounts also merge with a private Supabase
`badge_ledgers` row. Every device unions distinct facts, preserves maxima and the
first acquisition date of each tier. An optimistic revision check prevents a late
client overwriting another device; an ambiguous acknowledgement can be replayed.
Journal identities, months and notes are retained up to each family's last threshold
(at most 150 keys, enough for the journal's diamond and the account copy's bound for version 2,
100 for version 1; past it the family's best holds the count),
so deleted dreams still contribute once. Older ledgers that stored only a maximum keep that
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
accepts only the known families of each ledger version and bounded identifiers/counts/dates.
The migration must be deployed through an explicitly authorized backend release;
local implementation/tests alone do not make account backup available in production.

## The first collection (ledger version 1)

The collection shipped on 22 October 2026 with twenty families of three tiers. It was
narrowed on 24 October 2026; a version 1 ledger, on the device or in the account copy,
is converted when read. Families kept whole (`night-journal`, `moon-cycles`,
`memory-keeper`, `night-scholar`) keep everything; families whose rule changed
(`dream-reader`, `time-traveler`, `dream-weaver`, `symbol-explorer`) keep their earned and
turned tiers while their progress starts again; a bronze of `night-voice`,
`treasure-keeper`, `dream-painter`, `dream-seeker` or `path-finder`, or `observatory`
becomes its card earned once, at the earliest date; the other families leave no card.
The device writes the converted ledger under `noctalia_badge_ledger_v2:` and never
rewrites the old key; the first current device rewrites the account copy as version 2,
which an older app cannot read and so never overwrites (the server also refuses a
version 1 write over a version 2 copy). Migration
`20261024090000_badge_ledger_v2.sql` accepts both versions.

## Presentation

The album shows one card per family, at its highest tier, grouped in five
chapters. A tier just earned waits face down until it is turned over (the
reveal is stored). The held card leans under a sideways drag. Every dress is drawn
in code around the painted medallion. Bronze is a matte copper frame; silver adds an
inner rim, a ring, a halo and a moving sheen; gold adds rays, four corner stars and a
holographic film; platinum a heavier white frame, a second rim and a nacre film;
diamond the heaviest frame, crystal facets and a prismatic film. A card earned once is
moonlit violet, with a single rim and a star above its medallion, and no tiers. A
family that holds its last tier says « Complete ». A family not earned yet shows
its illustration blurred. Reduced motion removes the lean, the turn and the
burst; text keeps its tier name, since colour alone never tells the tier.

A guest sees the album with every card still to come and one call to create a free
account, which tells how many cards already wait for it; a card's detail offers the
account instead of the family's action. The doors (Explore, Home) show no held or new
card for a guest.
