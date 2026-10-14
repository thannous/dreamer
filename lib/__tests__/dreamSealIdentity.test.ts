import { keepsDreamName, markDreamNamed } from '../dreamNaming';
import { getDreamStoryHandoffName, hasDreamStoryHandoff, markDreamStoryHandoff } from '../dreamStoryPrologue';

// Synchronization can give a signed-in dream its remote id while the capture seal plays.
// The name it wrote and the window it handed over must still be found for that dream.
describe('the seal keeps track of its dream across remote-id promotion', () => {
  const sealed = { id: 501, remoteId: undefined, clientRequestId: 'seal-client-501' };
  const promoted = { ...sealed, remoteId: 9501 };

  it('keeps the name the seal wrote', () => {
    markDreamNamed(sealed);
    expect(keepsDreamName(promoted)).toBe(true);
    expect(keepsDreamName({ id: 502, remoteId: 9502, clientRequestId: 'another-dream' })).toBe(false);
  });

  it('hands the window and the written name over to the promoted dream', () => {
    const now = 1_000;
    markDreamStoryHandoff(sealed, { title: 'The bell under the sea', provisional: false }, now);
    expect(hasDreamStoryHandoff(promoted, now + 1)).toBe(true);
    expect(getDreamStoryHandoffName(promoted, now + 1)?.title).toBe('The bell under the sea');
    expect(hasDreamStoryHandoff({ id: 503, remoteId: 9503, clientRequestId: 'another-dream' }, now + 1)).toBe(false);
  });
});
