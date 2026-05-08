import { RouterProvider } from 'react-router';
import { router } from './routes';
import { DesignProvider } from './contexts/DesignContext';

export default function App() {
  return (
    <DesignProvider>
      <RouterProvider router={router} />
    </DesignProvider>
  );
}