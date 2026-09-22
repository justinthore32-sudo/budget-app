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
  applyDepenseEffect(depense);

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
    <div class="depense-row depense-row-clickable" data-id="${d.id}">
      <div class="depense-row-left">
        <div class="depense-icon">${CATEGORIES[d.categorie]?.icon || '📦'}</div>
        <div class="depense-info">
          <span class="depense-desc">${d.description || CATEGORIES[d.categorie]?.label || 'Dépense'}</span>
          <span class="depense-meta">${formatDateShort(d.date)} · ${d.compte === 'cb' ? '💳 CB' : '💵 Espèces'}</span>
        </div>
      </div>
      <span class="depense-montant">-${formatEuro(d.montant)}</span>
    </div>`).join('');

  list.querySelectorAll('[data-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const dep = getDepenses().find((d) => d.id === row.dataset.id);
      if (dep) openEditDepenseModal(dep, () => { renderHeaderSoldes(); refreshDernieresDepenses(); });
    });
  });
}

/* ---------- MODIFIER / SUPPRIMER UNE DÉPENSE (utilisé aussi par mensuel.js) ---------- */
function openEditDepenseModal(dep, onDone) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">Modifier la dépense</div>
      <input type="number" class="modal-input" id="edit-dep-montant" value="${dep.montant}" step="0.01" min="0" inputmode="decimal" placeholder="Montant (€)">
      <select class="modal-input" id="edit-dep-cat">
        ${Object.entries(CATEGORIES).map(([key, c]) => `<option value="${key}" ${key === dep.categorie ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
      </select>
      <select class="modal-input" id="edit-dep-compte">
        <option value="cb" ${dep.compte === 'cb' ? 'selected' : ''}>💳 CB</option>
        <option value="especes" ${dep.compte === 'especes' ? 'selected' : ''}>💵 Espèces</option>
      </select>
      <input type="text" class="modal-input" id="edit-dep-desc" value="${(dep.description || '').replace(/"/g, '&quot;')}" placeholder="Description (optionnel)">
      <div class="modal-actions">
        <button class="btn btn-danger" data-act="delete">Supprimer</button>
        <button class="btn btn-outline" data-act="cancel">Annuler</button>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:10px;" data-act="ok">Enregistrer</button>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-act="cancel"]').addEventListener('click', close);

  overlay.querySelector('[data-act="delete"]').addEventListener('click', async () => {
    const ok = await showConfirm('Supprimer cette dépense ?', { danger: true });
    if (!ok) return;
    reverseDepenseEffect(dep);
    saveDepenses(getDepenses().filter((d) => d.id !== dep.id));
    close();
    showToast('Dépense supprimée');
    if (onDone) onDone();
  });

  overlay.querySelector('[data-act="ok"]').addEventListener('click', () => {
    const montant = parseFloat(document.getElementById('edit-dep-montant').value);
    if (!montant || montant <= 0) { showToast('Montant invalide', 'error'); return; }
    const categorie = document.getElementById('edit-dep-cat').value;
    const compte = document.getElementById('edit-dep-compte').value;
    const description = document.getElementById('edit-dep-desc').value.trim();

    const updated = { ...dep, montant, categorie, compte, description };
    applyDepenseEdit(dep, updated);
    saveDepenses(getDepenses().map((d) => (d.id === dep.id ? updated : d)));

    close();
    showToast('Dépense modifiée ✓');
    if (onDone) onDone();
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
