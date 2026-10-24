/** Small local pictograms; text labels remain the accessible source of meaning. */
const paths={
 motion:'<path d="M3 17c5 0 3-10 9-10h8m-4-4 4 4-4 4"/>',
 text:'<path d="M5 5h14M12 5v14M8 19h8M5 5v3m14-3v3"/>',
 lighting:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
 color:'<circle cx="9" cy="10" r="5"/><circle cx="15" cy="10" r="5"/><circle cx="12" cy="15" r="5"/>',
 finish:'<path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z"/>',
 detail:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
 size:'<path d="M4 10V4h6m4 16h6v-6M4 4l6 6m10 10-6-6"/>',
 depth:'<path d="m12 3 9 5-9 5-9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
 character:'<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
 focus:'<circle cx="12" cy="12" r="4"/><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
 glow:'<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="1 3"/>',
 'soft-light':'<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8" stroke-dasharray="1 3"/>',
 'balanced-light':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
 'dramatic-light':'<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none"/>'
};
export function easyIcon(name){return `<svg class="easy-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]??paths.detail}</svg>`;}
