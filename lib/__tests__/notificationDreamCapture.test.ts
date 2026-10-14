import {
  DICTATE_DREAM_ACTION_ID,
  addNotificationDreamCapture,
  parseDreamCaptureResponse,
  parseNotificationDreamInbox,
  removeNotificationDreamCaptures,
  type DreamCaptureResponseLike,
} from '../notificationDreamCapture';

const reply = (overrides: Partial<DreamCaptureResponseLike> = {}): DreamCaptureResponseLike => ({
  actionIdentifier: DICTATE_DREAM_ACTION_ID,
  userText: '  I was flying over a frozen lake  ',
  notification: { date: 1_760_000_000_000, request: { identifier: 'morning-monday' } },
  ...overrides,
});

let uuid = 0;
const options = (now: number) => ({ now, createClientRequestId: () => `uuid-${++uuid}` });

describe('notification dream capture', () => {
  it('keeps the dictated words of a dream reply and ignores other responses', () => {
    expect(parseDreamCaptureResponse(reply(), options(1))).toMatchObject({
      text: 'I was flying over a frozen lake',
      capturedAt: 1,
    });
    expect(parseDreamCaptureResponse(reply({ actionIdentifier: 'expo.modules.notifications.actions.DEFAULT' }), options(1))).toBeNull();
    expect(parseDreamCaptureResponse(reply({ userText: '   ' }), options(1))).toBeNull();
    expect(parseDreamCaptureResponse(reply({ userText: undefined }), options(1))).toBeNull();
  });

  it('saves one dream when the same reply is delivered again, even after its import', () => {
    // Live listener, last response at launch and the Android task can all carry one reply.
    const first = parseDreamCaptureResponse(reply(), options(10))!;
    const redelivered = parseDreamCaptureResponse(reply(), options(20))!;

    const once = addNotificationDreamCapture({ captures: [], seenIds: [] }, first);
    expect(once.added).toBe(true);
    expect(addNotificationDreamCapture(once.inbox, redelivered).added).toBe(false);

    const imported = removeNotificationDreamCaptures(once.inbox, [first.id]);
    expect(imported.captures).toEqual([]);
    expect(addNotificationDreamCapture(imported, redelivered).added).toBe(false);
  });

  it('treats the next morning reply to the same weekly reminder as a new dream', () => {
    const monday = parseDreamCaptureResponse(reply(), options(10))!;
    const nextMonday = parseDreamCaptureResponse(
      reply({ notification: { date: 1_760_604_800_000, request: { identifier: 'morning-monday' } } }),
      options(20)
    )!;

    const { inbox } = addNotificationDreamCapture({ captures: [], seenIds: [] }, monday);
    expect(addNotificationDreamCapture(inbox, nextMonday).added).toBe(true);
  });

  it('keeps valid replies when the stored inbox is partly corrupted', () => {
    const valid = parseDreamCaptureResponse(reply(), options(10))!;
    const stored = JSON.stringify({ captures: [valid, { id: 'x' }, null], seenIds: [valid.id, 3] });

    expect(parseNotificationDreamInbox(stored)).toEqual({ captures: [valid], seenIds: [valid.id] });
    expect(parseNotificationDreamInbox('{not json')).toEqual({ captures: [], seenIds: [] });
  });
});
