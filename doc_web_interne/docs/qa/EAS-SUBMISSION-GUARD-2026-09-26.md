# EAS internal submission idempotence — 2026-09-26

## Failure model and coverage gap

A previously accepted Android AAB (versionCode 69) was submitted a second time on
2026-09-17. The first EAS submission finished; the second failed with
SUBMISSION_SERVICE_ANDROID_OLD_VERSION_CODE_ERROR because Play had already accepted
that version. The current submit-internal wrapper validates the EAS build,
app, version and track, but does not look for prior submissions of that build.

The guard must stop a repeat of the same build ID after a successful EAS
submission, including when the successful submission used another Play track.
It must also stop a second submission while the same build is queued or running.
An ERRORED or CANCELED submission can be retried. A different build or platform
must not be blocked. If EAS authentication, the query or its response fails,
the wrapper must stop before contacting the store.

An actual duplicate store submission would recreate the incident, so the
verification uses a read-only EAS lookup and a dry run against an already
submitted build, plus isolated pagination/failure tests. These checks cannot
rule out a race between two separate machines starting a submission at exactly
the same time. The store remains the final authority.

## Other observed release failures

- Android 3.4.5 code 80 failed in CONFIGURE_EXPO_UPDATES with generated
  masked-view Android output in the fingerprint. Code 81 of the same source
  commit subsequently finished. The existing check-eas-build-inputs guard
  rejects native build outputs before another EAS build starts.
- Two iOS uploads of build 9 failed with Apple 90683. Current release checks
  verify the required HealthKit purpose strings before building/submitting.
- EAS Android 3.4.5 code 81 and iOS build 11 were subsequently submitted
  successfully for internal testing.

## Lookup design after review

The first draft queried FINISHED and each active status separately. Review found
a transition gap: a submission could become FINISHED after that query and before
the IN_PROGRESS query, then disappear from both result sets. The final lookup
paginates one platform-wide submission list and checks status locally. The
read-only production lookup returned 56 Android submissions over two pages and
still found the prior successful build. The observed list order followed
creation time, but the internal GraphQL API does not promise a stable sort.
