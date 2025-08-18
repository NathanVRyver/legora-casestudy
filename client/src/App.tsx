import { BrowserRouter } from 'react-router-dom';
import { Router } from './router';
import { Providers } from './providers';

export function App() {
  return (
    <BrowserRouter>
      <Providers>
        <Router />
      </Providers>
    </BrowserRouter>
  );
}
