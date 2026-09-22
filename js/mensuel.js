/* ============================================
   BUDGET APP — mensuel.js
   Page 2 — Récap mensuel par catégorie.
   ============================================ */

let moisActuel = null;
let donutChart = null;

function shiftMois(mois, delta) {
  const [y, m] = mois.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function renderPrevisionnelMois() {
  const container = document.getElementById('previsionnel-mois-lines');
  if (!container) return;

  const revenus = getRevenuMensuelEffectif(moisActuel);
  const chargesFixes = getAbonnementsMensuelTotal();
  const budgetAlloue = getBudgetMensuelTotalMois(moisActuel);
  const depensesVariables = getTotalMois(moisActuel);
  const previsionnel = revenus - chargesFixes - budgetAlloue;
  const resteAVivre = revenus - chargesFixes - depensesVariables;

  container.innerHTML = `
    <div class="previsionnel-line"><span>Revenus</span><span class="val text-green">+${formatEuro(revenus, 0)}</span></div>
    <div class="previsionnel-line"><span>Charges fixes (abonnements)</span><span class="val text-red">−${formatEuro(chargesFixes, 0)}</span></div>
    <div class="previsionnel-line"><span>Budget alloué (catégories)</span><span class="val text-red">−${formatEuro(budgetAlloue, 0)}</span></div>
    <div class="previsionnel-line total"><span>Prévisionnel (si budget respecté)</span><span class="val ${previsionnel >= 0 ? 'text-green' : 'text-red'}">${formatEuro(previsionnel, 0)}</span></div>
    <div class="previsionnel-line" style="margin-top:8px; padding-top:10px; border-top:1px solid var(--border);"><span>Dépenses réelles à ce jour</span><span class="val text-red">−${formatEuro(depensesVariables, 0)}</span></div>
    <div class="previsionnel-line total"><span>Reste à vivre (réel)</span><span class="val ${resteAVivre >= 0 ? 'text-green' : 'text-red'}">${formatEuro(resteAVivre, 0)}</span></div>`;
}

function renderSalaireBanner() {
  const banner = document.getElementById('salaire-mois-banner');
  if (!banner) return;

  banner.classList.remove('hidden');
  const salaires = getSalairesMensuels();
  const saisi = salaires[moisActuel];

  banner.innerHTML = saisi != null
    ? `<span>💰 Salaire de ${formatMonthLabel(moisActuel)} : <strong class="mono">${formatEuro(saisi, 0)}</strong></span><button id="btn-edit-salaire-mois" class="btn-expand" style="color:var(--green);">Modifier</button>`
    : `<span>💰 Quel est ton salaire pour ${formatMonthLabel(moisActuel)} ?</span><button id="btn-edit-salaire-mois" class="btn-expand" style="color:var(--green);">Renseigner</button>`;

  document.getElementById('btn-edit-salaire-mois').addEventListener('click', async () => {
    const premiereFois = saisi == null;
    const montant = await showAmountPrompt(`Salaire — ${formatMonthLabel(moisActuel)}`, { placeholder: String(getSalaireType() || '0.00') });
    if (!montant) return;
    saveSalaireMois(moisActuel, montant);

    /* Le salaire n'est qu'un chiffre prévisionnel tant qu'il n'est pas
       crédité sur un vrai compte — sinon un virement vers Investissement
       débite un CB qui n'a jamais reçu cet argent. On ne propose le
       crédit qu'à la première saisie du mois (pas à chaque correction,
       pour éviter de créditer deux fois). */
    if (premiereFois) {
      const compte = await showCompteChoicePrompt(`Créditer ces ${formatEuro(montant, 0)} sur un compte ?`);
      if (compte) updateSolde(compte, montant, `Salaire — ${formatMonthLabel(moisActuel)}`);
    }

    showToast('Salaire enregistré ✓');
    renderHeaderSoldes();
    window.refreshMensuel();
  });
}

function renderBilanGlobal() {
  const total = getTotalMois(moisActuel);
  const budget = getBudgetMensuelTotalMois(moisActuel);
  const pct = budget > 0 ? (total / budget) * 100 : 0;
  const status = pct < 80 ? 'vert' : pct < 100 ? 'orange' : 'rouge';
  const restant = budget - total;

  document.getElementById('bilan-montant').textContent = formatEuro(total, 0);
  document.getElementById('bilan-montant').className = `bilan-montant mono ${status === 'rouge' ? 'text-red' : status === 'orange' ? 'text-gold' : 'text-green'}`;
  document.getElementById('bilan-sub').textContent = `sur ${formatEuro(budget, 0)} prévu`;
  const badge = document.getElementById('bilan-badge');
  badge.className = `bilan-badge ${status}`;
  badge.textContent = restant >= 0 ? `${formatEuro(restant, 0)} restant` : `${formatEuro(Math.abs(restant), 0)} de dépassement`;
}

function renderDonut() {
  const ctx = document.getElementById('donut-chart');
  if (!ctx || typeof Chart === 'undefined') return;

  const entries = Object.keys(CATEGORIES).map((cat) => ({
    cat, total: getTotalCategorieMois(cat, moisActuel)
  })).filter((e) => e.total > 0);

  const wrap = ctx.closest('.chart-wrap');
  const empty = document.getElementById('donut-empty');
  if (entries.length === 0) {
    if (wrap) wrap.classList.add('hidden');
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (wrap) wrap.classList.remove('hidden');
  if (empty) empty.classList.add('hidden');

  if (donutChart) donutChart.destroy();
  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: entries.map((e) => CATEGORIES[e.cat].label),
      datasets: [{
        data: entries.map((e) => e.total),
        backgroundColor: entries.map((e) => getComputedStyle(document.documentElement).getPropertyValue(`--cat-${e.cat}`).trim() || '#64748b'),
        borderColor: '#0b0f1a',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: 'rgba(240,244,255,0.55)', boxWidth: 10, font: { size: 11 }, padding: 12 }
        }
      }
    }
  });
}

function renderCategorieBudgets() {
  const list = document.getElementById('cat-budget-list');
  const budget = getBudgetPrevisionnelMois(moisActuel);

  list.innerHTML = Object.entries(CATEGORIES).map(([cat, meta]) => {
    const depense = getTotalCategorieMois(cat, moisActuel);
    const b = budget[cat] || 0;
    const pct = b > 0 ? (depense / b) * 100 : (depense > 0 ? 100 : 0);
    const status = pct < 80 ? 'vert' : pct < 100 ? 'orange' : 'rouge';
    return `
      <div class="cat-budget-row">
        <div class="cat-info"><span class="cat-icon">${meta.icon}</span> ${meta.label}</div>
        <div class="progress-bar"><div class="progress-fill ${status}" style="width:${Math.min(pct, 100)}%"></div></div>
        <div class="cat-amounts">
          <span class="spent">${formatEuro(depense, 0)}</span>
          <span>/ ${formatEuro(b, 0)}</span>
        </div>
      </div>`;
  }).join('');
}

function renderTransactionsMois() {
  const list = document.getElementById('transactions-mois-list');
  const deps = getDepensesMois(moisActuel).slice().reverse();

  if (deps.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>Aucune transaction ce mois-ci.</p></div>`;
    return;
  }

  list.innerHTML = deps.map((d) => `
    <div class="depense-row depense-row-clickable" data-id="${d.id}">
      <div class="depense-row-left">
        <div class="depense-icon">${CATEGORIES[d.categorie]?.icon || '📦'}</div>
        <div class="depense-info">
          <span class="depense-desc">${d.description || CATEGORIES[d.categorie]?.label || 'Dépense'}</span>
          <span class="depense-meta">${formatDateShort(d.date)} · ${d.compte === 'cb' ? '💳' : '💵'}</span>
        </div>
      </div>
      <span class="depense-montant">-${formatEuro(d.montant)}</span>
    </div>`).join('');

  list.querySelectorAll('[data-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const dep = getDepenses().find((d) => d.id === row.dataset.id);
      if (dep) openEditDepenseModal(dep, () => { renderHeaderSoldes(); window.refreshMensuel(); });
    });
  });
}

function openEditBudgetsModal() {
  const budget = getBudgetPrevisionnelMois(moisActuel);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">Modifier le budget par catégorie</div>
      <div style="display:flex; flex-direction:column; gap:10px; max-height:50vh; overflow-y:auto; margin-bottom:14px;">
        ${Object.entries(CATEGORIES).map(([cat, meta]) => `
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="width:26px; text-align:center;">${meta.icon}</span>
            <span style="flex:1; font-size:13px; color:var(--text2);">${meta.label}</span>
            <input type="number" class="field-input" style="width:100px; text-align:right;" data-edit-budget-cat="${cat}" value="${Math.round(budget[cat] || 0)}" inputmode="decimal" step="0.01" min="0">
          </div>`).join('')}
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" data-act="cancel">Annuler</button>
        <button class="btn btn-primary" data-act="ok">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-act="ok"]').addEventListener('click', () => {
    overlay.querySelectorAll('[data-edit-budget-cat]').forEach((input) => {
      const montant = parseFloat(input.value) || 0;
      setBudgetCategorieMois(input.dataset.editBudgetCat, montant, moisActuel);
    });
    overlay.remove();
    showToast('Budget mis à jour ✓');
    window.refreshMensuel();
  });
}

window.refreshMensuel = function refreshMensuel() {
  if (!moisActuel) moisActuel = currentMonthKey();
  document.getElementById('mensuel-month-label').textContent = formatMonthLabel(moisActuel);
  renderSalaireBanner();
  renderPrevisionnelMois();
  renderBilanGlobal();
  renderDonut();
  renderCategorieBudgets();
  renderTransactionsMois();
};

document.addEventListener('DOMContentLoaded', () => {
  const prevBtn = document.getElementById('mensuel-prev');
  const nextBtn = document.getElementById('mensuel-next');
  if (prevBtn) prevBtn.addEventListener('click', () => { moisActuel = shiftMois(moisActuel || currentMonthKey(), -1); window.refreshMensuel(); });
  if (nextBtn) nextBtn.addEventListener('click', () => { moisActuel = shiftMois(moisActuel || currentMonthKey(), 1); window.refreshMensuel(); });

  const editBudgetsBtn = document.getElementById('btn-edit-budgets');
  if (editBudgetsBtn) editBudgetsBtn.addEventListener('click', openEditBudgetsModal);
});
