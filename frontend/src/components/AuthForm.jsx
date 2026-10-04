import { useState } from 'react';
import { useAuth } from '../hooks/authContext';

export default function AuthForm() {
  const { user, authenticate, logout } = useAuth();
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    const values = new FormData(event.currentTarget);
    const body = { email: values.get('email'), password: values.get('password'), ...(mode === 'register' ? { name: values.get('name') } : {}) };
    try { await authenticate(mode, body); } catch (failure) { setError(failure.message); }
    finally { setLoading(false); }
  };
  if (user) return <div className="account-summary"><span>{user.name} · {user.role}</span><button className="secondary" onClick={logout}>Sign out</button></div>;
  return <details className="account-details"><summary>Sign in</summary><form onSubmit={submit} className="account-form">
    <h2>{mode === 'login' ? 'Sign in' : 'Create a student account'}</h2>
    <p className="muted">Campus navigation is available without an account. Driver and administrator roles are assigned by an administrator.</p>
    {mode === 'register' && <label>Name<input name="name" autoComplete="name" required maxLength="100" /></label>}
    <label>Email<input name="email" type="email" autoComplete="username" required maxLength="254" /></label>
    <label>Password<input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 12 : 1} maxLength="128" /></label>
    {error && <p role="alert" className="error">{error}</p>}
    <button disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
    <button type="button" className="text-button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>{mode === 'login' ? 'Create a student account' : 'Use an existing account'}</button>
  </form></details>;
}
