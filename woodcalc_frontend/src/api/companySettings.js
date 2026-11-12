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
  return data;
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
      .then(applyStandardFlags)
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
