import { BrowserRouter, Routes, Route } from 'react-router-dom';
import useAuth from '../hooks/useAuth.jsx';
import Login from '../pages/Login/Login.jsx';
import ReplicaPage from '../pages/Replica/ReplicaPage.jsx';

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', color: '#516B7A' }}>
        Loading…
      </div>
    );
  }

  // A password-reset link may be opened in a browser that still has a session for a
  // different account — always show the reset form in that case instead of the
  // authenticated app, otherwise the token would be silently dropped.
  const hasResetToken = new URLSearchParams(window.location.search).has('token');

  return (user && !hasResetToken) ? <ReplicaPage /> : <Login />;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<AuthGate />} />
      </Routes>
    </BrowserRouter>
  );
}
