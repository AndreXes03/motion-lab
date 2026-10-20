// Approved editorial order. LOOP V11 uses the first (Electro) soundtrack.
export const filmOrder = ['loop', 'pulse', 'camera', 'dot'];
export const films = {
  loop: {
    name: 'LOOP', status: 'published', title: 'LOOP — Launch film',
    file: 'loop-v11-electro-1080.mp4', preview: 'loop-v11-web-preview.mp4', poster: 'loop-v11-poster.jpg',
    caption: 'From a brief to a big entrance.', alt: 'LOOP orange and graphite product in a cinematic launch film'
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
