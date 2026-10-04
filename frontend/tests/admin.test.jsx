import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import Admin from '../src/pages/Admin';
import { identityApi } from '../src/services/identityApi';
vi.mock('../src/hooks/authContext', () => ({ useAuth: () => ({ token: 'admin-token' }) }));
vi.mock('../src/services/http', () => ({ request: vi.fn(() => Promise.resolve({ status: 'ok' })) }));
vi.mock('../src/services/identityApi', () => ({ identityApi: { admin: vi.fn() } }));

test('admin role, assignment and notice forms submit real service contracts', async () => {
  identityApi.admin.mockImplementation((path, token, options = {}) => {
    if (options.method) return Promise.resolve({});
    if (path === '/users') return Promise.resolve({ users: [{ id: 'u1', name: 'Student Demo', email: 'student@example.test', role: 'student' }, { id: 'd1', name: 'Driver Demo', email: 'driver@example.test', role: 'driver' }] });
    if (path === '/vehicles') return Promise.resolve({ vehicles: [] });
    return Promise.resolve({ notices: [] });
  });
  render(<Admin />);
  await screen.findByText('Student Demo');
  fireEvent.change(screen.getByLabelText('Role for Student Demo'), { target: { value: 'driver' } });
  fireEvent.submit(screen.getByLabelText('Role for Student Demo').closest('form'));
  await waitFor(() => expect(identityApi.admin).toHaveBeenCalledWith('/users/u1/role', 'admin-token', { method: 'PATCH', body: { role: 'driver' } }));
  await screen.findByText('Saved successfully.');
  fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Demo Shuttle' } });
  fireEvent.change(screen.getByLabelText('Vehicle code'), { target: { value: 'DEMO-A' } });
  fireEvent.change(screen.getByLabelText('Assigned driver'), { target: { value: 'd1' } });
  fireEvent.submit(screen.getByLabelText('Display name').closest('form'));
  await waitFor(() => expect(identityApi.admin).toHaveBeenCalledWith('/vehicles', 'admin-token', { method: 'POST', body: { displayName: 'Demo Shuttle', code: 'DEMO-A', active: true, simulated: true, assignedDriver: 'd1' } }));
  await screen.findByText('Saved successfully.');
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Demo service notice' } });
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'A scheduled demonstration.' } });
  fireEvent.change(screen.getByLabelText('Active from (local time)'), { target: { value: '2026-10-04T09:00' } });
  fireEvent.change(screen.getByLabelText('Active until (local time)'), { target: { value: '2026-10-04T18:00' } });
  fireEvent.submit(screen.getByLabelText('Title').closest('form'));
  await waitFor(() => expect(identityApi.admin).toHaveBeenCalledWith('/notices', 'admin-token', { method: 'POST', body: expect.objectContaining({ title: 'Demo service notice', message: 'A scheduled demonstration.', severity: 'info', activeFrom: new Date('2026-10-04T09:00').toISOString(), activeUntil: new Date('2026-10-04T18:00').toISOString() }) }));
});
