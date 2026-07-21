// ═══ iGram location dropdown helper (client) ═══
let IGRAM_LOC = null;

async function igramLoadLocations() {
  if (IGRAM_LOC) return IGRAM_LOC;
  try {
    const res = await fetch('/api/locations');
    const j = await res.json();
    IGRAM_LOC = j;
    return j;
  } catch (e) { console.error('locations load failed', e); return null; }
}

// Populate a State -> District -> Taluka cascade
// stateSel, distSel, talSel are element IDs
async function igramSetupCascade(stateSel, distSel, talSel) {
  const data = await igramLoadLocations();
  if (!data) return;
  const stateEl = document.getElementById(stateSel);
  const distEl = distSel ? document.getElementById(distSel) : null;
  const talEl = talSel ? document.getElementById(talSel) : null;
  if (!stateEl) return;

  stateEl.innerHTML = '<option value="">Select state</option>' +
    Object.keys(data.locations).map(s => `<option value="${s}">${s}</option>`).join('');

  stateEl.onchange = () => {
    const s = stateEl.value;
    if (distEl) {
      const districts = s ? Object.keys(data.locations[s] || {}) : [];
      distEl.innerHTML = '<option value="">Select district</option>' +
        districts.map(d => `<option value="${d}">${d}</option>`).join('');
      distEl.onchange && distEl.onchange();
    }
    if (talEl) talEl.innerHTML = '<option value="">Select taluka</option>';
  };

  if (distEl && talEl) {
    distEl.onchange = () => {
      const s = stateEl.value, d = distEl.value;
      const talukas = (s && d && data.locations[s]) ? (data.locations[s][d] || []) : [];
      talEl.innerHTML = '<option value="">Select taluka</option>' +
        talukas.map(t => `<option value="${t}">${t}</option>`).join('');
    };
  }
}

// Fill a simple select with an array
async function igramFillSelect(selId, key) {
  const data = await igramLoadLocations();
  if (!data) return;
  const el = document.getElementById(selId);
  if (!el) return;
  const arr = data[key] || [];
  el.innerHTML = '<option value="">Select</option>' + arr.map(x => `<option value="${x}">${x}</option>`).join('');
}
