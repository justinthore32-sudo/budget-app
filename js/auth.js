/* ============================================
   BUDGET APP — auth.js
   Connexion, garde des pages, menu utilisateur.
   La protection réelle vient du Worker (toute route
   /api/* exige un token de session valide) — ce
   fichier gère l'expérience côté client.
   ============================================ */

function initLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  if (getAuthToken()) {
    window.location.href = 'index.html';
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-submit');
    errorEl.classList.add('hidden');
    btn.disabled = true;
    btn.textContent = 'Connexion…';

    try {
      await login(username, password);
      window.location.href = 'index.html';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Se connecter';
    }
  });
}

function renderPinMenuItems() {
  const hasPin = !!getPinHash();
  document.getElementById('user-menu-pin-set')?.classList.toggle('hidden', hasPin);
  document.getElementById('user-menu-pin-change')?.classList.toggle('hidden', !hasPin);
  document.getElementById('user-menu-pin-remove')?.classList.toggle('hidden', !hasPin);
}

function initUserMenu() {
  const btn = document.getElementById('user-menu-btn');
  const menu = document.getElementById('user-menu');
  if (!btn || !menu) return;

  const user = getCurrentUser();
  if (!user) return;

  document.getElementById('user-initial').textContent = (user.displayName || user.username || '?').charAt(0).toUpperCase();
  document.getElementById('user-menu-name').textContent = `Bonjour ${user.displayName || user.username}`;

  const adminLink = document.getElementById('user-menu-admin');
  if (adminLink) adminLink.classList.toggle('hidden', !user.isAdmin);

  btn.addEventListener('click', () => menu.classList.toggle('active'));
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu-wrap')) menu.classList.remove('active');
  });

  const logoutBtn = document.getElementById('user-menu-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logout();
      window.location.href = 'login.html';
    });
  }

  const passwordBtn = document.getElementById('user-menu-password');
  if (passwordBtn) {
    passwordBtn.addEventListener('click', async () => {
      menu.classList.remove('active');
      const newPassword = await showTextPrompt('Nouveau mot de passe', { type: 'password', placeholder: 'Minimum 4 caractères', minLength: 4 });
      if (!newPassword) return;
      try {
        await changeOwnPassword(newPassword);
        showToast('Mot de passe mis à jour ✓');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  renderPinMenuItems();
  const handleSetPin = async () => {
    menu.classList.remove('active');
    const pin1 = await showTextPrompt('Nouveau code PIN (4 chiffres min.)', { type: 'password', placeholder: '••••', minLength: 4 });
    if (!pin1) return;
    const pin2 = await showTextPrompt('Confirme le code PIN', { type: 'password', placeholder: '••••', minLength: 4 });
    if (!pin2) return;
    if (pin1 !== pin2) { showToast('Les codes ne correspondent pas', 'error'); return; }
    savePinHash(await hashPin(pin1));
    showToast('Code PIN activé ✓');
    renderPinMenuItems();
  };
  document.getElementById('user-menu-pin-set')?.addEventListener('click', handleSetPin);
  document.getElementById('user-menu-pin-change')?.addEventListener('click', handleSetPin);
  document.getElementById('user-menu-pin-remove')?.addEventListener('click', async () => {
    menu.classList.remove('active');
    const ok = await showConfirm('Désactiver le code PIN ?', { danger: true });
    if (!ok) return;
    clearPin();
    showToast('Code PIN désactivé');
    renderPinMenuItems();
  });

  const exportBtn = document.getElementById('user-menu-export');
  if (exportBtn) exportBtn.addEventListener('click', () => { exportData(); menu.classList.remove('active'); });

  const importInput = document.getElementById('user-menu-import-input');
  if (importInput) {
    importInput.addEventListener('change', () => {
      if (importInput.files[0]) importData(importInput.files[0]);
      menu.classList.remove('active');
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initLoginForm();
  initUserMenu();
});
