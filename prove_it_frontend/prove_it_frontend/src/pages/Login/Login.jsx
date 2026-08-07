import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { login, getMe, register, checkRegistrationAvailable, forgotPassword, resetPassword } from '../../services/authService';
import useAuth from '../../hooks/useAuth.jsx';
import logo from '../../assets/images/company-logo.png';
import './Login.css';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot' | 'reset'
  const [registerAvailable, setRegisterAvailable] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotResetLink, setForgotResetLink] = useState('');

  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError]     = useState('');
  const [info, setInfo]       = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Checked fresh on every mount (e.g. after logout) — closes itself the instant any
  // account exists, so this option can only ever be used once across the app's lifetime.
  useEffect(() => {
    checkRegistrationAvailable().then(setRegisterAvailable);
  }, []);

  // A forgot-password email links here as /?token=... — jump straight to the
  // reset-password form instead of the normal sign-in screen.
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setResetToken(token);
      setMode('reset');
    }
  }, [searchParams]);

  const handleLogin = async (e) => {
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

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ username: regUsername, password: regPassword, name: regName, email: regEmail });
      const user = await getMe();
      setUser(user);
    } catch (err) {
      setError(err.message || 'Could not create the admin account.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next) => {
    setError('');
    setInfo('');
    setMode(next);
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await forgotPassword(forgotEmail);
      setForgotResetLink(result.reset_link || '');
      setForgotSubmitted(true);
    } catch (err) {
      setError(err.message || 'Could not process your request.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(resetToken, newPassword);
      navigate('/', { replace: true });
      setMode('login');
      setInfo('Password updated. You can now sign in.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Could not reset your password.');
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
          {mode === 'login' ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

              {info && (
                <p style={{ color: 'var(--green)', fontSize: '13px', margin: 0, background: 'var(--green-soft)', padding: '8px 12px', borderRadius: '10px' }}>
                  {info}
                </p>
              )}

              {error && (
                <p style={{ color: 'var(--red)', fontSize: '13px', margin: 0, background: 'var(--red-soft)', padding: '8px 12px', borderRadius: '10px' }}>
                  {error}
                </p>
              )}

              <div style={{ textAlign: 'right' }}>
                <a href="#" onClick={e => { e.preventDefault(); switchMode('forgot'); }} style={{ color: 'var(--accent)', fontSize: '12px' }}>Forgot password?</a>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                disabled={loading}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>

              {registerAvailable && (
                <p style={{ textAlign: 'center', fontSize: '13px', margin: 0, color: 'var(--slate)' }}>
                  First time setting up?{' '}
                  <a href="#" onClick={e => { e.preventDefault(); switchMode('register'); }} style={{ color: 'var(--accent)' }}>
                    Create the admin account
                  </a>
                </p>
              )}
            </form>
          ) : mode === 'register' ? (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: 'var(--slate)', margin: 0 }}>
                No account exists yet — set up the first Admin account for this workspace.
              </p>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="Jane Doe"
                  value={regName}
                  onChange={e => setRegName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  className="form-control"
                  type="email"
                  placeholder="jane@company.com"
                  value={regEmail}
                  onChange={e => setRegEmail(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="jane"
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  className="form-control"
                  type="password"
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p style={{ color: 'var(--red)', fontSize: '13px', margin: 0, background: 'var(--red-soft)', padding: '8px 12px', borderRadius: '10px' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                disabled={loading}
              >
                {loading ? 'Creating account…' : 'Create Admin Account'}
              </button>

              <p style={{ textAlign: 'center', fontSize: '13px', margin: 0 }}>
                <a href="#" onClick={e => { e.preventDefault(); switchMode('login'); }} style={{ color: 'var(--accent)' }}>
                  <ArrowLeft size={12} style={{ verticalAlign: '-2px' }} /> Back to sign in
                </a>
              </p>
            </form>
          ) : mode === 'forgot' ? (
            forgotSubmitted ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--slate)', margin: 0 }}>
                  If an account exists for <strong>{forgotEmail}</strong>, you can reset its password below. The link expires in 30 minutes.
                </p>

                {forgotResetLink && (
                  <a
                    href={forgotResetLink}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '10px', textDecoration: 'none' }}
                  >
                    Continue to reset your password
                  </a>
                )}

                <p style={{ textAlign: 'center', fontSize: '13px', margin: 0 }}>
                  <a href="#" onClick={e => { e.preventDefault(); setForgotSubmitted(false); setForgotEmail(''); setForgotResetLink(''); switchMode('login'); }} style={{ color: 'var(--accent)' }}>
                    <ArrowLeft size={12} style={{ verticalAlign: '-2px' }} /> Back to sign in
                  </a>
                </p>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--slate)', margin: 0 }}>
                  Enter your account email and we'll send you a link to reset your password.
                </p>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-control"
                    type="email"
                    placeholder="jane@company.com"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <p style={{ color: 'var(--red)', fontSize: '13px', margin: 0, background: 'var(--red-soft)', padding: '8px 12px', borderRadius: '10px' }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                  disabled={loading}
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>

                <p style={{ textAlign: 'center', fontSize: '13px', margin: 0 }}>
                  <a href="#" onClick={e => { e.preventDefault(); switchMode('login'); }} style={{ color: 'var(--accent)' }}>
                    <ArrowLeft size={12} style={{ verticalAlign: '-2px' }} /> Back to sign in
                  </a>
                </p>
              </form>
            )
          ) : (
            <form onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: 'var(--slate)', margin: 0 }}>
                Choose a new password for your account.
              </p>
              <div className="form-group">
                <label className="form-label">New password</label>
                <input
                  className="form-control"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm new password</label>
                <input
                  className="form-control"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p style={{ color: 'var(--red)', fontSize: '13px', margin: 0, background: 'var(--red-soft)', padding: '8px 12px', borderRadius: '10px' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                disabled={loading}
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>

              <p style={{ textAlign: 'center', fontSize: '13px', margin: 0 }}>
                <a href="#" onClick={e => { e.preventDefault(); navigate('/', { replace: true }); switchMode('forgot'); }} style={{ color: 'var(--accent)' }}>
                  <ArrowLeft size={12} style={{ verticalAlign: '-2px' }} /> Request a new link
                </a>
              </p>
            </form>
          )}
        </div>

        <p className="login-footer">© 2026 Prove IT Catalysts · Privacy · Terms</p>
      </div>
    </div>
  );
}
