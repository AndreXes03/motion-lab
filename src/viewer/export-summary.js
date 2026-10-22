import './export-summary.css';

/** Add a human-readable delivery check to the existing export dialog. */
export function mountExportSummary({container = document.getElementById('export-dialog'), getSummary = () => ({}), onTestFrame} = {}) {
  if (!container?.append) throw new TypeError('Export summary needs a container.');
  const section = document.createElement('section');
  section.className = 'export-summary';
  section.setAttribute('aria-labelledby', 'export-summary-title');
  section.innerHTML = `<div class="export-summary-head"><div><span class="export-summary-kicker">BEFORE YOU EXPORT</span><h3 id="export-summary-title">Your delivery, at a glance</h3></div><button type="button" data-test-frame>Test frame</button></div><dl><div><dt>Duration</dt><dd data-duration>—</dd></div><div><dt>Frames</dt><dd data-frames>—</dd></div><div><dt>Audio</dt><dd data-audio>—</dd></div><div><dt>Renderer</dt><dd data-renderer>—</dd></div><div><dt>Device</dt><dd data-device>—</dd></div></dl><p class="export-summary-note" data-note aria-live="polite"></p>`;
  const fields = Object.fromEntries(['duration','frames','audio','renderer','device','note'].map(name => [name, section.querySelector(`[data-${name}]`)]));
  const testButton = section.querySelector('[data-test-frame]');
  testButton.addEventListener('click', () => { if (typeof onTestFrame === 'function') onTestFrame(); });
  if (container.id === 'export-dialog') {
    const body = container.querySelector('.export-sheet-body');
    (body ?? container.querySelector('.export-sheet-footer') ?? null)?.before(section);
    if (!body && !container.querySelector('.export-sheet-footer')) container.append(section);
  } else container.append(section);

  function refresh() {
    const summary = getSummary() ?? {};
    const duration = Number(summary.durationSeconds);
    const frameCount = Number(summary.frameCount);
    fields.duration.textContent = Number.isFinite(duration) && duration >= 0 ? `${duration.toFixed(duration % 1 ? 1 : 0)} seconds` : 'Not available';
    fields.frames.textContent = Number.isInteger(frameCount) && frameCount > 0 ? frameCount.toLocaleString() : 'Not available';
    fields.audio.textContent = typeof summary.audioIncluded === 'string' ? summary.audioIncluded : summary.audioIncluded === true ? 'Included' : summary.audioIncluded === false ? 'No audio' : 'Not confirmed';
    const renderer = summary.rendererLabel || 'Not available';
    fields.renderer.textContent = summary.rendererAvailable === true ? `${renderer} · available` : summary.rendererAvailable === false ? `${renderer} · unavailable` : `${renderer} · planned`;
    const device = summary.deviceLabel || 'Not specified';
    fields.device.textContent = summary.deviceVerified === true ? `${device} · verified` : summary.deviceVerified === false ? `${device} · unavailable` : `${device} · planned`;
    fields.note.textContent = summary.note || 'Renderer and device show the current plan. Availability reflects the latest capability check.';
    testButton.disabled = typeof onTestFrame !== 'function' || summary.testFrameAvailable === false || summary.testDisabled === true;
    testButton.title = testButton.disabled ? (summary.testFrameReason || summary.unavailableReason || 'Test frame is unavailable.') : 'Render one frame using the current recipe and export settings.';
  }
  refresh();
  return {refresh, destroy() { section.remove(); }};
}
