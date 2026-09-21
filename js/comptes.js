/* ============================================
   BUDGET APP — comptes.js
   Page 5 — Comptes (CB + Espèces).
   ============================================ */

let comptesLineChart = null;

function renderComptesCards() {
  const comptes = getComptes();
  document.getElementById('solde-cb').textContent = formatEuro(comptes.cb.solde);
  document.getElementById('solde-especes').textContent = formatEuro(comptes.especes.solde);
  document.getElementById('patrimoine-total').textContent = formatEuro(comptes.cb.solde + comptes.especes.solde);
}

async function ajusterSolde(compte, type) {
  const label = type === 'add' ? 'Ajouter' : 'Retirer';
  const montant = await showAmountPrompt(`${label} — ${compte === 'cb' ? 'Carte bancaire' : 'Espèces'}`);
  if (!montant) return;
  const ajustement = type === 'add' ? montant : -montant;
  updateSolde(compte, ajustement, 'Ajustement manuel');
  showToast('Solde mis à jour ✓');
  renderComptesCards();
  renderHeaderSoldes();
  renderHistorique();
  renderComptesLineChart();
}

function renderHistorique() {
  const comptes = getComptes();
  ['cb', 'especes'].forEach((compte) => {
    const list = document.getElementById(`historique-${compte}`);
    if (!list) return;

    const manuel = (comptes[compte].historique || []).map((h) => ({
      date: h.date, montant: h.montant, label: h.label
    }));
    const depenses = getDepenses().filter((d) => d.compte === compte).map((d) => ({
      date: d.created_at ? new Date(d.created_at).toISOString() : d.date, montant: -d.montant, label: d.description || CATEGORIES[d.categorie]?.label
    }));

    const all = [...manuel, ...depenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20);

    if (all.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">📄</div><p>Aucun mouvement.</p></div>`;
      return;
    }

    list.innerHTML = all.map((h) => `
      <div class="depense-row">
        <div class="depense-row-left">
          <div class="depense-info">
            <span class="depense-desc">${h.label || 'Mouvement'}</span>
            <span class="depense-meta">${formatDateShort(h.date)}</span>
          </div>
        </div>
        <span class="depense-montant ${h.montant >= 0 ? 'text-green' : ''}">${h.montant >= 0 ? '+' : ''}${formatEuro(h.montant)}</span>
      </div>`).join('');
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

  const events = [
    ...(comptes.cb.historique || []).map((h) => ({ date: new Date(h.date), montant: h.montant })),
    ...getDepenses().filter((d) => d.compte === 'cb').map((d) => ({ date: new Date(d.created_at || d.date), montant: -d.montant }))
  ];

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
  renderHistorique();
  renderComptesLineChart();
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cb-add')?.addEventListener('click', () => ajusterSolde('cb', 'add'));
  document.getElementById('cb-sub')?.addEventListener('click', () => ajusterSolde('cb', 'sub'));
  document.getElementById('esp-add')?.addEventListener('click', () => ajusterSolde('especes', 'add'));
  document.getElementById('esp-sub')?.addEventListener('click', () => ajusterSolde('especes', 'sub'));
});
