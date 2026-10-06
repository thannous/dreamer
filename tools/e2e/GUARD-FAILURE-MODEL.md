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
- An installation refusal or installed hash mismatch must launch zero SDK tests.
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
