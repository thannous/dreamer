import { randomUUID } from 'node:crypto';
import { expect } from 'e2e';
import { test, nativeLogin, nativeSignOut, nativeJournal, nativeCapture, nativeSave, nativeTap, nativeTranscript } from '../native-backend-fixtures';

const options = { platforms: ['ios', 'android'], tags: ['native-real-backend'], timeout: 360_000 };

test('Dreamer native offline creation and edit survive process restart and synchronize exactly once',
  { ...options, tags: [...options.tags, 'native-real-sync'] }, async (fixtures) => {
    const { app, screen, device, platform, backend } = fixtures;
    await nativeLogin(fixtures);
    await nativeCapture(screen);
    const story = `Moon train ${randomUUID().slice(0, 8)} crosses a quiet lake.`;
    const revision = `${story} The door is blue.`;
    const blockedBefore = (await backend.transportState()).blocked;
    await backend.setOnline(false);
    try {
      await nativeSave(fixtures, story);
      const before = await backend.owner.from('dreams').select('id');
      expect(before.error).toBeNull();
      expect(before.data).toEqual([]);
      const edit = screen.getByTestId('btn.editDream', { visible: true });
      await screen.scrollUntilVisible(edit);
      if (platform === 'ios') {
        // Native visibility does not establish that the fixed dock leaves the
        // edit control uncovered. Measure before choosing a single scroll.
        const dock = screen.getByTestId('component.dreamDetail.actionDock', { visible: true });
        const geometry = async () => {
          const button = await edit.boundingBox();
          const hasDock = await dock.count();
          const overlay = hasDock ? await dock.boundingBox() : null;
          if (!button || (hasDock && !overlay)) throw new Error('Offline edit geometry is unavailable.');
          const covered = !!overlay && button.x < overlay.x + overlay.width
            && button.x + button.width > overlay.x && button.y < overlay.y + overlay.height
            && button.y + button.height > overlay.y;
          return { button, overlay, covered };
        };
        const beforeScroll = await geometry();
        console.info('[native-offline-edit-geometry]', JSON.stringify({ stage: 'before', ...beforeScroll }));
        if (beforeScroll.covered) {
          await screen.swipe({ direction: 'down', momentum: 'slow' });
          const afterScroll = await geometry();
          console.info('[native-offline-edit-geometry]', JSON.stringify({ stage: 'after', ...afterScroll }));
          if (afterScroll.covered) throw new Error('The fixed dock still covers Edit after one native scroll.');
        }
      }
      await expect(edit).toBeEnabled();
      await edit.tap();
      await expect(screen.getByTestId('component.dreamEditor', { visible: true })).toBeVisible();
      const editorInput = screen.getByTestId('input.dreamTranscript', { visible: true });
      await expect(editorInput).toBeEnabled();
      await editorInput.fill(revision);
      if (platform === 'ios') await screen.getByTestId('btn.journal.dismissKeyboard', { visible: true }).tap();
      else await device.dismissKeyboard();
      await nativeTap(screen, 'btn.saveDreamEdit');
      await nativeTranscript(screen, revision);
      await app.restart();
      await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
      await nativeJournal(screen);
      const cards = screen.getByTestId(/^dream\.item\./, { visible: true });
      await expect(cards).toHaveCount(1);
      await cards.first().tap();
      await nativeTranscript(screen, revision);
      await expect.poll(async () => (await backend.transportState()).blocked).toBeGreaterThan(blockedBefore);
      expect((await backend.owner.from('dreams').select('id')).data).toEqual([]);
    } finally { await backend.setOnline(true); }
    // A process restart exercises durable queue replay after connectivity returns.
    await app.restart();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await expect.poll(async () => {
      const result = await backend.owner.from('dreams').select('transcript');
      expect(result.error).toBeNull();
      return result.data?.map(row => row.transcript);
    }, { timeout: 60_000 }).toEqual([revision]);
    const first = await backend.owner.from('dreams').select('id,client_request_id').single();
    expect(first.error).toBeNull();
    expect(first.data!.client_request_id).toBeTruthy();
    await app.restart();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await nativeJournal(screen);
    const cards = screen.getByTestId(/^dream\.item\./, { visible: true });
    await expect(cards).toHaveCount(1);
    await cards.first().tap();
    await nativeTranscript(screen, revision);
    const after = await backend.owner.from('dreams').select('id,client_request_id,transcript');
    expect(after.error).toBeNull();
    expect(after.data).toEqual([{ ...first.data!, transcript: revision }]);
  });

test('Dreamer native guest dream and draft survive real sign-in, reconnect and account isolation',
  { ...options, tags: [...options.tags, 'native-real-account'] }, async (fixtures) => {
    const { app, screen, device, platform, backend } = fixtures;
    const marker = randomUUID().slice(0, 8);
    const story = `Guest lighthouse ${marker} over the sea.`;
    const draft = `Draft garden ${marker} behind a blue door.`;
    await nativeSave(fixtures, story);
    await nativeCapture(screen);
    await screen.getByTestId('input.dreamTranscript', { visible: true }).fill(draft);
    await device.dismissKeyboard();
    // Leave capture normally: its lifecycle flush makes the draft durable before Auth changes.
    await nativeLogin(fixtures);
    await expect.poll(async () => {
      const result = await backend.owner.from('dreams').select('transcript');
      expect(result.error).toBeNull();
      return result.data?.map(row => row.transcript);
    }).toEqual([story]);
    await nativeCapture(screen);
    await expect(screen.getByTestId('input.dreamTranscript', { visible: true })).toHaveValue(draft);
    await app.restart();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await expect(screen.getByTestId('input.dreamTranscript', { visible: true })).toHaveValue(draft);
    await nativeSave(fixtures, draft);
    await expect.poll(async () => {
      const result = await backend.owner.from('dreams').select('transcript');
      expect(result.error).toBeNull();
      return result.data?.map(row => row.transcript).sort();
    }).toEqual([story, draft].sort());
    const ids = await backend.owner.from('dreams').select('id').order('id');
    expect(ids.error).toBeNull();
    expect(ids.data).toHaveLength(2);
    await nativeSignOut(fixtures);
    await nativeJournal(screen);
    await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(0);
    await nativeLogin(fixtures, 'other');
    await nativeJournal(screen);
    await expect(screen.getByTestId(/^dream\.item\./, { visible: true })).toHaveCount(0);
    const foreign = await backend.other.from('dreams').select('id').in('id', ids.data!.map(row => row.id));
    expect(foreign.error).toBeNull();
    expect(foreign.data).toEqual([]);
    await nativeSignOut(fixtures);
    await nativeLogin(fixtures);
    await app.restart();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await nativeJournal(screen);
    for (const transcript of [story, draft]) {
      await nativeJournal(screen);
      const search = screen.getByTestId('input.searchDreams', { visible: true });
      await search.fill(transcript);
      // Filtering needs no submission. iOS can open the matching card while the
      // keyboard is visible (the list uses keyboardShouldPersistTaps=handled).
      if (platform === 'android') await device.dismissKeyboard();
      await expect(search).toHaveValue(transcript);
      const cards = screen.getByTestId(/^dream\.item\./, { visible: true });
      await expect(cards).toHaveCount(1);
      await cards.first().tap();
      await nativeTranscript(screen, transcript);
    }
    const after = await backend.owner.from('dreams').select('id,transcript').order('id');
    expect(after.error).toBeNull();
    expect(after.data?.map(row => row.id)).toEqual(ids.data!.map(row => row.id));
    expect(after.data?.map(row => row.transcript).sort()).toEqual([story, draft].sort());
    // Restart directly after verifying both restored dreams: the saved draft
    // must not resurrect. Returning to Journal can refocus its iOS search field
    // and hide the tabs, which is unrelated to this durable-draft assertion.
    await app.restart();
    await expect(screen.getByTestId('screen.recording', { visible: true })).toBeVisible();
    await expect(screen.getByTestId('input.dreamTranscript', { visible: true })).toHaveValue('');
  });
