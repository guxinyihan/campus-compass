import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import App from '../src/App';
import { identityApi } from '../src/services/identityApi';

vi.mock('../src/pages/Navigate', () => ({ default: () => <h1>Public campus map</h1> }));
vi.mock('../src/pages/Admin', () => ({ default: () => <h1>Campus operations</h1> }));
vi.mock('../src/pages/Driver', () => ({ default: () => <h1>Publish vehicle location</h1> }));
vi.mock('../src/services/identityApi', () => ({ identityApi: { login: vi.fn(), register: vi.fn() } }));
afterEach(() => { window.history.replaceState({}, '', '/'); localStorage.clear(); });

async function signIn(role) {
  identityApi.login.mockResolvedValue({ accessToken: 'secret-memory-token', expiresIn: 900, user: { id: 'u1', name: 'Demo User', role } });
  fireEvent.click(screen.getByText('Sign in', { selector: 'summary' }));
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'demo@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'demo-long-password' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form'));
  await screen.findByRole('button', { name: 'Sign out' });
}

test('direct admin URL is protected and a student has no admin controls', async () => {
  window.history.replaceState({}, '', '/admin');
  render(<App />);
  expect(screen.getByRole('status').textContent).toMatch(/assigned administrator/);
  expect(screen.queryByText('Campus operations')).toBeNull();
  await signIn('student');
  expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull();
  expect(screen.queryByText('Campus operations')).toBeNull();
});

test('server-issued admin identity opens administration and logout immediately removes it', async () => {
  window.history.replaceState({}, '', '/admin');
  render(<App />);
  await signIn('admin');
  expect(screen.getByText('Campus operations')).toBeTruthy();
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(screen.queryByText('Campus operations')).toBeNull();
  expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull();
});

test('public registration sends only name, email and password, with no role selector', async () => {
  identityApi.register.mockResolvedValue({ accessToken: 'student-token', user: { name: 'Student', role: 'student' }, expiresIn: 900 });
  render(<App />);
  fireEvent.click(screen.getByText('Sign in', { selector: 'summary' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create a student account' }));
  expect(screen.queryByRole('combobox')).toBeNull();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Student' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'student@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-long-demo-password' } });
  fireEvent.submit(screen.getByLabelText('Name').closest('form'));
  await waitFor(() => expect(identityApi.register).toHaveBeenCalledWith({ name: 'Student', email: 'student@example.test', password: 'a-long-demo-password' }));
});
