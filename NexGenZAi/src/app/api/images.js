import api from './client';

export async function generateImage(prompt) {
  const { data } = await api.post('/images/generate', { prompt });
  return data.image;
}

export async function getImageHistory() {
  const { data } = await api.get('/images/history');
  return data.images;
}
