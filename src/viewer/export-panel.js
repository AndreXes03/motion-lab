import './export-panel.css';

/** Keep the existing export disclosure API while using native modal focus handling. */
export function mountExportSheet() {
  const disclosure = document.getElementById('export-settings');
  const dialog = document.getElementById('export-dialog');
  const closeButton = document.getElementById('export-settings-close');
  if (!disclosure || !dialog || !closeButton) return () => {};
  const trigger = disclosure.querySelector('summary');
  let backdropPointer = false;
  function sync() {
    if (disclosure.open && !dialog.open) {
      dialog.showModal();
      closeButton.focus({preventScroll: true});
    } else if (!disclosure.open && dialog.open) {
      dialog.close();
    }
    trigger.setAttribute('aria-expanded', String(disclosure.open));
  }
  function close() { disclosure.open = false; if (dialog.open) dialog.close(); }
  function closed() { disclosure.open = false; trigger.setAttribute('aria-expanded', 'false'); trigger.focus({preventScroll: true}); }
  function outside(event) {
    const rect = dialog.getBoundingClientRect();
    return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
  }
  function pointerDown(event) { backdropPointer = outside(event); }
  function pointerUp(event) { if (backdropPointer && outside(event)) close(); backdropPointer = false; }
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'export-dialog');
  disclosure.addEventListener('toggle', sync);
  closeButton.addEventListener('click', close);
  dialog.addEventListener('close', closed);
  dialog.addEventListener('pointerdown', pointerDown);
  dialog.addEventListener('pointerup', pointerUp);
  sync();
  return () => {
    close();
    disclosure.removeEventListener('toggle', sync);
    closeButton.removeEventListener('click', close);
    dialog.removeEventListener('close', closed);
    dialog.removeEventListener('pointerdown', pointerDown);
    dialog.removeEventListener('pointerup', pointerUp);
  };
}
