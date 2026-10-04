import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import PropTypes from 'prop-types';
import AuthProvider from './components/AuthProvider';
import AuthForm from './components/AuthForm';
import { useAuth } from './hooks/authContext';
import Navigate from './pages/Navigate';
import Admin from './pages/Admin';
import Driver from './pages/Driver';

function RoleGate({ role, children }) {
  const { user } = useAuth();
  return user?.role === role ? children : <main className="workspace-page"><h1>{role === 'admin' ? 'Administration' : 'Driver publishing'}</h1><p role="status">Sign in with an assigned {role === 'admin' ? 'administrator' : 'driver'} account to open this page.</p><NavLink to="/">Return to campus navigation</NavLink></main>;
}
RoleGate.propTypes = { role: PropTypes.string.isRequired, children: PropTypes.node.isRequired };

function Shell() {
  const { user } = useAuth();
  return <><header className="app-header"><NavLink className="brand" to="/">CampusCompass<span>Campus navigation & shuttle demonstration</span></NavLink>
    <nav aria-label="Main navigation"><NavLink to="/">Map</NavLink>{user?.role === 'driver' && <NavLink to="/driver">Driver</NavLink>}{user?.role === 'admin' && <NavLink to="/admin">Administration</NavLink>}</nav><AuthForm />
  </header><Routes><Route path="/" element={<Navigate />} /><Route path="/map" element={<Navigate />} /><Route path="/admin" element={<RoleGate role="admin"><Admin /></RoleGate>} /><Route path="/driver" element={<RoleGate role="driver"><Driver /></RoleGate>} /><Route path="*" element={<main className="workspace-page"><h1>Page not found</h1><NavLink to="/">Return to the campus map</NavLink></main>} /></Routes></>;
}

export default function App() {
  return <BrowserRouter><AuthProvider><Shell /></AuthProvider></BrowserRouter>;
}
