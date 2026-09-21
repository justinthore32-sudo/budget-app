/* ============================================
   BUDGET APP — app.js
   Navigation bottom-nav, onboarding premier
   lancement, header (date + soldes).
   ============================================ */

const PAGES = ['saisie', 'mensuel', 'annuel', 'abonnements', 'comptes', 'analyse'];
const PAGE_REFRESH = {
  saisie: () => window.refreshSaisie && window.refreshSaisie(),
  mensuel: () => window.refreshMensuel && window.refreshMensuel(),
  annuel: () => window.refreshAnnuel && window.refreshAnnuel(),
  abonnements: () => window.refreshAbonnements && window.refreshAbonnements(),
  comptes: () => window.refreshComptes && window.refreshComptes(),
  analyse: () => window.refreshAnalyse && window.refreshAnalyse()
};

function showPage(pageId) {
  PAGES.forEach((p) => {
    document.getElementById(`page-${p}`).classList.toggle('active', p === pageId);
    document.getElementById(`nav-${p}`).classList.toggle('active', p === pageId);
  });
  if (PAGE_REFRESH[pageId]) PAGE_REFRESH[pageId]();
}

function renderHeaderSoldes() {
  const comptes = getComptes();
  const cbEl = document.getElementById('header-solde-cb');
  const espEl = document.getElementById('header-solde-esp');
  if (cbEl) cbEl.textContent = formatEuro(comptes.cb.solde, 0);
  if (espEl) espEl.textContent = formatEuro(comptes.especes.solde, 0);
}

function renderHeaderDate() {
  const el = document.getElementById('header-date');
  if (!el) return;
  el.textContent = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/* ---------- ONBOARDING ---------- */
function buildOnboardingCatFields() {
  return Object.entries(CATEGORIES).map(([key, cat]) => `
    <div style="display:flex; align-items:center; gap:10px;">
      <span style="width:26px; text-align:center;">${cat.icon}</span>
      <span style="flex:1; font-size:13px; color:var(--text2);">${cat.label}</span>
      <input type="number" class="field-input" style="width:90px; text-align:right;" data-onboard-budget="${key}" value="${DEFAULT_BUDGET_PREVISIONNEL[key]}" inputmode="decimal">
    </div>`).join('');
}

function buildOnboardingAboFields() {
  return DEFAULT_ABONNEMENTS.map((a, i) => `
    <label style="display:flex; align-items:center; gap:10px;">
      <input type="checkbox" data-onboard-abo="${i}" checked>
      <span style="flex:1; font-size:13px; color:var(--text2);">${a.nom} · ${CATEGORIES[a.categorie].label}</span>
      <span class="mono" style="font-size:13px; color:var(--text);">${formatEuro(a.montant, 0)}</span>
    </label>`).join('');
}

function addOnboardRevenuRow(container, nom = '', montant = '') {
  const row = document.createElement('div');
  row.className = 'onboard-revenu-row';
  row.style.cssText = 'display:flex; gap:8px; align-items:center;';
  row.innerHTML = `
    <input type="text" class="field-input" placeholder="Salaire, revenu foncier…" style="flex:1;" data-revenu-nom value="${nom}">
    <input type="number" class="field-input" placeholder="Montant (€)" style="width:120px;" inputmode="decimal" step="0.01" min="0" data-revenu-montant value="${montant}">
    <button type="button" class="depense-delete" data-remove-revenu-row>✕</button>`;
  row.querySelector('[data-remove-revenu-row]').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function initOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');

  document.getElementById('onboard-cat-fields').innerHTML = buildOnboardingCatFields();
  document.getElementById('onboard-abo-fields').innerHTML = buildOnboardingAboFields();

  const revenusContainer = document.getElementById('onboard-revenus-fields');
  addOnboardRevenuRow(revenusContainer, 'Salaire');
  document.getElementById('btn-add-onboard-revenu').addEventListener('click', () => addOnboardRevenuRow(revenusContainer));

  document.getElementById('onboard-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const prenom = document.getElementById('onboard-prenom').value.trim() || 'Toi';
    const soldeCb = parseFloat(document.getElementById('onboard-solde-cb').value) || 0;
    const soldeEsp = parseFloat(document.getElementById('onboard-solde-esp').value) || 0;

    const revenus = [];
    revenusContainer.querySelectorAll('.onboard-revenu-row').forEach((row) => {
      const nom = row.querySelector('[data-revenu-nom]').value.trim();
      const montant = parseFloat(row.querySelector('[data-revenu-montant]').value);
      if (nom && montant > 0) revenus.push({ id: uid('rev'), nom, montant, created_at: Date.now() });
    });

    const budgetPrevisionnel = {};
    overlay.querySelectorAll('[data-onboard-budget]').forEach((input) => {
      budgetPrevisionnel[input.dataset.onboardBudget] = parseFloat(input.value) || 0;
    });

    const abonnements = [];
    overlay.querySelectorAll('[data-onboard-abo]').forEach((input) => {
      if (input.checked) {
        const src = DEFAULT_ABONNEMENTS[parseInt(input.dataset.onboardAbo, 10)];
        abonnements.push({ id: uid('abo'), nom: src.nom, montant: src.montant, categorie: src.categorie, actif: true, created_at: Date.now() });
      }
    });

    saveParams({ prenom, revenus, mois_debut: currentMonthKey() });
    saveBudgetPrevisionnel(budgetPrevisionnel);
    saveAbonnements(abonnements);
    saveComptes({ cb: { solde: soldeCb, historique: [] }, especes: { solde: soldeEsp, historique: [] } });

    overlay.remove();
    boot();
  });
}

function boot() {
  renderHeaderDate();
  renderHeaderSoldes();
  showPage('saisie');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!isOnboarded()) {
    initOnboarding();
    return;
  }
  boot();
});
