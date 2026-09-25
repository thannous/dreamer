/** Horizontal touch gestures rotate the gallery; vertical gestures scroll. */
export function attachDreamDrag(stage, state, clamp) {
  let pointer = null, originX = 0, originY = 0, lastX = 0, lastY = 0;
  let touch = false, dragged = false;
  const end = () => {
    const id = pointer;
    pointer = null;
    state.dragging = false;
    stage.classList.remove('is-dragging');
    if (id !== null && stage.hasPointerCapture(id)) stage.releasePointerCapture(id);
  };
  stage.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.isPrimary === false || pointer !== null) return;
    pointer = event.pointerId;
    touch = event.pointerType === 'touch';
    originX = lastX = event.clientX;
    originY = lastY = event.clientY;
    dragged = false;
    state.velocity = 0;
  });
  stage.addEventListener('pointermove', (event) => {
    if (pointer !== event.pointerId) return;
    const totalX = event.clientX - originX;
    const totalY = event.clientY - originY;
    if (!dragged) {
      if (Math.max(Math.abs(totalX), Math.abs(totalY)) <= 6) return;
      if (touch && Math.abs(totalY) >= Math.abs(totalX)) { end(); return; }
      dragged = true;
      state.dragging = true;
      stage.setPointerCapture(pointer);
      stage.classList.add('is-dragging');
    }
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    state.velocity = dx * 0.0045;
    state.dragYaw += dx * 0.0045;
    if (!touch) state.dragPitch = clamp(state.dragPitch - dy * 0.003, -0.5, 0.5);
  });
  stage.addEventListener('pointerup', (event) => { if (pointer === event.pointerId) end(); });
  stage.addEventListener('pointercancel', (event) => {
    if (pointer !== event.pointerId) return;
    state.velocity = 0;
    end();
    dragged = false;
  });
  stage.addEventListener('lostpointercapture', end);
  stage.addEventListener('click', (event) => {
    const suppress = dragged;
    dragged = false;
    if (suppress && event.detail > 0) { event.preventDefault(); event.stopPropagation(); }
  }, true);
}
