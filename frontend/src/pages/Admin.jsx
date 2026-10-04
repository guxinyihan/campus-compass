import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../hooks/authContext';
import { identityApi } from '../services/identityApi';
import { request } from '../services/http';
import { config } from '../config';

function VehicleForm({ vehicle, users, onSave, busy }) {
  const submit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({ displayName: data.get('displayName'), code: data.get('code'), active: data.get('active') === 'on', simulated: data.get('simulated') === 'on', assignedDriver: data.get('assignedDriver') || null });
  };
  return <form onSubmit={submit} className="admin-form"><label>Display name<input name="displayName" defaultValue={vehicle?.displayName || ''} required maxLength="80" /></label>
    <label>Vehicle code<input name="code" defaultValue={vehicle?.code || ''} required maxLength="32" /></label>
    <label>Assigned driver<select name="assignedDriver" defaultValue={vehicle?.assignedDriver || ''}><option value="">Unassigned</option>{users.filter((user) => user.role === 'driver').map((user) => <option value={user.id} key={user.id}>{user.name} ({user.email})</option>)}</select></label>
    <label className="checkbox"><input type="checkbox" name="active" defaultChecked={vehicle?.active ?? true} />Active vehicle</label>
    <label className="checkbox"><input type="checkbox" name="simulated" defaultChecked={vehicle?.simulated ?? true} />Simulated demo (shown publicly)</label>
    <button disabled={busy}>{vehicle ? 'Save vehicle' : 'Create vehicle'}</button>
  </form>;
}
VehicleForm.propTypes = { vehicle: PropTypes.object, users: PropTypes.array.isRequired, onSave: PropTypes.func.isRequired, busy: PropTypes.bool };

const localDate = (iso) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
function NoticeForm({ notice, onSave, busy }) {
  const submit = (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({ title: data.get('title'), message: data.get('message'), severity: data.get('severity'), activeFrom: new Date(data.get('activeFrom')).toISOString(), activeUntil: new Date(data.get('activeUntil')).toISOString() });
  };
  return <form onSubmit={submit} className="admin-form"><label>Title<input name="title" defaultValue={notice?.title || ''} required maxLength="120" /></label>
    <label>Message<textarea name="message" defaultValue={notice?.message || ''} required maxLength="2000" rows="3" /></label>
    <label>Severity<select name="severity" defaultValue={notice?.severity || 'info'}><option value="info">Information</option><option value="warning">Warning</option><option value="disruption">Service disruption</option></select></label>
    <label>Active from (local time)<input name="activeFrom" type="datetime-local" defaultValue={localDate(notice?.activeFrom || Date.now())} required /></label>
    <label>Active until (local time)<input name="activeUntil" type="datetime-local" defaultValue={localDate(notice?.activeUntil || Date.now() + 86400000)} required /></label>
    <button disabled={busy}>{notice ? 'Save notice' : 'Create notice'}</button>
  </form>;
}
NoticeForm.propTypes = { notice: PropTypes.object, onSave: PropTypes.func.isRequired, busy: PropTypes.bool };

export default function Admin() {
  const { token } = useAuth();
  const [data, setData] = useState({ users: [], vehicles: [], notices: [] });
  const [health, setHealth] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const load = useCallback(async (signal) => {
    const [users, vehicles, notices] = await Promise.all(['users', 'vehicles', 'notices'].map((kind) => identityApi.admin(`/${kind}`, token, { signal })));
    if (!signal?.aborted) { setData({ users: users.users, vehicles: vehicles.vehicles, notices: notices.notices }); setLoaded(true); }
  }, [token]);
  const checkHealth = useCallback(async (signal) => {
    const services = { Identity: config.identityUrl, Routing: config.routingUrl, Tracking: config.trackingUrl };
    const checks = await Promise.all(Object.entries(services).map(async ([name, base]) => {
      try { await request(base, '/health', { signal }); return [name, 'healthy']; } catch { return [name, 'unavailable']; }
    }));
    if (!signal?.aborted) setHealth(Object.fromEntries(checks));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).catch((failure) => { if (failure.name !== 'AbortError') setError(failure.message); });
    checkHealth(controller.signal);
    return () => controller.abort();
  }, [load, checkHealth]);
  const mutate = async (path, method, body) => {
    setBusy(true); setError(''); setMessage('');
    try { await identityApi.admin(path, token, { method, body }); await load(); setMessage('Saved successfully.'); setRevision((n) => n + 1); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  };
  const remove = (path, name) => { if (window.confirm(`Delete ${name}?`)) mutate(path, 'DELETE'); };
  return <main className="workspace-page"><span className="eyebrow">Administrator</span><h1>Campus operations</h1><p className="muted">Manage demo vehicles, driver assignments and scheduled service notices.</p>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}{!loaded && !error && <p role="status">Loading administration data…</p>}
    <section className="workspace-card"><div className="section-title"><h2>Service health</h2><button className="secondary" onClick={() => checkHealth()}>Refresh health</button></div><ul className="health-list">{Object.entries(health).map(([name, state]) => <li key={name}>{name}<span className={`status ${state === 'healthy' ? 'live' : 'offline'}`}>{state}</span></li>)}</ul></section>
    {loaded && <><section className="workspace-card"><h2>Student and driver accounts</h2><p className="muted">Public registration creates students. An administrator assigns driver roles here. Administrator accounts cannot be promoted through this page.</p>
      <div className="table-scroll"><table><thead><tr><th>Account</th><th>Role</th><th>Action</th></tr></thead><tbody>{data.users.map((user) => <tr key={`${user.id}-${user.role}`}><td>{user.name}<small>{user.email}</small></td><td>{user.role}</td><td>{user.role !== 'admin' && <form className="inline-form" onSubmit={(event) => { event.preventDefault(); mutate(`/users/${user.id}/role`, 'PATCH', { role: new FormData(event.currentTarget).get('role') }); }}><select name="role" aria-label={`Role for ${user.name}`} defaultValue={user.role}><option value="student">Student</option><option value="driver">Driver</option></select><button className="secondary" disabled={busy}>Update role</button></form>}</td></tr>)}</tbody></table></div>
    </section><section className="workspace-card"><h2>Vehicles and driver assignments</h2><details><summary>Create vehicle</summary><VehicleForm key={`new-${revision}`} users={data.users} busy={busy} onSave={(body) => mutate('/vehicles', 'POST', body)} /></details>
      {!data.vehicles.length && <p className="muted">No vehicles created.</p>}
      {data.vehicles.map((vehicle) => <article className="admin-record" key={vehicle.vehicleId}><div className="section-title"><h3>{vehicle.displayName} <small>{vehicle.code}</small></h3><span className={`status ${vehicle.active ? 'live' : 'offline'}`}>{vehicle.active ? 'active' : 'inactive'}</span></div><p className="muted">{vehicle.simulated ? 'Simulated demo' : 'Vehicle'} · {data.users.find((user) => user.id === vehicle.assignedDriver)?.name || 'No assigned driver'}</p><details><summary>Edit vehicle and assignment</summary><VehicleForm key={`${vehicle.vehicleId}-${revision}`} vehicle={vehicle} users={data.users} busy={busy} onSave={(body) => mutate(`/vehicles/${vehicle.vehicleId}`, 'PATCH', body)} /></details><button className="text-button danger-text" disabled={busy} onClick={() => remove(`/vehicles/${vehicle.vehicleId}`, vehicle.displayName)}>Delete vehicle</button></article>)}
    </section><section className="workspace-card"><h2>Campus service notices</h2><p className="muted">Scheduled service information. These are demonstration notices, not an official emergency alert system.</p><details><summary>Create notice</summary><NoticeForm key={`notice-new-${revision}`} busy={busy} onSave={(body) => mutate('/notices', 'POST', body)} /></details>
      {!data.notices.length && <p className="muted">No service notices created.</p>}{data.notices.map((notice) => <article className="admin-record" key={notice.id}><h3>{notice.title}</h3><p>{notice.message}</p><small>{notice.severity} · {new Date(notice.activeFrom).toLocaleString()} — {new Date(notice.activeUntil).toLocaleString()}</small><details><summary>Edit notice</summary><NoticeForm key={`${notice.id}-${revision}`} notice={notice} busy={busy} onSave={(body) => mutate(`/notices/${notice.id}`, 'PATCH', body)} /></details><button className="text-button danger-text" disabled={busy} onClick={() => remove(`/notices/${notice.id}`, notice.title)}>Delete notice</button></article>)}
    </section></>}
  </main>;
}
