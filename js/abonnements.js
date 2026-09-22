/* ============================================
   BUDGET APP — abonnements.js
   Page 4 — Abonnements récurrents.
   ============================================ */

function renderPourcentageCard() {
  const btn = document.getElementById('btn-configurer-pourcentage');
  const summary = document.getElementById('pourcentage-summary');
  const intro = document.getElementById('pourcentage-intro');
  const pourcentages = getPourcentages();

  if (!pourcentages) {
    summary.classList.add('hidden');
    intro.classList.remove('hidden');
    btn.textContent = 'Configurer le budget en %';
    return;
  }

  intro.classList.add('hidden');
  btn.textContent = 'Recalculer depuis le budget actuel';
  summary.classList.remove('hidden');
  const salaireType = getSalaireType();
  summary.innerHTML = `
    <div class="pourcentage-row"><strong>Référence : ${formatEuro(salaireType, 0)}</strong></div>
    ${Object.entries(CATEGORIES).map(([cat, meta]) => `
      <div class="pourcentage-row">
        <span>${meta.icon} ${meta.label}</span>
        <span class="mono">${(pourcentages[cat] || 0).toFixed(1)}% · ${formatEuro((pourcentages[cat] || 0) / 100 * salaireType, 0)}</span>
      </div>`).join('')}`;
}

async function configurerPourcentage() {
  const salaireActuel = getSalaireType() || getTotalRevenus();
  const salaireType = await showAmountPrompt('Salaire de référence pour calculer les %', { placeholder: salaireActuel ? String(salaireActuel) : '1725' });
  if (!salaireType) return;

  const pourcentages = calculerPourcentagesDepuisBudget(salaireType);
  savePourcentages(pourcentages);
  saveSalaireType(salaireType);
  showToast('Répartition en % enregistrée ✓');
  renderPourcentageCard();
}

const MOIS_NOMS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function renderAbonnements() {
  const abos = getAbonnements();
  const totalMensuel = getAbonnementsMensuelTotal();

  document.getElementById('abo-total-mensuel').textContent = formatEuro(totalMensuel, 2);
  document.getElementById('abo-total-annuel').textContent = `${formatEuro(getAbonnementsAnnuelReelTotal(), 0)} / an`;

  const list = document.getElementById('abonnements-list');
  if (abos.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔄</div><p>Aucun abonnement enregistré.</p></div>`;
    return;
  }

  list.innerHTML = abos.map((a) => {
    const isAnnuel = a.frequence === 'annuel';
    const sousTexte = isAnnuel
      ? `${CATEGORIES[a.categorie]?.label || 'Autres'} · prélevé en ${MOIS_NOMS[(a.mois_prelevement || 1) - 1]} · lissé ${formatEuro(a.montant / 12, 2)}/mois`
      : CATEGORIES[a.categorie]?.label || 'Autres';
    return `
    <div class="abo-row abo-row-clickable ${a.actif ? '' : 'inactive'}" data-id="${a.id}">
      <div class="abo-info">
        <div class="abo-nom">${CATEGORIES[a.categorie]?.icon || '📦'} ${a.nom}</div>
        <div class="abo-cat">${sousTexte}</div>
      </div>
      <span class="abo-montant">${formatEuro(a.montant, 2)}${isAnnuel ? '/an' : ''}</span>
      <div class="toggle-switch ${a.actif ? 'on' : ''}" data-toggle="${a.id}"></div>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-toggle]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const abos2 = getAbonnements();
      const abo = abos2.find((a) => a.id === el.dataset.toggle);
      if (abo) {
        abo.actif = !abo.actif;
        saveAbonnements(abos2);
        renderAbonnements();
      }
    });
  });

  list.querySelectorAll('.abo-row-clickable').forEach((row) => {
    row.addEventListener('click', () => {
      const abo = getAbonnements().find((a) => a.id === row.dataset.id);
      if (abo) openEditAbonnementModal(abo);
    });
  });
}

function openEditAbonnementModal(abo) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">Modifier l'abonnement</div>
      <input type="text" class="modal-input" id="edit-abo-nom" value="${(abo.nom || '').replace(/"/g, '&quot;')}" placeholder="Nom">
      <select class="modal-input" id="edit-abo-frequence">
        <option value="mensuel" ${abo.frequence !== 'annuel' ? 'selected' : ''}>Mensuel</option>
        <option value="annuel" ${abo.frequence === 'annuel' ? 'selected' : ''}>Annuel (assurance, impôts…)</option>
      </select>
      <input type="number" class="modal-input" id="edit-abo-montant" value="${abo.montant}" step="0.01" min="0" inputmode="decimal" placeholder="Montant (€)">
      <select class="modal-input" id="edit-abo-mois-prelevement" style="${abo.frequence === 'annuel' ? '' : 'display:none;'}">
        ${buildMoisPrelevementSelect()}
      </select>
      <select class="modal-input" id="edit-abo-cat">
        ${Object.entries(CATEGORIES).map(([key, c]) => `<option value="${key}" ${key === abo.categorie ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
      </select>
      <div class="modal-actions">
        <button class="btn btn-danger" data-act="delete">Supprimer</button>
        <button class="btn btn-outline" data-act="cancel">Annuler</button>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:10px;" data-act="ok">Enregistrer</button>
    </div>`;
  document.body.appendChild(overlay);

  const moisSelect = overlay.querySelector('#edit-abo-mois-prelevement');
  moisSelect.value = String(abo.mois_prelevement || 1);
  overlay.querySelector('#edit-abo-frequence').addEventListener('change', (e) => {
    moisSelect.style.display = e.target.value === 'annuel' ? '' : 'none';
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-act="delete"]').addEventListener('click', async () => {
    const ok = await showConfirm('Supprimer cet abonnement ?', { danger: true });
    if (!ok) return;
    saveAbonnements(getAbonnements().filter((a) => a.id !== abo.id));
    overlay.remove();
    showToast('Abonnement supprimé');
    renderAbonnements();
  });
  overlay.querySelector('[data-act="ok"]').addEventListener('click', () => {
    const nom = document.getElementById('edit-abo-nom').value.trim();
    const montant = parseFloat(document.getElementById('edit-abo-montant').value);
    const categorie = document.getElementById('edit-abo-cat').value;
    const frequence = document.getElementById('edit-abo-frequence').value;
    if (!nom || !montant || montant <= 0) { showToast('Formulaire incomplet', 'error'); return; }

    const updated = { ...abo, nom, montant, categorie, frequence };
    if (frequence === 'annuel') updated.mois_prelevement = parseInt(moisSelect.value, 10);
    else delete updated.mois_prelevement;

    saveAbonnements(getAbonnements().map((a) => (a.id === abo.id ? updated : a)));
    overlay.remove();
    showToast('Abonnement modifié ✓');
    renderAbonnements();
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
    <div class="abo-row abo-row-clickable" data-id="${r.id}">
      <div class="abo-info">
        <div class="abo-nom">${r.nom}</div>
      </div>
      <span class="abo-montant text-green">+${formatEuro(r.montant, 2)}</span>
    </div>`).join('');

  list.querySelectorAll('.abo-row-clickable').forEach((row) => {
    row.addEventListener('click', () => {
      const revenu = getRevenus().find((r) => r.id === row.dataset.id);
      if (revenu) openEditRevenuModal(revenu);
    });
  });
}

function openEditRevenuModal(revenu) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">Modifier le revenu</div>
      <input type="text" class="modal-input" id="edit-revenu-nom" value="${(revenu.nom || '').replace(/"/g, '&quot;')}" placeholder="Nom">
      <input type="number" class="modal-input" id="edit-revenu-montant" value="${revenu.montant}" step="0.01" min="0" inputmode="decimal" placeholder="Montant mensuel (€)">
      <div class="modal-actions">
        <button class="btn btn-danger" data-act="delete">Supprimer</button>
        <button class="btn btn-outline" data-act="cancel">Annuler</button>
      </div>
      <button class="btn btn-primary btn-block" style="margin-top:10px;" data-act="ok">Enregistrer</button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-act="delete"]').addEventListener('click', async () => {
    const ok = await showConfirm('Supprimer cette source de revenu ?', { danger: true });
    if (!ok) return;
    saveRevenus(getRevenus().filter((r) => r.id !== revenu.id));
    overlay.remove();
    showToast('Revenu supprimé');
    renderRevenus();
  });
  overlay.querySelector('[data-act="ok"]').addEventListener('click', () => {
    const nom = document.getElementById('edit-revenu-nom').value.trim();
    const montant = parseFloat(document.getElementById('edit-revenu-montant').value);
    if (!nom || !montant || montant <= 0) { showToast('Formulaire incomplet', 'error'); return; }
    saveRevenus(getRevenus().map((r) => (r.id === revenu.id ? { ...r, nom, montant } : r)));
    overlay.remove();
    showToast('Revenu modifié ✓');
    renderRevenus();
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

function buildMoisPrelevementSelect() {
  return MOIS_NOMS.map((nom, i) => `<option value="${i + 1}">${nom}</option>`).join('');
}

function ajouterAbonnement(e) {
  e.preventDefault();
  const nom = document.getElementById('abo-nom').value.trim();
  const montant = parseFloat(document.getElementById('abo-montant').value);
  const categorie = document.getElementById('abo-cat').value;
  const frequence = document.getElementById('abo-frequence').value;
  const moisPrelevement = parseInt(document.getElementById('abo-mois-prelevement').value, 10);

  if (!nom || !montant || montant <= 0) {
    showToast('Formulaire incomplet', 'error');
    return;
  }

  const abo = { id: uid('abo'), nom, montant, categorie, frequence, actif: true, created_at: Date.now() };
  if (frequence === 'annuel') abo.mois_prelevement = moisPrelevement;
  const abos = getAbonnements();
  abos.push(abo);
  saveAbonnements(abos);

  document.getElementById('abo-form').reset();
  document.getElementById('abo-mois-prelevement').classList.add('hidden');
  document.getElementById('abo-form-wrap').classList.add('hidden');
  showToast('Abonnement ajouté ✓');
  renderAbonnements();
}

window.refreshAbonnements = function refreshAbonnements() {
  renderRevenus();
  renderAbonnements();
  renderPourcentageCard();
};

document.addEventListener('DOMContentLoaded', () => {
  const catSelect = document.getElementById('abo-cat');
  if (catSelect) catSelect.innerHTML = buildAboCategorieSelect();

  const moisPrelevementSelect = document.getElementById('abo-mois-prelevement');
  if (moisPrelevementSelect) moisPrelevementSelect.innerHTML = buildMoisPrelevementSelect();

  const frequenceSelect = document.getElementById('abo-frequence');
  if (frequenceSelect) {
    frequenceSelect.addEventListener('change', () => {
      moisPrelevementSelect.classList.toggle('hidden', frequenceSelect.value !== 'annuel');
    });
  }

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

  const pourcentageBtn = document.getElementById('btn-configurer-pourcentage');
  if (pourcentageBtn) pourcentageBtn.addEventListener('click', configurerPourcentage);
});
