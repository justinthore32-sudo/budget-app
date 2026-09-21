/* ============================================
   BUDGET APP — api.js
   Appels au Worker Cloudflare : authentification
   et proxy Claude (clé API jamais côté client).
   Même schéma que Ju Board.
   ============================================ */

const PROXY_URL = 'https://budget-app-proxy.ju-board-justin.workers.dev';
const AUTH_TOKEN_KEY = 'budget-app-token';
const AUTH_USER_KEY = 'budget-app-user';

function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null');
  } catch (err) {
    return null;
  }
}

function setSession(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function authHeaders(extra = {}) {
  const token = getAuthToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

async function apiFetch(path, options = {}) {
  const resp = await fetch(`${PROXY_URL}${path}`, {
    ...options,
    headers: authHeaders(options.headers || {})
  });
  if (resp.status === 401) {
    clearSession();
    if (!window.location.pathname.endsWith('login.html')) {
      window.location.href = 'login.html';
    }
  }
  return resp;
}

/* ---------- AUTHENTIFICATION ---------- */
async function login(username, password) {
  const resp = await fetch(`${PROXY_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erreur de connexion');
  setSession(data.token, { username: data.username, displayName: data.displayName, isAdmin: data.isAdmin });
  return data;
}

async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    /* on efface la session locale même si l'appel échoue */
  }
  clearSession();
}

async function changeOwnPassword(password) {
  const resp = await apiFetch('/api/auth/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erreur de mise à jour');
  return data;
}

async function fetchUsers() {
  const resp = await apiFetch('/api/auth/users');
  if (!resp.ok) throw new Error('Erreur chargement utilisateurs');
  return resp.json();
}

async function createUser(username, password, displayName, isAdmin) {
  const resp = await apiFetch('/api/auth/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, displayName, isAdmin })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erreur de création');
  return data;
}

async function deleteUser(username) {
  const resp = await apiFetch(`/api/auth/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Erreur de suppression');
  return data;
}

/* ---------- ANTHROPIC (via proxy) — page Analyse IA uniquement ---------- */
async function callClaude(messages, { system, maxTokens = 1000 } = {}) {
  const resp = await apiFetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system, max_tokens: maxTokens })
  });
  const data = await resp.json();
  if (!resp.ok) {
    const err = new Error(data.error === 'not_configured' ? 'not_configured' : (data.error || `Erreur API (${resp.status})`));
    throw err;
  }
  return data;
}
