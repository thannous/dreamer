# Lucid autonomous decisions and sync v1

PR #114 introduces autonomous `sign:lucid:*` decisions. Older clients derive only Journal signs and can upload deletion tombstones for these unfamiliar IDs. They also reconcile the shared Atlas singleton against their own sources.

Until a server protocol v2 provides an isolated namespace, the client keeps autonomous sign decisions and the entire Atlas overlay local. Legacy sign decisions and compatible training entities, including observations, continue synchronizing. Local storage, account/guest merging and exports retain the autonomous data. This is a temporary loss of cross-device synchronization for these two domains, not a cloud migration.

New local-only changes do not enter the remote queue. Existing queued mutations remain quarantined with an explicit local-only reason and do not count as pending remote work or sync errors. The existing guest-import Atlas coalescence still preserves the merged local winner. Pulls ignore v1 writes and tombstones for these domains; replay rejects incompatible response entities. Explicit global resets still clear local data and queues.

An older binary installed over the same local storage can still reconcile these IDs destructively. This patch does not guarantee binary downgrade safety. Protocol v2 must isolate both reads and writes from old clients, define migration/recovery of pre-existing remote values, and validate mixed-version behavior before re-enabling synchronization.

Validation covers old-client tombstones, Atlas overwrites, queued payload preservation, bounded queue size, compatible synchronization, unexpected acknowledgement/conflict entities, guest imports and global resets.
