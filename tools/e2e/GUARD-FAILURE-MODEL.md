# Qualification guard controls

Written before implementation. Existing UI journeys cannot safely manufacture a
foreign build/device, an SDK teardown failure, a stale report, filesystem capture
corruption, a process signal or concurrent source edits. The Node controls cover
only those failures. They use the observed SDK0.18 report shape and public fixtures;
real native/web journeys remain the proof of successful application behaviour.

- SDK0 may carry attempt cleanup failure or secondary recording error.
- Requested media may be missing; a report-only body must not acquire a PNG gate.
- A previous/foreign report, repeated ID or changed SDK/source/target may be read.
- Artifact paths may escape output; declared size/hash may disagree with bytes.
- Invalid build/profile/device still refuses before SDK. Owner decision2026-10-06
  makes installation/hash refusal diagnostic: both checks are attempted independently
  and SDK continues, while the final application verdict stays nonqualifying.
- Source and test inputs may change while a run executes; site outputs are distinct.
- Unioning testId alone can collapse platforms; skips/exclusions must remain separate.
- A second attempt must not overwrite a prior receipt.
- Cleanup/proof persistence failure must preserve primary1/130/143 and attempt all cleanup.

Installed identity/build controls will also cover same-version different binaries,
missing Release provenance, incompatible profiles and staged/untracked app inputs.
No control opens an app, takes a device, uses a model or sends feedback.

The native concurrency profile additionally needs an isolated check: an absent,
invalid or out-of-range delay, or a delay outside persistent mock mode, must never
change normal categorization timing. Device journeys cannot safely exercise a real
provider merely to prove that opt-in boundary. This control precedes that profile.

Owner decision2026-10-06 supersedes the earlier installation/lock block. Release
this wrapper's own lock after the SDK process exits even if cleanup is unproven;
retain diagnostics and the nonqualifying verdict, never touch a foreign lock or
kill an unknown recorder. Failed build-receipt/profile/device prerequisites remain
refusals. The installation diagnostics control precedes this policy change.

- Observed Release crash: a Dreamer manifest loaded the statically inlined Lucid marker.
  The real Metro config must separate relevant variant/router/mock/story inputs, retain
  identical-input cache reuse and ignore environment order/unrelated diagnostics.
  The existing installed Metro and application Release journey provide verification.
