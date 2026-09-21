/* ============================================
   BUDGET APP — Proxy Worker
   Authentification (comptes, sessions) + proxy
   Anthropic pour la page Analyse IA. La clé API
   ne vit jamais côté client — le site GitHub Pages
   n'appelle que ce Worker. Même schéma que Ju Board.
   ============================================ */

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function jsonResponse(data, env, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(env), 'content-type': 'application/json' }
  });
}

/* ---------- AUTHENTIFICATION ---------- */

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(byteLength) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const saltBytes = new Uint8Array(saltHex.match(/.{2}/g).map((b) => parseInt(b, 16)));
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

async function verifyPassword(password, saltHex, hashHex) {
  const computed = await hashPassword(password, saltHex);
  return computed === hashHex;
}

async function ensureAdminSeeded(env) {
  const existing = await env.USERS.get('user:admin');
  if (existing) return;
  const bootstrapPassword = env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!bootstrapPassword) return;
  const salt = randomHex(16);
  const hash = await hashPassword(bootstrapPassword, salt);
  await env.USERS.put('user:admin', JSON.stringify({
    username: 'admin',
    displayName: env.ADMIN_DISPLAY_NAME || 'Admin',
    isAdmin: true,
    salt,
    hash,
    createdAt: Date.now(),
    lastLoginAt: null,
    lastSeenAt: null
  }));
}

const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_LOCKOUT_SECONDS = 15 * 60;

async function getLoginAttempts(env, ip) {
  const raw = await env.SESSIONS.get(`loginattempts:${ip}`);
  return raw ? JSON.parse(raw) : { count: 0 };
}

async function recordLoginFailure(env, ip) {
  const attempts = await getLoginAttempts(env, ip);
  attempts.count += 1;
  await env.SESSIONS.put(`loginattempts:${ip}`, JSON.stringify(attempts), { expirationTtl: LOGIN_LOCKOUT_SECONDS });
}

async function clearLoginAttempts(env, ip) {
  await env.SESSIONS.delete(`loginattempts:${ip}`);
}

async function handleLogin(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const attempts = await getLoginAttempts(env, ip);
  if (attempts.count >= LOGIN_MAX_ATTEMPTS) {
    return jsonResponse({ error: 'Trop de tentatives échouées. Réessaie dans 15 minutes.' }, env, 429);
  }

  const { username, password } = await request.json();
  if (!username || !password) return jsonResponse({ error: 'Identifiants manquants' }, env, 400);

  await ensureAdminSeeded(env);

  const userRaw = await env.USERS.get(`user:${username.toLowerCase()}`);
  if (!userRaw) {
    await recordLoginFailure(env, ip);
    return jsonResponse({ error: 'Identifiants invalides' }, env, 401);
  }

  const user = JSON.parse(userRaw);
  const valid = await verifyPassword(password, user.salt, user.hash);
  if (!valid) {
    await recordLoginFailure(env, ip);
    return jsonResponse({ error: 'Identifiants invalides' }, env, 401);
  }

  await clearLoginAttempts(env, ip);

  const now = Date.now();
  const token = randomHex(32);

  await env.SESSIONS.put(`session:${token}`, JSON.stringify({
    username: user.username,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
    loginAt: now
  }), { expirationTtl: 60 * 60 * 24 * 30 });

  user.lastLoginAt = now;
  user.lastSeenAt = now;
  await env.USERS.put(`user:${user.username}`, JSON.stringify(user));

  return jsonResponse({ token, username: user.username, displayName: user.displayName, isAdmin: user.isAdmin }, env);
}

async function getSession(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const raw = await env.SESSIONS.get(`session:${token}`);
  if (!raw) return null;
  return { token, ...JSON.parse(raw) };
}

async function touchUserActivity(env, username) {
  const key = `user:${username}`;
  const raw = await env.USERS.get(key);
  if (!raw) return;
  const user = JSON.parse(raw);
  const now = Date.now();
  if (user.lastSeenAt && now - user.lastSeenAt < 2 * 60 * 1000) return;
  user.lastSeenAt = now;
  await env.USERS.put(key, JSON.stringify(user));
}

async function handleLogout(request, env) {
  const session = await getSession(request, env);
  if (session) await env.SESSIONS.delete(`session:${session.token}`);
  return jsonResponse({ ok: true }, env);
}

async function handleListUsers(request, env) {
  const session = await getSession(request, env);
  if (!session || !session.isAdmin) return jsonResponse({ error: 'Accès refusé' }, env, 403);

  const list = await env.USERS.list({ prefix: 'user:' });
  const users = await Promise.all(
    list.keys.map(async (k) => {
      const raw = await env.USERS.get(k.name);
      const u = JSON.parse(raw);
      return {
        username: u.username,
        displayName: u.displayName,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt || null,
        lastLoginAt: u.lastLoginAt || null,
        lastSeenAt: u.lastSeenAt || null
      };
    })
  );
  return jsonResponse({ users }, env);
}

async function handleChangePassword(request, env) {
  const session = await getSession(request, env);
  if (!session) return jsonResponse({ error: 'Non authentifié' }, env, 401);

  const { password } = await request.json();
  if (!password || password.length < 4) return jsonResponse({ error: 'Mot de passe trop court (4 caractères minimum)' }, env, 400);

  const key = `user:${session.username}`;
  const raw = await env.USERS.get(key);
  if (!raw) return jsonResponse({ error: 'Compte introuvable' }, env, 404);
  const user = JSON.parse(raw);

  const salt = randomHex(16);
  user.salt = salt;
  user.hash = await hashPassword(password, salt);
  await env.USERS.put(key, JSON.stringify(user));

  return jsonResponse({ ok: true }, env);
}

async function handleCreateUser(request, env) {
  const session = await getSession(request, env);
  if (!session || !session.isAdmin) return jsonResponse({ error: 'Accès refusé' }, env, 403);

  const { username, password, displayName, isAdmin } = await request.json();
  if (!username || !password) return jsonResponse({ error: 'Identifiants manquants' }, env, 400);

  const key = `user:${username.toLowerCase()}`;
  const existing = await env.USERS.get(key);
  if (existing) return jsonResponse({ error: "Ce nom d'utilisateur existe déjà" }, env, 409);

  const salt = randomHex(16);
  const hash = await hashPassword(password, salt);
  await env.USERS.put(key, JSON.stringify({
    username: username.toLowerCase(),
    displayName: displayName || username,
    isAdmin: !!isAdmin,
    salt,
    hash,
    createdAt: Date.now(),
    lastLoginAt: null,
    lastSeenAt: null
  }));
  return jsonResponse({ ok: true }, env);
}

async function handleDeleteUser(request, env, username) {
  const session = await getSession(request, env);
  if (!session || !session.isAdmin) return jsonResponse({ error: 'Accès refusé' }, env, 403);
  if (username.toLowerCase() === 'admin') return jsonResponse({ error: 'Impossible de supprimer le compte admin' }, env, 400);

  await env.USERS.delete(`user:${username.toLowerCase()}`);
  return jsonResponse({ ok: true }, env);
}

/* ---------- MOTEUR IA (Anthropic si dispo, sinon Gemini gratuit en secours) ---------- */
async function callGemini(env, systemInstruction, inputText, maxTokens) {
  const model = env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: inputText }] }],
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: { maxOutputTokens: maxTokens }
    })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Erreur Gemini (${resp.status})`);
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('\n').trim();
  if (!text) throw new Error('Réponse Gemini vide');
  return text;
}

async function callAnthropic(env, systemPrompt, messages, maxTokens) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ model: DEFAULT_MODEL, max_tokens: maxTokens, system: systemPrompt, messages })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Erreur Anthropic (${resp.status})`);
  return data?.content?.[0]?.text || '';
}

function flattenMessages(messages) {
  return (messages || []).map((m) => `${m.role === 'assistant' ? 'Assistant' : 'Utilisateur'}: ${m.content}`).join('\n\n');
}

async function generateText(env, systemPrompt, { messages, input } = {}, maxTokens = 800) {
  if (env.ANTHROPIC_API_KEY) {
    const msgs = messages || [{ role: 'user', content: input }];
    return await callAnthropic(env, systemPrompt, msgs, maxTokens);
  }
  if (env.GEMINI_API_KEY) {
    const text = input || flattenMessages(messages);
    return await callGemini(env, systemPrompt, text, maxTokens);
  }
  const err = new Error('not_configured');
  err.notConfigured = true;
  throw err;
}

async function handleClaude(request, env) {
  const payload = await request.json();
  try {
    const text = await generateText(env, payload.system, { messages: payload.messages }, payload.max_tokens || 800);
    return jsonResponse({ content: [{ text }] }, env, 200);
  } catch (err) {
    if (err.notConfigured) return jsonResponse({ error: 'not_configured' }, env, 501);
    return jsonResponse({ error: err.message }, env, 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        return await handleLogin(request, env);
      }
      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
        return await handleLogout(request, env);
      }
      if (url.pathname === '/api/auth/password' && request.method === 'POST') {
        return await handleChangePassword(request, env);
      }
      if (url.pathname === '/api/auth/users' && request.method === 'GET') {
        return await handleListUsers(request, env);
      }
      if (url.pathname === '/api/auth/users' && request.method === 'POST') {
        return await handleCreateUser(request, env);
      }
      if (url.pathname.startsWith('/api/auth/users/') && request.method === 'DELETE') {
        return await handleDeleteUser(request, env, decodeURIComponent(url.pathname.slice('/api/auth/users/'.length)));
      }

      if (url.pathname.startsWith('/api/') && url.pathname !== '/api/auth/login') {
        const session = await getSession(request, env);
        if (!session) return jsonResponse({ error: 'Non authentifié' }, env, 401);
        ctx.waitUntil(touchUserActivity(env, session.username));
      }

      if (url.pathname === '/api/claude' && request.method === 'POST') {
        return await handleClaude(request, env);
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders(env), 'content-type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders(env) });
  }
};
