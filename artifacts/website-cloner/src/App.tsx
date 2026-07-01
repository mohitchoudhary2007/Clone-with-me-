import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { setBaseUrl } from '@workspace/api-client-react';
import Home from '@/pages/Home';
import Admin from '@/pages/Admin';
import NotFound from '@/pages/not-found';
import { seedAdminAuthIfNeeded, seedAppConfigIfNeeded } from '@/lib/firebase';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    // Run seeding lazily to avoid offline errors on initial sync
    const initDb = async () => {
      try {
        await Promise.all([
          seedAdminAuthIfNeeded(),
          seedAppConfigIfNeeded()
        ]);
      } catch (e) {
        console.warn('Lazy Firebase initialization status:', e);
      }
    };
    
    // Give browser a split second to stabilize connection state
    const timer = setTimeout(initDb, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>
      <Toaster theme="dark" position="top-center" toastOptions={{ className: 'font-mono' }} />
    </QueryClientProvider>
  );
}

export default App;