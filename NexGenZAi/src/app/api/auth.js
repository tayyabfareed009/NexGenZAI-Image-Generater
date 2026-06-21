import api from './client';

export async function syncGoogleUser() {
  const { data } = await api.post('/auth/google');
  return data.user;
}
