import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import App from './App.jsx';
import ToastHost, { toast } from './components/ui/Toast.jsx';
import './index.css';

function describeError(error) {
  return error?.response?.data?.error || error?.message || 'Unknown error';
}

// 401'de api/client.js zaten /login'e yönlendiriyor; ayrıca bildirim göstermeyelim.
const isAuthError = (error) => error?.response?.status === 401;

// Hatalar eskiden sessizce yutuluyordu: bir işlem başarısız olduğunda kullanıcı
// hiçbir şey görmüyordu. Tek noktadan yakalayıp bildirime çeviriyoruz — her
// bileşene tek tek onError yazmaya gerek kalmıyor.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 2000 } },
  queryCache: new QueryCache({
    onError: (error) => {
      if (isAuthError(error)) return;
      toast.error(describeError(error), 'Could not load data');
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      if (isAuthError(error)) return;
      toast.error(describeError(error), 'Action failed');
    },
  }),
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <ToastHost />
  </QueryClientProvider>
);
