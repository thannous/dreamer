import { addNotificationDreamCapture, removeNotificationDreamCaptures } from '../notificationDreamCapture';
import { NOTE_DREAM_INTENT, parseSiriDreamInvocation, type SiriDreamInvocationLike } from '../siriDreamCapture';

const invocation = (overrides: Partial<SiriDreamInvocationLike> = {}): SiriDreamInvocationLike => ({
  id: '6F9619FF-8B86-D011-B42D-00C04FC964FF',
  name: NOTE_DREAM_INTENT,
  params: { text: '  A tide of feathers under the bridge  ' },
  createdAt: 1_760_000_000_000,
  ...overrides,
});

let uuid = 0;
const options = (now: number) => ({ now, createClientRequestId: () => `uuid-${++uuid}` });

describe('Siri dream capture', () => {
  it('dates the dream when it was told to Siri, not when the app picks it up', () => {
    expect(parseSiriDreamInvocation(invocation(), options(1_760_000_900_000))).toMatchObject({
      text: 'A tide of feathers under the bridge',
      capturedAt: 1_760_000_000_000,
    });
    expect(parseSiriDreamInvocation(invocation({ params: { text: '   ' } }), options(1))).toBeNull();
  });

  it('saves one dream when the same invocation is delivered again, even after its import', () => {
    // The app can stop between keeping the dream and leaving Siri's queue.
    const first = parseSiriDreamInvocation(invocation(), options(10))!;
    const replay = parseSiriDreamInvocation(invocation(), options(20))!;
    // Same key for the journal too, once the inbox has forgotten an old import.
    expect(replay.clientRequestId).toBe('6f9619ff-8b86-d011-b42d-00c04fc964ff');
    expect(replay.clientRequestId).toBe(first.clientRequestId);

    const once = addNotificationDreamCapture({ captures: [], seenIds: [] }, first);
    expect(once.added).toBe(true);
    expect(addNotificationDreamCapture(once.inbox, replay).added).toBe(false);

    const imported = removeNotificationDreamCaptures(once.inbox, [first.id]);
    expect(addNotificationDreamCapture(imported, replay).added).toBe(false);
  });
});
