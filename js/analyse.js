/* ============================================
   BUDGET APP — analyse.js
   Page 6 — Analyse IA (Claude, via Worker proxy).
   ============================================ */

function buildAnalysePromptData() {
  const mois = currentMonthKey();
  const depensesMois = {};
  Object.keys(CATEGORIES).forEach((cat) => { depensesMois[cat] = getTotalCategorieMois(cat, mois); });
  const budgetPrev = getBudgetPrevisionnelMois(mois);
  const abonnements = getAbonnements().filter((a) => a.actif);
  const revenus = getRevenus();

  return { depensesMois, budgetPrev, abonnements, revenus };
}

function buildSystemPrompt() {
  return `Tu es un conseiller financier personnel pour ${getParams()?.prenom || 'l'}'utilisateur.
Analyse ses dépenses du mois et donne des conseils concrets et actionnables.
Anticipe activement ce qui est susceptible de se passer si rien ne change, ne te contente pas de décrire le passé.
Réponds STRICTEMENT en JSON valide (rien d'autre, pas de texte avant/après, pas de markdown), avec ce format exact :
{
  "bilan": "positif|negatif|equilibre",
  "points_positifs": ["point 1", "point 2"],
  "points_ameliorer": ["point 1", "point 2"],
  "conseils": ["conseil actionnable 1", "conseil 2", "conseil 3"],
  "projection": "Si même rythme, description concrète de la situation en fin de mois puis fin d'année",
  "score_budget": 75
}`;
}

function renderScoreRing(score) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  return `
    <svg viewBox="0 0 100 100" width="120" height="120">
      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="10"/>
      <circle cx="50" cy="50" r="42" fill="none" stroke="${color}" stroke-width="10"
        stroke-dasharray="${2 * Math.PI * 42}" stroke-dashoffset="${2 * Math.PI * 42 * (1 - score / 100)}"
        stroke-linecap="round" transform="rotate(-90 50 50)"/>
    </svg>`;
}

function renderAnalyseResult(result) {
  const bilanLabel = { positif: '✅ Positif', negatif: '⚠️ À surveiller', equilibre: '⚖️ Équilibré' }[result.bilan] || result.bilan;

  document.getElementById('analyse-result').innerHTML = `
    <div class="card" style="text-align:center;">
      <div class="score-ring-wrap" style="position:relative;">
        ${renderScoreRing(result.score_budget || 0)}
        <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <span class="score-num">${result.score_budget ?? '—'}</span>
          <span class="text3" style="font-size:10px;">/ 100</span>
        </div>
      </div>
      <div class="bilan-badge ${result.bilan === 'positif' ? 'vert' : result.bilan === 'negatif' ? 'rouge' : 'orange'}" style="margin-top:12px;">${bilanLabel}</div>
    </div>

    <div class="card analyse-block">
      <h3 class="text-green">Points positifs</h3>
      ${(result.points_positifs || []).map((p) => `<div class="analyse-list-item">${p}</div>`).join('') || '<span class="text3">—</span>'}
    </div>

    <div class="card analyse-block">
      <h3 class="text-gold">À améliorer</h3>
      ${(result.points_ameliorer || []).map((p) => `<div class="analyse-list-item">${p}</div>`).join('') || '<span class="text3">—</span>'}
    </div>

    <div class="card analyse-block">
      <h3 class="text2">Projection</h3>
      <p style="font-size:13px; color:var(--text2);">${result.projection || '—'}</p>
    </div>

    <div class="card analyse-block">
      <h3 class="text2">3 conseils actionnables</h3>
      ${(result.conseils || []).map((c) => `<div class="conseil-card">${c}</div>`).join('')}
    </div>`;
}

function parseClaudeJson(text) {
  const cleaned = text.replace(/```json\s*|```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}

async function lancerAnalyse() {
  const btn = document.getElementById('btn-analyser');
  const loading = document.getElementById('analyse-loading');
  const resultEl = document.getElementById('analyse-result');
  const introEl = document.getElementById('analyse-intro');

  btn.disabled = true;
  loading.classList.remove('hidden');
  resultEl.innerHTML = '';
  introEl.classList.add('hidden');

  try {
    const { depensesMois, budgetPrev, abonnements, revenus } = buildAnalysePromptData();
    const totalRevenus = revenus.reduce((s, r) => s + r.montant, 0);
    const userPrompt = `REVENUS MENSUELS (total ${totalRevenus}€) :
${revenus.map((r) => `- ${r.nom} : ${r.montant}€`).join('\n') || '- Non renseigné'}

DÉPENSES PAR CATÉGORIE CE MOIS :
${JSON.stringify(depensesMois, null, 2)}

BUDGET PRÉVU PAR CATÉGORIE :
${JSON.stringify(budgetPrev, null, 2)}

ABONNEMENTS FIXES : ${abonnements.reduce((s, a) => s + a.montant, 0)}€/mois`;

    const data = await callClaude([{ role: 'user', content: userPrompt }], { system: buildSystemPrompt(), maxTokens: 800 });
    const text = data.content?.[0]?.text || '';
    const result = parseClaudeJson(text);
    renderAnalyseResult(result);
  } catch (err) {
    const message = err.message === 'not_configured'
      ? "L'analyse IA n'est pas encore configurée côté serveur (clé API manquante)."
      : `Erreur lors de l'analyse : ${err.message}`;
    resultEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${message}</p></div>`;
  } finally {
    btn.disabled = false;
    loading.classList.add('hidden');
  }
}

window.refreshAnalyse = function refreshAnalyse() {
  /* rien à précharger — déclenché par le bouton */
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-analyser')?.addEventListener('click', lancerAnalyse);
});
