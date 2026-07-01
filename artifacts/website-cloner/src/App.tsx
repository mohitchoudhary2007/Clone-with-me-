import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { setBaseUrl } from '@workspace/api-client-react';
import Home from '@/pages/Home';
import Admin from '@/pages/Admin';
import NotFound from '@/pages/not-found';
import { seedAdminAuthIfNeeded, seedAppConfigIfNeeded } from '@/lib/firebase';

// Configure Base URL dynamically when running on external hosting like Netlify
try {
  const hostname = window.location.hostname;
  const isNetlifyOrExternal = 
    hostname.endsWith('.netlify.app') || 
    (!hostname.includes('run.app') && hostname !== 'localhost' && hostname !== '127.0.0.1');

  if (isNetlifyOrExternal) {
    // Point API to the hosted Google Cloud Run backend instance which handles /api requests
    setBaseUrl('https://ais-pre-pfotbardce5vjnqnlmpm63-168977329553.asia-southeast1.run.app');
  }
} catch (e) {
  console.warn('Could not determine dynamic base URL:', e);
}

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