import { useEffect, useState } from 'react';
import { authFetch, getToken } from './auth';
import { getCompanyBackPanel, setCompanyBackPanel } from '../features/kitchen_planner/formulaEngine';

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
  applyBackPanelFlags(data);
  return data;
}

function applyBackPanelFlags(flags) {
  setCompanyBackPanel({ thickness: flags.back_panel_thickness_mm, materialCode: flags.back_panel_material_sku });
}

// One fetch per page load -- every cut list / proposal / optimizer view shares it.
let loadPromise = null;
function loadCompanyBackPanel() {
  if (!loadPromise) {
    loadPromise = getCompanySettings()
      .then(applyBackPanelFlags)
      .catch(() => { loadPromise = null; });
  }
  return loadPromise;
}

// Loads the company's back panel ({ thickness, materialCode }) into the formula
// engine and returns it, so a component can list it in its memo deps and
// recompute its cut list once the real value arrives. Public (logged-out) views
// keep the 8mm generic standard.
export function useCompanyBackPanel(enabled = true) {
  const [back, setBack] = useState(getCompanyBackPanel());
  useEffect(() => {
    if (!enabled || !getToken()) return;
    let alive = true;
    loadCompanyBackPanel().then(() => { if (alive) setBack(getCompanyBackPanel()); });
    return () => { alive = false; };
  }, [enabled]);
  return back;
}
