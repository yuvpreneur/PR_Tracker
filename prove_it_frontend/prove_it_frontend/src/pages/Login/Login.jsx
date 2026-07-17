import { useState } from 'react';
import { login, getMe } from '../../services/authService';
import useAuth from '../../hooks/useAuth.jsx';
import logo from '../../assets/images/company-logo.png';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { setUser } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      const user = await getMe();
      setUser(user);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-screen">
      <div className="login-box">
        <div className="login-logo">
          <div className="logo-icon">
            <img className="brand-mark" src={logo} alt="Prove IT Catalysts logo" />
          </div>
          <h1>Project &amp; Financial Tracker</h1>
          <p>Professional project, billing and approval intelligence</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-control"
                type="text"
                placeholder="your username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-control"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p style={{ color: 'var(--red)', fontSize: '13px', margin: 0, background: 'var(--red-soft)', padding: '8px 12px', borderRadius: '10px' }}>
                {error}
              </p>
            )}

            <div style={{ textAlign: 'right' }}>
              <a href="#" style={{ color: 'var(--accent)', fontSize: '12px' }}>Forgot password?</a>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="divider">
              <div className="divider-line"></div>
              <span className="divider-text">or continue with</span>
              <div className="divider-line"></div>
            </div>

            <button type="button" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
              🔑 Single Sign-On (SSO)
            </button>
          </form>
        </div>

        <p className="login-footer">© 2026 Prove IT Catalysts · Privacy · Terms</p>
      </div>
    </div>
  );
}
