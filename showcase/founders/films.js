// Editorial order: LOOP leads once the user approves its finished export.
// No LOOP media is loaded, linked or published while its release is pending.
export const filmOrder = ['loop', 'pulse', 'camera', 'dot'];
export const films = {
  loop: {
    name: 'LOOP', status: 'awaiting-user-approval',
    title: 'LOOP — Launch film', file: null, preview: null, poster: null
  },
  pulse: {
    name: 'PULSE', status: 'published', title: 'PULSE — Product film',
    file: 'pulse-1080.mp4', preview: 'pulse-web-preview.mp4', poster: 'pulse-poster.jpg',
    caption: 'Make the product the event.', alt: 'Colorful sculptural sound objects in PULSE'
  },
  camera: {
    name: 'CAMERA', status: 'published', title: 'CAMERA — Product film',
    file: 'camera-1080.mp4', preview: 'camera-1080.mp4', poster: 'camera-poster.jpg',
    caption: 'Give the details their moment.', alt: 'A cinematic camera product close-up'
  },
  dot: {
    name: 'DOT', status: 'published', title: 'DOT — Character film',
    file: 'dot-1080.mp4', preview: 'dot-1080.mp4', poster: 'dot-poster.jpg',
    caption: 'Bring a little personality.', alt: 'Expressive pixel characters from DOT'
  }
};
export const publishedFilms = filmOrder.filter(id => {
  const film = films[id];
  return film.status === 'published' && film.file && film.preview && film.poster;
});
