/* ============================================
   BUDGET APP — saisie.js
   Page 1 — Saisie journalière rapide.
   ============================================ */

let activeCompte = 'cb';
let activeCategorie = 'alimentation';

function buildCatButtons() {
  const grid = document.getElementById('cat-select-grid');
  if (!grid || grid.dataset.built) return;
  grid.innerHTML = Object.entries(CATEGORIES).map(([key, cat]) => `
    <button type="button" class="cat-btn ${key === activeCategorie ? 'active' : ''}" data-cat="${key}" style="--cat-color:${cat.color}">
      <span class="cat-emoji">${cat.icon}</span>
      <span>${cat.label}</span>
    </button>`).join('');
  grid.dataset.built = '1';

  grid.querySelectorAll('.cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategorie = btn.dataset.cat;
      grid.querySelectorAll('.cat-btn').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
}

function initCompteToggle() {
  const btnCb = document.getElementById('btn-cb');
  const btnEsp = document.getElementById('btn-esp');
  if (!btnCb || btnCb.dataset.bound) return;
  btnCb.dataset.bound = '1';

  btnCb.addEventListener('click', () => {
    activeCompte = 'cb';
    btnCb.classList.add('active');
    btnEsp.classList.remove('active');
  });
  btnEsp.addEventListener('click', () => {
    activeCompte = 'especes';
    btnEsp.classList.add('active');
    btnCb.classList.remove('active');
  });
}

function validerDepense() {
  const montantInput = document.getElementById('montant');
  const descInput = document.getElementById('description');
  const montant = parseFloat(montantInput.value);

  if (!montant || montant <= 0) {
    showToast('Montant invalide', 'error');
    return;
  }

  const depense = {
    id: uid('dep'),
    date: todayISO(),
    categorie: activeCategorie,
    montant,
    description: descInput.value.trim(),
    compte: activeCompte,
    created_at: Date.now()
  };

  saveDepense(depense);
  updateSolde(activeCompte, -montant, CATEGORIES[activeCategorie].label);

  montantInput.value = '';
  descInput.value = '';

  showToast(`-${formatEuro(montant)} enregistré ✓`);
  renderHeaderSoldes();
  refreshDernieresDepenses();
}

function refreshDernieresDepenses() {
  const list = document.getElementById('dernieres-depenses-list');
  if (!list) return;
  const today = todayISO();
  let deps = getDepenses().filter((d) => d.date === today);
  if (deps.length === 0) {
    deps = getDepenses().slice(-5).reverse();
  } else {
    deps = deps.slice(-5).reverse();
  }

  if (deps.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🧾</div><p>Aucune dépense saisie pour l'instant.</p></div>`;
    return;
  }

  list.innerHTML = deps.map((d) => `
    <div class="depense-row" data-id="${d.id}">
      <div class="depense-row-left">
        <div class="depense-icon">${CATEGORIES[d.categorie]?.icon || '📦'}</div>
        <div class="depense-info">
          <span class="depense-desc">${d.description || CATEGORIES[d.categorie]?.label || 'Dépense'}</span>
          <span class="depense-meta">${formatDateShort(d.date)} · ${d.compte === 'cb' ? '💳 CB' : '💵 Espèces'}</span>
        </div>
      </div>
      <span class="depense-montant">-${formatEuro(d.montant)}</span>
      <button class="depense-delete" data-delete="${d.id}">✕</button>
    </div>`).join('');

  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await showConfirm('Supprimer cette dépense ?', { danger: true });
      if (!ok) return;
      const id = btn.dataset.delete;
      const deps = getDepenses();
      const dep = deps.find((d) => d.id === id);
      if (dep) {
        saveDepenses(deps.filter((d) => d.id !== id));
        updateSolde(dep.compte, dep.montant, 'Suppression dépense');
        renderHeaderSoldes();
        showToast('Dépense supprimée');
        refreshDernieresDepenses();
      }
    });
  });
}

window.refreshSaisie = function refreshSaisie() {
  buildCatButtons();
  initCompteToggle();
  renderHeaderSoldes();
  refreshDernieresDepenses();
};

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-valider-depense');
  if (btn) btn.addEventListener('click', validerDepense);
  const montantInput = document.getElementById('montant');
  if (montantInput) {
    montantInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') validerDepense(); });
  }
});
