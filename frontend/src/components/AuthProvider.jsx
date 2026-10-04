import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { AuthContext } from '../hooks/authContext';
import { identityApi } from '../services/identityApi';

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const logout = useCallback(() => setSession(null), []);
  const authenticate = async (mode, body) => {
    const result = await identityApi[mode](body);
    if (!result.accessToken || !result.user) throw new Error('The identity service returned an invalid session.');
    setSession({ ...result, expiresAt: Date.now() + (result.expiresIn || 900) * 1000 });
  };
  useEffect(() => {
    if (!session) return;
    const expiry = setTimeout(logout, Math.max(0, session.expiresAt - Date.now()));
    return () => clearTimeout(expiry);
  }, [session, logout]);
  return <AuthContext.Provider value={{ user: session?.user || null, token: session?.accessToken || null, authenticate, logout }}>{children}</AuthContext.Provider>;
}
AuthProvider.propTypes = { children: PropTypes.node.isRequired };
