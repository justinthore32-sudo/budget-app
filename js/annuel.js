/* ============================================
   BUDGET APP — annuel.js
   Page 3 — Projection annuelle.
   ============================================ */

let barChart = null;
let lineChart = null;

function anneeActuelle() {
  return new Date().getFullYear();
}

function moisDeAnnee(annee) {
  return Array.from({ length: 12 }, (_, i) => `${annee}-${String(i + 1).padStart(2, '0')}`);
}

function getMoisEcoules() {
  const params = getParams();
  const debut = params?.mois_debut || currentMonthKey();
  const now = currentMonthKey();
  const moisAvecDonnees = moisDeAnnee(anneeActuelle()).filter((m) => m <= now && m >= debut && getDepensesMois(m).length > 0);
  return Math.max(1, moisAvecDonnees.length);
}

function getTotalDepensesAnnee(annee = anneeActuelle()) {
  return moisDeAnnee(annee).reduce((s, m) => s + getTotalMois(m), 0);
}

function calculerProjection() {
  const moisEcoules = getMoisEcoules();
  const totalActuel = getTotalDepensesAnnee();
  const moyenneMensuelle = totalActuel / moisEcoules;
  const moisRestants = Math.max(0, 12 - moisEcoules);
  const projectionRestante = moyenneMensuelle * moisRestants;
  const totalProjecete = totalActuel + projectionRestante;
  const budgetAnnuel = moisDeAnnee(anneeActuelle()).reduce((s, m) => s + getBudgetMensuelTotalMois(m), 0);
  const ecartPrevu = budgetAnnuel - totalProjecete;
  return { totalActuel, projectionFinAnnee: totalProjecete, budgetAnnuel, ecartPrevu, tendance: ecartPrevu >= 0 ? 'positif' : 'negatif' };
}

function renderResumeAnnuel() {
  const proj = calculerProjection();
  const economies = proj.budgetAnnuel - proj.totalActuel;
  document.getElementById('annuel-total').textContent = formatEuro(proj.totalActuel, 0);
  document.getElementById('annuel-budget').textContent = formatEuro(proj.budgetAnnuel, 0);
  const ecoEl = document.getElementById('annuel-economies');
  ecoEl.textContent = formatEuro(Math.abs(economies), 0);
  ecoEl.className = `stat-val mono ${economies >= 0 ? 'text-green' : 'text-red'}`;

  const projEl = document.getElementById('annuel-projection');
  projEl.textContent = `Si le rythme actuel continue, projection fin d'année : ${formatEuro(proj.projectionFinAnnee, 0)} (budget annuel ${formatEuro(proj.budgetAnnuel, 0)})`;
  const badge = document.getElementById('annuel-projection-badge');
  badge.textContent = proj.tendance === 'positif' ? `✓ ${formatEuro(proj.ecartPrevu, 0)} d'économie prévue` : `⚠ ${formatEuro(Math.abs(proj.ecartPrevu), 0)} de dépassement prévu`;
  badge.className = `bilan-badge ${proj.tendance === 'positif' ? 'vert' : 'rouge'}`;
}

function renderTopCategories() {
  const totals = Object.keys(CATEGORIES).map((cat) => ({
    cat,
    total: moisDeAnnee(anneeActuelle()).reduce((s, m) => s + getTotalCategorieMois(cat, m), 0)
  })).sort((a, b) => b.total - a.total).slice(0, 3);

  const list = document.getElementById('top-categories-list');
  if (totals.every((t) => t.total === 0)) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Pas encore assez de données.</p></div>`;
    return;
  }
  list.innerHTML = totals.map((t, i) => `
    <div class="top-cat-row">
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="top-cat-rank">${i + 1}</span>
        <span>${CATEGORIES[t.cat].icon} ${CATEGORIES[t.cat].label}</span>
      </div>
      <span class="mono" style="font-weight:700;">${formatEuro(t.total, 0)}</span>
    </div>`).join('');
}

function renderBarChart() {
  const ctx = document.getElementById('bar-chart-annuel');
  if (!ctx || typeof Chart === 'undefined') return;
  const mois = moisDeAnnee(anneeActuelle());
  const budgetsMensuels = mois.map((m) => getBudgetMensuelTotalMois(m));

  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: mois.map((m) => formatMonthAbbr(m)),
      datasets: [
        {
          label: 'Dépensé',
          data: mois.map((m) => getTotalMois(m)),
          backgroundColor: mois.map((m, i) => getTotalMois(m) > budgetsMensuels[i] ? 'rgba(239,68,68,0.75)' : 'rgba(16,185,129,0.75)'),
          borderRadius: 4
        },
        {
          label: 'Budget',
          data: budgetsMensuels,
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: 'rgba(240,244,255,0.55)', font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: 'rgba(240,244,255,0.4)', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: 'rgba(240,244,255,0.4)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function renderLineChart() {
  const ctx = document.getElementById('line-chart-solde');
  if (!ctx || typeof Chart === 'undefined') return;
  const mois = moisDeAnnee(anneeActuelle());
  const comptes = getComptes();
  const soldeActuel = comptes.cb.solde;

  const now = currentMonthKey();
  const netParMois = mois.map((m) => {
    const historiqueNet = (comptes.cb.historique || []).filter((h) => h.date.startsWith(m)).reduce((s, h) => s + h.montant, 0);
    const depensesNet = -getDepensesMois(m).filter((d) => d.compte === 'cb').reduce((s, d) => s + d.montant, 0);
    return m <= now ? historiqueNet + depensesNet : null;
  });

  const idxNow = mois.indexOf(now);
  const soldeParMois = new Array(12).fill(null);
  if (idxNow >= 0) {
    soldeParMois[idxNow] = soldeActuel;
    let running = soldeActuel;
    for (let i = idxNow - 1; i >= 0; i -= 1) {
      running -= (netParMois[i + 1] || 0);
      soldeParMois[i] = running;
    }
  }

  if (lineChart) lineChart.destroy();
  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: mois.map((m) => formatMonthAbbr(m)),
      datasets: [{
        label: 'Solde CB',
        data: soldeParMois,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.12)',
        fill: true,
        tension: 0.35,
        spanGaps: true,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: 'rgba(240,244,255,0.4)', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: 'rgba(240,244,255,0.4)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function renderRecapTable() {
  const mois = moisDeAnnee(anneeActuelle());
  const tbody = document.getElementById('recap-table-body');
  tbody.innerHTML = mois.map((m) => {
    const total = getTotalMois(m);
    const budgetMensuel = getBudgetMensuelTotalMois(m);
    const ecart = budgetMensuel - total;
    const statutIcon = total === 0 ? '—' : (ecart >= 0 ? '✅' : '⚠️');
    return `
      <tr>
        <td>${formatMonthLabel(m).split(' ')[0]}</td>
        <td class="mono">${formatEuro(total, 0)}</td>
        <td class="mono">${formatEuro(budgetMensuel, 0)}</td>
        <td class="mono ${ecart >= 0 ? 'text-green' : 'text-red'}">${ecart >= 0 ? '+' : ''}${formatEuro(ecart, 0)}</td>
        <td>${statutIcon}</td>
      </tr>`;
  }).join('');
}

window.refreshAnnuel = function refreshAnnuel() {
  renderResumeAnnuel();
  renderTopCategories();
  renderBarChart();
  renderLineChart();
  renderRecapTable();
};
