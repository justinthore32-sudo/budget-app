/* ============================================
   BUDGET APP — comptes.js
   Page 5 — Comptes (CB + Espèces).
   ============================================ */

let comptesLineChart = null;

const COMPTE_LABELS = { cb: 'Carte bancaire', especes: 'Espèces', investissement: 'Investissement' };

function renderComptesCards() {
  const comptes = getComptes();
  document.getElementById('solde-cb').textContent = formatEuro(comptes.cb.solde);
  document.getElementById('solde-especes').textContent = formatEuro(comptes.especes.solde);
  document.getElementById('solde-investissement').textContent = formatEuro(comptes.investissement.solde);
  document.getElementById('patrimoine-total').textContent = formatEuro(comptes.cb.solde + comptes.especes.solde + comptes.investissement.solde);
}

async function ajusterSolde(compte, type) {
  const label = type === 'add' ? 'Ajouter' : 'Retirer';
  const montant = await showAmountPrompt(`${label} — ${COMPTE_LABELS[compte]}`);
  if (!montant) return;
  const ajustement = type === 'add' ? montant : -montant;
  updateSolde(compte, ajustement, 'Ajustement manuel');
  showToast('Solde mis à jour ✓');
  renderComptesCards();
  renderHeaderSoldes();
  renderComptesLineChart();
}

function renderObjectifs() {
  const comptes = getComptes();
  ['cb', 'especes', 'investissement'].forEach((compte) => {
    const el = document.getElementById(`objectif-${compte}`);
    if (!el) return;
    const objectif = getObjectifCompte(compte);
    const solde = comptes[compte].solde;

    if (!objectif) {
      el.innerHTML = `<button class="btn-expand objectif-link" data-set-objectif="${compte}">🎯 Définir un objectif</button>`;
    } else {
      const pct = objectif.montant > 0 ? Math.min(100, (solde / objectif.montant) * 100) : 0;
      const atteint = solde >= objectif.montant;
      const moisRestants = moisRestantsJusqua(objectif.echeance);
      const manque = Math.max(0, objectif.montant - solde);
      const parMois = manque / moisRestants;
      el.innerHTML = `
        <div class="objectif-block">
          <div class="objectif-header">
            <span>🎯 ${formatEuro(objectif.montant, 0)} d'ici ${formatMonthLabel(objectif.echeance)}</span>
            <button class="btn-expand" data-set-objectif="${compte}" style="color:var(--text3); font-size:11px;">Modifier</button>
          </div>
          <div class="progress-bar"><div class="progress-fill ${atteint ? 'vert' : 'orange'}" style="width:${pct}%"></div></div>
          <div class="objectif-sub">${atteint ? '🎉 Objectif atteint' : `Il te faut ${formatEuro(parMois, 0)}/mois`}</div>
        </div>`;
    }

    el.querySelectorAll('[data-set-objectif]').forEach((btn) => {
      btn.addEventListener('click', () => openObjectifModal(btn.dataset.setObjectif));
    });
  });
}

function openObjectifModal(compte) {
  const existing = getObjectifCompte(compte);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">Objectif — ${COMPTE_LABELS[compte]}</div>
      <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; color:var(--text2); margin-bottom:6px;">Combien veux-tu avoir sur ce compte ?</label>
      <input type="number" class="modal-input" id="objectif-montant" placeholder="Ex : 5000" inputmode="decimal" step="0.01" min="0" value="${existing ? existing.montant : ''}">
      <label style="display:block; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; color:var(--text2); margin-bottom:6px;">D'ici quel mois ?</label>
      <input type="month" class="modal-input" id="objectif-echeance" value="${existing ? existing.echeance : ''}">
      <div class="modal-actions">
        ${existing ? '<button class="btn btn-danger" data-act="remove">Supprimer</button>' : '<button class="btn btn-outline" data-act="cancel">Annuler</button>'}
        <button class="btn btn-primary" data-act="ok">Enregistrer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('[data-act="cancel"]')?.addEventListener('click', () => overlay.remove());
  overlay.querySelector('[data-act="remove"]')?.addEventListener('click', () => {
    saveObjectifCompte(compte, null);
    overlay.remove();
    showToast('Objectif supprimé');
    renderObjectifs();
  });
  overlay.querySelector('[data-act="ok"]').addEventListener('click', () => {
    const montant = parseFloat(document.getElementById('objectif-montant').value);
    const echeance = document.getElementById('objectif-echeance').value;
    if (!montant || montant <= 0 || !echeance) {
      showToast('Formulaire incomplet', 'error');
      return;
    }
    saveObjectifCompte(compte, { montant, echeance });
    overlay.remove();
    showToast('Objectif enregistré ✓');
    renderObjectifs();
  });
}

function renderComptesLineChart() {
  const ctx = document.getElementById('comptes-line-chart');
  if (!ctx || typeof Chart === 'undefined') return;

  const comptes = getComptes();
  const days = 30;
  const labels = [];
  const data = [];
  let running = comptes.cb.solde;

  /* comptes.cb.historique capture déjà les dépenses (via updateSolde) —
     ne pas re-fusionner avec getDepenses(), ça compterait chaque mouvement deux fois. */
  const events = (comptes.cb.historique || []).map((h) => ({ date: new Date(h.date), montant: h.montant }));

  const dayBuckets = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    dayBuckets.unshift(d);
  }

  const soldeParJour = dayBuckets.map((day) => day);
  const results = new Array(days).fill(null);
  results[days - 1] = running;
  for (let i = days - 2; i >= 0; i -= 1) {
    const nextDay = dayBuckets[i + 1];
    const netThatDay = events.filter((e) => e.date.toDateString() === nextDay.toDateString()).reduce((s, e) => s + e.montant, 0);
    running -= netThatDay;
    results[i] = running;
  }

  dayBuckets.forEach((d) => labels.push(d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })));

  if (comptesLineChart) comptesLineChart.destroy();
  comptesLineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: results,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.12)',
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: 'rgba(240,244,255,0.4)', font: { size: 9 }, maxTicksLimit: 6 }, grid: { display: false } },
        y: { ticks: { color: 'rgba(240,244,255,0.4)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

window.refreshComptes = function refreshComptes() {
  renderComptesCards();
  renderComptesLineChart();
};

window.refreshObjectif = function refreshObjectif() {
  renderObjectifs();
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cb-add')?.addEventListener('click', () => ajusterSolde('cb', 'add'));
  document.getElementById('cb-sub')?.addEventListener('click', () => ajusterSolde('cb', 'sub'));
  document.getElementById('esp-add')?.addEventListener('click', () => ajusterSolde('especes', 'add'));
  document.getElementById('esp-sub')?.addEventListener('click', () => ajusterSolde('especes', 'sub'));
  document.getElementById('inv-add')?.addEventListener('click', () => ajusterSolde('investissement', 'add'));
  document.getElementById('inv-sub')?.addEventListener('click', () => ajusterSolde('investissement', 'sub'));
});
