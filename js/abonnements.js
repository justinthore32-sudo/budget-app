/* ============================================
   BUDGET APP — abonnements.js
   Page 4 — Abonnements récurrents.
   ============================================ */

function renderAbonnements() {
  const abos = getAbonnements();
  const totalMensuel = abos.filter((a) => a.actif).reduce((s, a) => s + a.montant, 0);

  document.getElementById('abo-total-mensuel').textContent = formatEuro(totalMensuel, 2);
  document.getElementById('abo-total-annuel').textContent = `${formatEuro(totalMensuel * 12, 0)} / an`;

  const list = document.getElementById('abonnements-list');
  if (abos.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔄</div><p>Aucun abonnement enregistré.</p></div>`;
    return;
  }

  list.innerHTML = abos.map((a) => `
    <div class="abo-row ${a.actif ? '' : 'inactive'}" data-id="${a.id}">
      <div class="abo-info">
        <div class="abo-nom">${CATEGORIES[a.categorie]?.icon || '📦'} ${a.nom}</div>
        <div class="abo-cat">${CATEGORIES[a.categorie]?.label || 'Autres'}</div>
      </div>
      <span class="abo-montant">${formatEuro(a.montant, 2)}</span>
      <div class="toggle-switch ${a.actif ? 'on' : ''}" data-toggle="${a.id}"></div>
      <button class="abo-delete" data-delete="${a.id}">✕</button>
    </div>`).join('');

  list.querySelectorAll('[data-toggle]').forEach((el) => {
    el.addEventListener('click', () => {
      const abos2 = getAbonnements();
      const abo = abos2.find((a) => a.id === el.dataset.toggle);
      if (abo) {
        abo.actif = !abo.actif;
        saveAbonnements(abos2);
        renderAbonnements();
      }
    });
  });

  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await showConfirm('Supprimer cet abonnement ?', { danger: true });
      if (!ok) return;
      saveAbonnements(getAbonnements().filter((a) => a.id !== btn.dataset.delete));
      showToast('Abonnement supprimé');
      renderAbonnements();
    });
  });
}

function renderRevenus() {
  const revenus = getRevenus();
  document.getElementById('revenus-total-mensuel').textContent = formatEuro(getTotalRevenus(), 2);

  const list = document.getElementById('revenus-list');
  if (revenus.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">💶</div><p>Aucune source de revenu enregistrée.</p></div>`;
    return;
  }

  list.innerHTML = revenus.map((r) => `
    <div class="abo-row" data-id="${r.id}">
      <div class="abo-info">
        <div class="abo-nom">${r.nom}</div>
      </div>
      <span class="abo-montant text-green">+${formatEuro(r.montant, 2)}</span>
      <button class="abo-delete" data-delete-revenu="${r.id}">✕</button>
    </div>`).join('');

  list.querySelectorAll('[data-delete-revenu]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await showConfirm('Supprimer cette source de revenu ?', { danger: true });
      if (!ok) return;
      saveRevenus(getRevenus().filter((r) => r.id !== btn.dataset.deleteRevenu));
      showToast('Revenu supprimé');
      renderRevenus();
    });
  });
}

function ajouterRevenu(e) {
  e.preventDefault();
  const nom = document.getElementById('revenu-nom').value.trim();
  const montant = parseFloat(document.getElementById('revenu-montant').value);

  if (!nom || !montant || montant <= 0) {
    showToast('Formulaire incomplet', 'error');
    return;
  }

  const revenus = getRevenus();
  revenus.push({ id: uid('rev'), nom, montant, created_at: Date.now() });
  saveRevenus(revenus);

  document.getElementById('revenu-form').reset();
  document.getElementById('revenu-form-wrap').classList.add('hidden');
  showToast('Revenu ajouté ✓');
  renderRevenus();
}

function buildAboCategorieSelect() {
  return Object.entries(CATEGORIES).map(([key, cat]) => `<option value="${key}">${cat.icon} ${cat.label}</option>`).join('');
}

function ajouterAbonnement(e) {
  e.preventDefault();
  const nom = document.getElementById('abo-nom').value.trim();
  const montant = parseFloat(document.getElementById('abo-montant').value);
  const categorie = document.getElementById('abo-cat').value;

  if (!nom || !montant || montant <= 0) {
    showToast('Formulaire incomplet', 'error');
    return;
  }

  const abo = { id: uid('abo'), nom, montant, categorie, actif: true, created_at: Date.now() };
  const abos = getAbonnements();
  abos.push(abo);
  saveAbonnements(abos);

  document.getElementById('abo-form').reset();
  document.getElementById('abo-form-wrap').classList.add('hidden');
  showToast('Abonnement ajouté ✓');
  renderAbonnements();
}

window.refreshAbonnements = function refreshAbonnements() {
  renderRevenus();
  renderAbonnements();
};

document.addEventListener('DOMContentLoaded', () => {
  const catSelect = document.getElementById('abo-cat');
  if (catSelect) catSelect.innerHTML = buildAboCategorieSelect();

  const addBtn = document.getElementById('btn-show-abo-form');
  const formWrap = document.getElementById('abo-form-wrap');
  if (addBtn) addBtn.addEventListener('click', () => formWrap.classList.toggle('hidden'));

  const cancelBtn = document.getElementById('btn-cancel-abo-form');
  if (cancelBtn) cancelBtn.addEventListener('click', () => formWrap.classList.add('hidden'));

  const form = document.getElementById('abo-form');
  if (form) form.addEventListener('submit', ajouterAbonnement);

  const revenuAddBtn = document.getElementById('btn-show-revenu-form');
  const revenuFormWrap = document.getElementById('revenu-form-wrap');
  if (revenuAddBtn) revenuAddBtn.addEventListener('click', () => revenuFormWrap.classList.toggle('hidden'));

  const revenuCancelBtn = document.getElementById('btn-cancel-revenu-form');
  if (revenuCancelBtn) revenuCancelBtn.addEventListener('click', () => revenuFormWrap.classList.add('hidden'));

  const revenuForm = document.getElementById('revenu-form');
  if (revenuForm) revenuForm.addEventListener('submit', ajouterRevenu);
});
