import axios from 'axios';

const client = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

client.interceptors.response.use(
  res => res,
  err => {
    // skipAuthRedirect: oturum kontrolü (/auth/me) gibi "401 normaldir"
    // isteklerinde tam sayfa yönlendirmesi yapma.
    const skip = err.config?.skipAuthRedirect;
    if (!skip && err.response?.status === 401 && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
