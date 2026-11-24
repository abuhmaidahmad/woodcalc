import { useEffect, useState } from 'react';
import { authFetch, getToken } from './auth';
import { getCompanyBackPanel, setCompanyBackPanel, getCompanyGlass, setCompanyGlass, getCompanyGlassDoor, setCompanyGlassDoor, getCompanyDrawerMaterials, setCompanyDrawerMaterials } from '../features/kitchen_planner/formulaEngine';

const BASE_URL = import.meta.env.VITE_API_URL || 'https://woodcalc-production.up.railway.app';

export async function getCompanySettings() {
  const res = await authFetch(`${BASE_URL}/api/tenants/settings/`);
  if (!res.ok) throw new Error('Failed to load company settings');
  return res.json();
}

export async function updateCompanySettings(patch) {
  const res = await authFetch(`${BASE_URL}/api/tenants/settings/`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.detail || Object.values(data || {}).flat().join(' ') || 'Failed to save');
  applyStandardFlags(data);
  setBrandingValue({ logoUrl: data.logo_url ?? branding?.logoUrl ?? null, profile: data.company_profile || null });
  return data;
}

let branding = null;
const brandingListeners = new Set();
function setBrandingValue(value) {
  branding = value;
  brandingListeners.forEach(l => l(value));
}

async function logoRequest(options) {
  const res = await authFetch(`${BASE_URL}/api/tenants/logo/`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || Object.values(data || {}).flat().join(' ') || 'Failed to save the logo');
  setBrandingValue({ ...(branding || { profile: null }), logoUrl: data.logo_url || null });
  return data.logo_url || null;
}

export function uploadCompanyLogo(file) {
  const body = new FormData();
  body.append('logo', file);
  return logoRequest({ method: 'POST', body });
}

export function deleteCompanyLogo() {
  return logoRequest({ method: 'DELETE' });
}

export function useCompanyBranding(enabled = true) {
  const [value, setValue] = useState(branding);
  useEffect(() => {
    brandingListeners.add(setValue);
    setValue(branding);
    if (enabled && getToken()) loadCompanyStandards();
    return () => { brandingListeners.delete(setValue); };
  }, [enabled]);
  return value || { logoUrl: null, profile: null };
}

function applyStandardFlags(flags) {
  setCompanyBackPanel({ thickness: flags.back_panel_thickness_mm, materialCode: flags.back_panel_material_sku, construction: flags.back_construction });
  setCompanyGlass({ thickness: flags.glass_shelf_thickness_mm, materialCode: flags.glass_shelf_material_sku });
  setCompanyGlassDoor({ materialCode: flags.glass_door_material_sku });
  setCompanyDrawerMaterials({
    boxMaterialCode: flags.drawer_box_material_sku, boxThickness: flags.drawer_box_thickness_mm,
    bottomMaterialCode: flags.drawer_bottom_material_sku, bottomThickness: flags.drawer_bottom_thickness_mm,
  });
}

// One fetch per page load -- every cut list / proposal / optimizer view shares it.
// Await it before building a work order's pieces, which take their drawer box
// materials from it.
let loadPromise = null;
export function loadCompanyStandards() {
  if (!loadPromise) {
    loadPromise = getCompanySettings()
      .then(flags => { applyStandardFlags(flags); setProductionPricingValue(flags.production_pricing || {}); setBrandingValue({ logoUrl: flags.logo_url || null, profile: flags.company_profile || null }); })
      .catch(() => { loadPromise = null; });
  }
  return loadPromise;
}

// Loads the company's material standards (back panel + glass shelves, each
// { thickness, materialCode }) into the formula engine and returns them, so a
// component can list them in its memo deps and recompute its cut list once the
// real values arrive. Public (logged-out) views keep the generic standards.
export function useCompanyStandards(enabled = true) {
  const current = () => ({ back: getCompanyBackPanel(), glass: getCompanyGlass(), glassDoor: getCompanyGlassDoor(), drawer: getCompanyDrawerMaterials() });
  const [standards, setStandards] = useState(current);
  useEffect(() => {
    if (!enabled || !getToken()) return;
    let alive = true;
    loadCompanyStandards().then(() => { if (alive) setStandards(current()); });
    return () => { alive = false; };
  }, [enabled]);
  return standards;
}

// ─── Production pricing (cutting & banding, assembly, overhead) ─────────────
// Company settings, stored as flags.production_pricing and shared by every
// proposal. Held here once per page so the Proposal tab's editor and the
// planner's saved grand total always use the same values. null until loaded;
// the pricing engine fills anything missing with its defaults
// (normalizeProductionPricing), so public/logged-out views just use those.
let productionPricing = null;
const productionListeners = new Set();
function setProductionPricingValue(value) {
  productionPricing = value;
  productionListeners.forEach(l => l(value));
}

let productionSaveTimer = null;
export function useProductionPricing(enabled = true) {
  const [pricing, setPricing] = useState(productionPricing);
  const [saveState, setSaveState] = useState({ saving: false, error: null });
  useEffect(() => {
    productionListeners.add(setPricing);
    setPricing(productionPricing);
    if (enabled && getToken()) loadCompanyStandards();
    return () => { productionListeners.delete(setPricing); };
  }, [enabled]);

  // Applies the edit at once everywhere on the page, then saves it to the
  // company a moment after the last keystroke.
  const update = (next) => {
    setProductionPricingValue(next);
    clearTimeout(productionSaveTimer);
    setSaveState({ saving: true, error: null });
    productionSaveTimer = setTimeout(() => {
      updateCompanySettings({ production_pricing: next })
        .then(() => setSaveState({ saving: false, error: null }))
        .catch(e => setSaveState({ saving: false, error: e.message || 'Failed to save' }));
    }, 600);
  };
  return { pricing, update, ...saveState };
}

// Actual sheets cut for a room, from its work orders' optimized cutting jobs:
// [{ material_sku, width, height, sheets }]. Empty when nothing has been cut yet.
export function useRoomSheetUsage(roomId, enabled = true) {
  const [usage, setUsage] = useState([]);
  useEffect(() => {
    if (!enabled || !roomId || !getToken()) { setUsage([]); return; }
    let alive = true;
    authFetch(`${BASE_URL}/api/manufacturing/cutting-jobs/sheet-usage/?room=${encodeURIComponent(roomId)}`)
      .then(res => (res.ok ? res.json() : []))
      .then(data => { if (alive) setUsage(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) setUsage([]); });
    return () => { alive = false; };
  }, [roomId, enabled]);
  return usage;
}
