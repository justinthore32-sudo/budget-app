/* ============================================
   BUDGET APP — utils.js
   Stockage localStorage, catégories, formatage,
   toast, modales (remplacent prompt/confirm/alert
   natifs — bloqués en PWA standalone iOS).
   ============================================ */

const CATEGORIES = {
  alimentation: { label: 'Alimentation', icon: '🍎', color: 'var(--cat-alimentation)' },
  transport: { label: 'Transport', icon: '🚗', color: 'var(--cat-transport)' },
  logement: { label: 'Logement', icon: '🏠', color: 'var(--cat-logement)' },
  loisirs: { label: 'Loisirs', icon: '🎬', color: 'var(--cat-loisirs)' },
  sport: { label: 'Sport', icon: '💪', color: 'var(--cat-sport)' },
  shopping: { label: 'Shopping', icon: '🛍️', color: 'var(--cat-shopping)' },
  sante: { label: 'Santé', icon: '💊', color: 'var(--cat-sante)' },
  investissement: { label: 'Investissement', icon: '🪙', color: 'var(--cat-investissement)' },
  autres: { label: 'Autres', icon: '📦', color: 'var(--cat-autres)' }
};

const DEFAULT_BUDGET_PREVISIONNEL = {
  alimentation: 300, transport: 120, logement: 500, loisirs: 150,
  sport: 50, shopping: 100, sante: 50, investissement: 100, autres: 100
};

const DEFAULT_ABONNEMENTS = [
  { nom: 'Loyer', montant: 500, categorie: 'logement' },
  { nom: 'Charges appart', montant: 100, categorie: 'logement' },
  { nom: 'Téléphone', montant: 20, categorie: 'autres' },
  { nom: 'Internet', montant: 30, categorie: 'autres' },
  { nom: 'Netflix / Streaming', montant: 15, categorie: 'loisirs' },
  { nom: 'Assurance voiture', montant: 50, categorie: 'transport' }
];

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ---------- GETTERS / SETTERS ---------- */
const getDepenses = () => JSON.parse(localStorage.getItem('budget_depenses') || '[]');
const saveDepenses = (deps) => localStorage.setItem('budget_depenses', JSON.stringify(deps));

const getBudgetPrevisionnel = () => {
  const raw = localStorage.getItem('budget_previsionnel');
  return raw ? JSON.parse(raw) : { ...DEFAULT_BUDGET_PREVISIONNEL };
};
const saveBudgetPrevisionnel = (b) => localStorage.setItem('budget_previsionnel', JSON.stringify(b));

const getAbonnements = () => JSON.parse(localStorage.getItem('budget_abonnements') || '[]');
const saveAbonnements = (abos) => localStorage.setItem('budget_abonnements', JSON.stringify(abos));

const getComptes = () => {
  const raw = localStorage.getItem('budget_comptes');
  return raw ? JSON.parse(raw) : { cb: { solde: 0, historique: [] }, especes: { solde: 0, historique: [] } };
};
const saveComptes = (c) => localStorage.setItem('budget_comptes', JSON.stringify(c));

const getParams = () => {
  const raw = localStorage.getItem('budget_params');
  return raw ? JSON.parse(raw) : null;
};
const saveParams = (p) => localStorage.setItem('budget_params', JSON.stringify(p));

const isOnboarded = () => !!getParams();

/* ---------- REVENUS (sources multiples : salaire, revenu foncier, etc.) ---------- */
const getRevenus = () => {
  const params = getParams();
  return params?.revenus || [];
};
const saveRevenus = (revenus) => {
  const params = getParams() || {};
  params.revenus = revenus;
  saveParams(params);
};
const getTotalRevenus = () => getRevenus().reduce((s, r) => s + r.montant, 0);

/* ---------- HELPERS MÉTIER ---------- */
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function currentMonthKey() {
  return todayISO().slice(0, 7);
}

const getDepensesMois = (mois) => getDepenses().filter((d) => d.date.startsWith(mois));
const getTotalCategorieMois = (cat, mois) =>
  getDepensesMois(mois).filter((d) => d.categorie === cat).reduce((s, d) => s + d.montant, 0);
const getTotalMois = (mois) => getDepensesMois(mois).reduce((s, d) => s + d.montant, 0);

function saveDepense(dep) {
  const deps = getDepenses();
  deps.push(dep);
  saveDepenses(deps);
}

function updateSolde(compte, montant, label) {
  const comptes = getComptes();
  comptes[compte].solde += montant;
  comptes[compte].historique.push({
    date: new Date().toISOString(),
    montant,
    type: montant >= 0 ? 'credit' : 'debit',
    label: label || 'Ajustement'
  });
  saveComptes(comptes);
}

function getAbonnementsMensuelTotal() {
  return getAbonnements().filter((a) => a.actif).reduce((s, a) => s + a.montant, 0);
}

function getBudgetMensuelTotal() {
  const b = getBudgetPrevisionnel();
  return Object.values(b).reduce((s, v) => s + v, 0);
}

/* ---------- BUDGET EN % DU SALAIRE ----------
   Le salaire n'est jamais le même d'un mois à l'autre : au lieu d'un
   budget fixe en euros par catégorie, on définit une répartition en %
   (calculée une fois à partir d'un salaire de référence), puis on
   l'applique chaque mois au salaire réellement saisi ce mois-là. */
const getSalaireType = () => getParams()?.salaire_type || 0;
function saveSalaireType(v) {
  const params = getParams() || {};
  params.salaire_type = v;
  saveParams(params);
}

const getPourcentages = () => JSON.parse(localStorage.getItem('budget_pourcentages') || 'null');
const savePourcentages = (p) => localStorage.setItem('budget_pourcentages', JSON.stringify(p));
const isBudgetPourcentageActif = () => !!getPourcentages();

const getSalairesMensuels = () => JSON.parse(localStorage.getItem('budget_salaires_mensuels') || '{}');
function saveSalaireMois(mois, montant) {
  const salaires = getSalairesMensuels();
  salaires[mois] = montant;
  localStorage.setItem('budget_salaires_mensuels', JSON.stringify(salaires));
}

/* Salaire à utiliser pour un mois donné : celui saisi ce mois-ci, sinon
   le dernier salaire connu avant ce mois, sinon le salaire de référence. */
function getSalaireEffectifMois(mois) {
  const salaires = getSalairesMensuels();
  if (salaires[mois] != null) return salaires[mois];
  const moisConnus = Object.keys(salaires).filter((m) => m <= mois).sort();
  if (moisConnus.length > 0) return salaires[moisConnus[moisConnus.length - 1]];
  return getSalaireType();
}

/* Calcule la répartition en % de chaque catégorie par rapport à un
   salaire de référence, à partir des montants déjà définis dans le
   budget prévisionnel (fixe) — appelé une fois à l'activation. */
function calculerPourcentagesDepuisBudget(salaireType) {
  const budget = getBudgetPrevisionnel();
  const pourcentages = {};
  Object.entries(budget).forEach(([cat, montant]) => {
    pourcentages[cat] = salaireType > 0 ? (montant / salaireType) * 100 : 0;
  });
  return pourcentages;
}

/* Budget prévisionnel effectif d'un mois donné : si le mode % est actif,
   dérivé du salaire de ce mois ; sinon le budget fixe classique. */
function getBudgetPrevisionnelMois(mois) {
  const pourcentages = getPourcentages();
  if (!pourcentages) return getBudgetPrevisionnel();
  const salaireMois = getSalaireEffectifMois(mois);
  const budget = {};
  Object.keys(CATEGORIES).forEach((cat) => {
    budget[cat] = ((pourcentages[cat] || 0) / 100) * salaireMois;
  });
  return budget;
}

function getBudgetMensuelTotalMois(mois) {
  return Object.values(getBudgetPrevisionnelMois(mois)).reduce((s, v) => s + v, 0);
}

/* Modifie manuellement le budget d'une catégorie pour le mois affiché :
   si le mode % est actif, on recalcule le % correspondant (à partir du
   salaire effectif de ce mois) pour que la modification reste cohérente
   les mois suivants ; sinon on modifie directement le montant fixe. */
function setBudgetCategorieMois(cat, montant, mois) {
  const pourcentages = getPourcentages();
  if (pourcentages) {
    const salaireMois = getSalaireEffectifMois(mois) || 0;
    pourcentages[cat] = salaireMois > 0 ? (montant / salaireMois) * 100 : 0;
    savePourcentages(pourcentages);
  } else {
    const budget = getBudgetPrevisionnel();
    budget[cat] = montant;
    saveBudgetPrevisionnel(budget);
  }
}

/* ---------- MIGRATION : ancien modèle "Salaire" dans la liste des revenus ----------
   Avant la séparation salaire/autres revenus, l'onboarding créait une entrée
   "Salaire" générique dans `revenus`. La garder telle quelle ferait compter
   le salaire deux fois (une fois via `revenus`, une fois via le salaire
   mensuel suivi séparément). Migration automatique, une seule fois. */
function migrateSalaireModel() {
  const params = getParams();
  if (!params || params.migrated_salaire_v2) return;

  const revenus = params.revenus || [];
  const salaireIndex = revenus.findIndex((r) => (r.nom || '').trim().toLowerCase() === 'salaire');

  if (salaireIndex !== -1) {
    const salaireMontant = revenus[salaireIndex].montant;
    params.revenus = revenus.filter((_, i) => i !== salaireIndex);
    params.salaire_type = salaireMontant;

    const mois = currentMonthKey();
    const salaires = getSalairesMensuels();
    if (salaires[mois] == null) saveSalaireMois(mois, salaireMontant);

    if (getPourcentages()) savePourcentages(calculerPourcentagesDepuisBudget(salaireMontant));
  }

  params.migrated_salaire_v2 = true;
  saveParams(params);
}

/* ---------- REVENU EFFECTIF DU MOIS (salaire variable + autres revenus fixes) ---------- */
function getRevenuMensuelEffectif(mois) {
  return getSalaireEffectifMois(mois) + getTotalRevenus();
}

/* ---------- FORMATAGE ---------- */
function formatEuro(n, decimals = 2) {
  const v = Number(n) || 0;
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}€`;
}

function formatDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

const MONTH_ABBR = ['jan', 'fév', 'mar', 'avr', 'mai', 'jun', 'jul', 'aoû', 'sep', 'oct', 'nov', 'déc'];
function formatMonthAbbr(mois) {
  const m = parseInt(mois.split('-')[1], 10);
  return MONTH_ABBR[m - 1];
}

function formatMonthLabel(mois) {
  const [y, m] = mois.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/* ---------- TOAST ---------- */
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}

/* ---------- MODALES (remplacent prompt/confirm natifs) ---------- */
function showConfirm(message, { danger = false } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay center';
    overlay.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-title">${message}</div>
        <div class="modal-actions">
          <button class="btn btn-outline" data-act="cancel">Annuler</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">Confirmer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.remove(); resolve(false); }
    });
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => { overlay.remove(); resolve(false); });
    overlay.querySelector('[data-act="ok"]').addEventListener('click', () => { overlay.remove(); resolve(true); });
  });
}

function showAmountPrompt(title, { placeholder = '0.00' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-title">${title}</div>
        <input type="number" inputmode="decimal" step="0.01" min="0" class="modal-input" placeholder="${placeholder}" id="modal-amount-input">
        <div class="modal-actions">
          <button class="btn btn-outline" data-act="cancel">Annuler</button>
          <button class="btn btn-primary" data-act="ok">Valider</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#modal-amount-input');
    setTimeout(() => input.focus(), 50);

    const close = (value) => { overlay.remove(); resolve(value); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    overlay.querySelector('[data-act="ok"]').addEventListener('click', () => {
      const v = parseFloat(input.value);
      close(!v || v <= 0 ? null : v);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') overlay.querySelector('[data-act="ok"]').click();
    });
  });
}

function showTextPrompt(title, { type = 'text', placeholder = '', minLength = 0 } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay center';
    overlay.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-title">${title}</div>
        <input type="${type}" class="modal-input" placeholder="${placeholder}" id="modal-text-input" autocomplete="new-password">
        <div class="modal-actions">
          <button class="btn btn-outline" data-act="cancel">Annuler</button>
          <button class="btn btn-primary" data-act="ok">Valider</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#modal-text-input');
    setTimeout(() => input.focus(), 50);

    const close = (value) => { overlay.remove(); resolve(value); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
    overlay.querySelector('[data-act="ok"]').addEventListener('click', () => {
      const v = input.value.trim();
      close(v.length < minLength ? null : v);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') overlay.querySelector('[data-act="ok"]').click();
    });
  });
}

/* ---------- EXPORT / IMPORT DONNÉES ---------- */
function exportData() {
  const data = {
    budget_depenses: getDepenses(),
    budget_previsionnel: getBudgetPrevisionnel(),
    budget_abonnements: getAbonnements(),
    budget_comptes: getComptes(),
    budget_params: getParams(),
    exported_at: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget-export-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Export téléchargé ✓');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.budget_depenses) saveDepenses(data.budget_depenses);
      if (data.budget_previsionnel) saveBudgetPrevisionnel(data.budget_previsionnel);
      if (data.budget_abonnements) saveAbonnements(data.budget_abonnements);
      if (data.budget_comptes) saveComptes(data.budget_comptes);
      if (data.budget_params) saveParams(data.budget_params);
      showToast('Import réussi ✓');
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      showToast('Fichier invalide', 'error');
    }
  };
  reader.readAsText(file);
}
