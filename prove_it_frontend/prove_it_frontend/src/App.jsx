import { AuthProvider } from './hooks/useAuth.jsx';
import { ReferenceDataProvider } from './hooks/useReferenceData.jsx';
import AppRoutes from './routes/AppRoutes.jsx';

export default function App() {
  return (
    <AuthProvider>
      <ReferenceDataProvider>
        <AppRoutes />
      </ReferenceDataProvider>
    </AuthProvider>
  );
}
