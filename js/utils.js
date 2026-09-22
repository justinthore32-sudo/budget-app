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

/* ---------- CATÉGORIES PERSONNALISÉES ----------
   Fusionnées dans CATEGORIES au chargement, pour apparaître partout
   (Saisie, Mensuel, Annuel, Abonnements) sans toucher le reste du code
   qui référence CATEGORIES directement. Couleur en hex littéral (pas
   une var CSS comme les catégories intégrées), palette tournante. */
const CUSTOM_CATEGORY_PALETTE = ['#f472b6', '#fb923c', '#a3e635', '#22d3ee', '#818cf8', '#e879f9', '#facc15', '#4ade80'];

function getCustomCategories() {
  return JSON.parse(localStorage.getItem('budget_categories_custom') || '{}');
}

function loadCustomCategories() {
  Object.assign(CATEGORIES, getCustomCategories());
}
loadCustomCategories();

function slugifyCategoryName(label) {
  return label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function addCustomCategory(label, icon) {
  const key = slugifyCategoryName(label) || uid('cat');
  if (CATEGORIES[key]) return null;
  const custom = getCustomCategories();
  const color = CUSTOM_CATEGORY_PALETTE[Object.keys(custom).length % CUSTOM_CATEGORY_PALETTE.length];
  const entry = { label, icon: icon || '📁', color };
  custom[key] = entry;
  localStorage.setItem('budget_categories_custom', JSON.stringify(custom));
  CATEGORIES[key] = entry;
  return key;
}

/* Résout la couleur d'une catégorie en valeur hex utilisable par
   Chart.js (qui dessine sur canvas et ne comprend pas var(--x)) — les
   catégories intégrées passent par la variable CSS, les catégories
   personnalisées sont déjà en hex littéral. */
function resolveCategoryColor(cat) {
  const color = CATEGORIES[cat]?.color || '#64748b';
  if (color.startsWith('var(')) {
    const varName = color.slice(4, -1).trim();
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#64748b';
  }
  return color;
}

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
  const comptes = raw ? JSON.parse(raw) : { cb: { solde: 0, historique: [] }, especes: { solde: 0, historique: [] } };
  if (!comptes.investissement) comptes.investissement = { solde: 0, historique: [] };
  return comptes;
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
/* Exclut "investissement" : ce n'est pas de l'argent consommé/parti,
   c'est un transfert vers un compte d'épargne (le compte investissement
   se crédite en parallèle) — le compter comme dépense ferait baisser à
   tort le "reste à vivre" et gonflerait le total dépensé mensuel/annuel
   chaque fois que l'utilisateur met de l'argent de côté. */
const getTotalMois = (mois) =>
  getDepensesMois(mois).filter((d) => d.categorie !== 'investissement').reduce((s, d) => s + d.montant, 0);

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

/* Une dépense en catégorie "investissement" n'est pas de l'argent qui
   disparaît : elle est débitée du compte payeur (CB/Espèces) ET créditée
   sur le compte "investissement", qui devient ainsi un vrai solde suivi
   (visible page Comptes), pas juste une ligne de dépense qui s'évapore. */
function applyDepenseEffect(dep) {
  updateSolde(dep.compte, -dep.montant, dep.description || CATEGORIES[dep.categorie]?.label);
  if (dep.categorie === 'investissement') {
    updateSolde('investissement', dep.montant, dep.description || 'Investissement');
  }
}

function reverseDepenseEffect(dep) {
  updateSolde(dep.compte, dep.montant, 'Annulation dépense');
  if (dep.categorie === 'investissement') {
    updateSolde('investissement', -dep.montant, 'Annulation investissement');
  }
}

/* Modification d'une dépense existante : ajuste chaque compte par le
   delta net plutôt que d'annuler puis réappliquer, pour ne pas polluer
   l'historique avec des lignes fantômes "annulation" à chaque édition. */
function applyDepenseEdit(oldDep, newDep) {
  const label = newDep.description || CATEGORIES[newDep.categorie]?.label || 'Modification';

  if (oldDep.compte === newDep.compte) {
    const delta = oldDep.montant - newDep.montant;
    if (delta !== 0) updateSolde(newDep.compte, delta, label);
  } else {
    updateSolde(oldDep.compte, oldDep.montant, 'Modification (changement de compte)');
    updateSolde(newDep.compte, -newDep.montant, label);
  }

  const oldWasInvest = oldDep.categorie === 'investissement';
  const newIsInvest = newDep.categorie === 'investissement';
  if (oldWasInvest && newIsInvest) {
    const delta = newDep.montant - oldDep.montant;
    if (delta !== 0) updateSolde('investissement', delta, label);
  } else if (oldWasInvest && !newIsInvest) {
    updateSolde('investissement', -oldDep.montant, 'Modification (changement de catégorie)');
  } else if (!oldWasInvest && newIsInvest) {
    updateSolde('investissement', newDep.montant, label);
  }
}

/* Un abonnement "annuel" (assurance, impôts...) est lissé sur 12 mois
   dans les totaux mensuels (sinking fund), même si le prélèvement réel
   n'a lieu qu'une fois par an — sinon il ferait s'effondrer le "reste à
   vivre" du seul mois où il tombe alors qu'il était prévisible. */
function getAbonnementsMensuelTotal() {
  return getAbonnements().filter((a) => a.actif).reduce((s, a) => {
    return s + (a.frequence === 'annuel' ? a.montant / 12 : a.montant);
  }, 0);
}

function getAbonnementsAnnuelReelTotal() {
  return getAbonnements().filter((a) => a.actif).reduce((s, a) => {
    return s + (a.frequence === 'annuel' ? a.montant : a.montant * 12);
  }, 0);
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

/* ---------- OBJECTIFS D'ÉPARGNE (par compte) ---------- */
const getObjectifs = () => JSON.parse(localStorage.getItem('budget_objectifs') || '{}');
function saveObjectifCompte(compte, objectif) {
  const objectifs = getObjectifs();
  if (objectif) objectifs[compte] = objectif;
  else delete objectifs[compte];
  localStorage.setItem('budget_objectifs', JSON.stringify(objectifs));
}
function getObjectifCompte(compte) {
  return getObjectifs()[compte] || null;
}

/* Nombre de mois entre aujourd'hui et une échéance 'YYYY-MM' (mini 1
   pour éviter une division par zéro si l'échéance est ce mois-ci). */
function moisRestantsJusqua(echeance) {
  const [ey, em] = echeance.split('-').map(Number);
  const now = new Date();
  const months = (ey - now.getFullYear()) * 12 + (em - 1 - now.getMonth());
  return Math.max(1, months);
}

/* ---------- RAPPEL D'EXPORT (sauvegarde locale) ----------
   100% localStorage = confidentialité totale, mais aussi risque de
   perte totale si le téléphone est perdu/réinitialisé. Un rappel léger
   plutôt qu'une synchronisation serveur, pour ne pas trahir le choix
   de vie privée du cahier des charges. */
function getLastExportAt() {
  const v = localStorage.getItem('budget_last_export_at');
  return v ? parseInt(v, 10) : null;
}
function markExported() {
  localStorage.setItem('budget_last_export_at', String(Date.now()));
}
function getExportSnoozeUntil() {
  const v = localStorage.getItem('budget_export_snooze_until');
  return v ? parseInt(v, 10) : 0;
}
function snoozeExportReminder(days = 7) {
  localStorage.setItem('budget_export_snooze_until', String(Date.now() + days * 24 * 60 * 60 * 1000));
}
function shouldShowExportReminder() {
  const last = getLastExportAt();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const neverOrOld = !last || (Date.now() - last > THIRTY_DAYS);
  return neverOrOld && Date.now() > getExportSnoozeUntil() && getDepenses().length > 0;
}

/* ---------- CODE PIN LOCAL (verrouillage rapide) ----------
   Protection légère côté client : dissuade un accès casuel si le
   téléphone est déverrouillé/laissé sans surveillance. Ce n'est PAS
   une seconde authentification cryptographique côté serveur — juste un
   verrou local, avec récupération via le mot de passe du compte
   (jamais de réinitialisation qui effacerait les données). */
async function hashPin(pin) {
  const enc = new TextEncoder().encode(`budget-app-pin::${pin}`);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const getPinHash = () => localStorage.getItem('budget_pin_hash');
const savePinHash = (hash) => localStorage.setItem('budget_pin_hash', hash);
const clearPin = () => localStorage.removeItem('budget_pin_hash');
async function verifyPin(pin) {
  const hash = getPinHash();
  return !!hash && (await hashPin(pin)) === hash;
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

/* Choix du compte à créditer (ou aucun) — utilisé quand un revenu réel
   (salaire...) doit se traduire en argent effectivement disponible sur
   un compte, pas juste dans le prévisionnel. */
function showCompteChoicePrompt(title) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay center';
    overlay.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-title">${title}</div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <button class="btn btn-outline" data-choice="cb">💳 Carte bancaire</button>
          <button class="btn btn-outline" data-choice="especes">💵 Espèces</button>
          <button class="btn-expand" data-choice="none" style="color:var(--text3); margin-top:4px;">Non, juste prévisionnel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = (value) => { overlay.remove(); resolve(value); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    overlay.querySelectorAll('[data-choice]').forEach((btn) => {
      btn.addEventListener('click', () => close(btn.dataset.choice === 'none' ? null : btn.dataset.choice));
    });
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
/* Clés locales à ne jamais exporter/importer : spécifiques à cet
   appareil/session (le code PIN d'un téléphone n'a pas de sens sur un
   autre), pas des données budgétaires. Tout le reste préfixé "budget_"
   est exporté automatiquement — évite d'oublier une clé à chaque
   nouvelle fonctionnalité (c'est déjà arrivé : le salaire mensuel, les
   % de budget et les objectifs manquaient à l'export). */
const EXPORT_EXCLUDED_KEYS = ['budget_pin_hash', 'budget_last_export_at', 'budget_export_snooze_until'];

/* Réinitialisation complète : supprime toutes les données budgétaires
   de cet appareil (dépenses, comptes, budgets, salaires, objectifs,
   PIN...) pour repartir de zéro sur l'écran de config initiale.
   Irréversible — pas de sauvegarde serveur, seul un export préalable
   permet de revenir en arrière. */
function resetAllData() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith('budget_'))
    .forEach((k) => localStorage.removeItem(k));
}

function exportData() {
  const data = { exported_at: new Date().toISOString() };
  Object.keys(localStorage)
    .filter((k) => k.startsWith('budget_') && !EXPORT_EXCLUDED_KEYS.includes(k))
    .forEach((k) => {
      try { data[k] = JSON.parse(localStorage.getItem(k)); } catch (err) { data[k] = localStorage.getItem(k); }
    });

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget-export-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  markExported();
  showToast('Export téléchargé ✓');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      Object.keys(data)
        .filter((k) => k.startsWith('budget_') && !EXPORT_EXCLUDED_KEYS.includes(k))
        .forEach((k) => localStorage.setItem(k, JSON.stringify(data[k])));
      showToast('Import réussi ✓');
      setTimeout(() => window.location.reload(), 700);
    } catch (err) {
      showToast('Fichier invalide', 'error');
    }
  };
  reader.readAsText(file);
}
