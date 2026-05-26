import { fetchMultiSource } from './src/api/phimApi.ts';
fetchMultiSource('hoat-hinh', 1).then(data => console.log('hoat-hinh items:', data.length)).catch(console.error);
fetchMultiSource('phim-moi-cap-nhat', 1).then(data => console.log('phim-moi-cap-nhat items:', data.length)).catch(console.error);
