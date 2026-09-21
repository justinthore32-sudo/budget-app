/* ============================================
   BUDGET APP — admin.js
   Page Gestion des comptes : liste, création,
   suppression. Réservé aux comptes admin.
   ============================================ */

function formatDateAdmin(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function renderUsers(users) {
  const list = document.getElementById('users-list');
  if (users.length === 0) {
    list.innerHTML = '<p class="text3" style="font-size:13px;">Aucun compte.</p>';
    return;
  }

  list.innerHTML = users.map((u) => `
    <div class="card" style="display:flex; flex-direction:column; gap:10px;" data-username="${u.username}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div style="font-weight:700; color:var(--text); font-size:14px;">${u.displayName} ${u.isAdmin ? '· Admin' : ''}</div>
          <div style="font-size:11.5px; color:var(--text3);">@${u.username} · créé le ${formatDateAdmin(u.createdAt)}</div>
        </div>
      </div>
      <div style="font-size:11.5px; color:var(--text3); display:flex; flex-direction:column; gap:2px;">
        <span>Dernière connexion : ${formatDateAdmin(u.lastLoginAt)}</span>
        <span>Dernière activité : ${formatDateAdmin(u.lastSeenAt)}</span>
      </div>
      ${u.username !== 'admin' ? `<button class="btn btn-danger" data-action="delete-user">Supprimer le compte</button>` : ''}
    </div>`).join('');

  list.querySelectorAll('[data-action="delete-user"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const username = btn.closest('[data-username]').dataset.username;
      const ok = await showConfirm(`Supprimer le compte @${username} ?`, { danger: true });
      if (!ok) return;
      try {
        await deleteUser(username);
        showToast('Compte supprimé');
        loadUsers();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

async function loadUsers() {
  try {
    const data = await fetchUsers();
    renderUsers(data.users || []);
  } catch (err) {
    document.getElementById('users-list').innerHTML = `<p class="text-red" style="font-size:13px;">${err.message}</p>`;
  }
}

function initCreateUserForm() {
  const form = document.getElementById('create-user-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value.trim();
    const displayName = document.getElementById('new-displayname').value.trim();
    const password = document.getElementById('new-password').value;
    const isAdmin = document.getElementById('new-isadmin').checked;
    const errorEl = document.getElementById('create-user-error');
    errorEl.classList.add('hidden');

    try {
      await createUser(username, password, displayName, isAdmin);
      showToast('Compte créé ✓');
      form.reset();
      loadUsers();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const user = getCurrentUser();
  if (!getAuthToken()) {
    window.location.href = 'login.html';
    return;
  }
  if (!user || !user.isAdmin) {
    window.location.href = 'index.html';
    return;
  }
  document.getElementById('admin-name').textContent = user.displayName || user.username;
  loadUsers();
  initCreateUserForm();
});
