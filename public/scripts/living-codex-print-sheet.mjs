import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';

const root = document.getElementById('lcx-print-root');
const statusEl = document.getElementById('lcx-print-status');
const printBtn = document.getElementById('lcx-print-btn');
const zipInput = document.getElementById('lcx-zip-input');
const loadZipBtn = document.getElementById('lcx-load-zip-btn');

const STYLE_ID = 'lcx-print-styles';

const rulesetLabels = { dnd5e_2014: 'D&D 5e (2014)', dnd5e_2024: 'D&D 5e (2024)' };
const skillAbility = {
  acrobatics: 'dex', animal_handling: 'wis', arcana: 'int', athletics: 'str', deception: 'cha', history: 'int', insight: 'wis',
  intimidation: 'cha', investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis', performance: 'cha', persuasion: 'cha',
  religion: 'int', sleight_of_hand: 'dex', stealth: 'dex', survival: 'wis'
};

const CAMPAIGN_NOTES_TEXT = `Generally rich population. Library of Ermack, fabled for knowledge, not open to public, takes up half the town and fountain. Body just appeared, might be magic. Bookkeeper's guild maintains order. Little child hears splash in fountain in town square and finds a man's corpse with a note pinned to the body: 'Next one at midnight'. Radall Tolstagg, local jeweller, found by Kara, daughter of local apothecary Katernin. We were at the bookkeeper's guild, 9 pm. Divination was blocked; priests could not work divination.

Necklace is a teleport and sends a person to safety after a short chant.

Jeweller records: nothing strange in ledger, but a letter was found. Customers include Katenin and Flint Fyreforge with inconsistencies in jewel pricing.

Kara saw the body after the splash but missed clothing, necklace, and note details. Kara is apprentice at the library. Mr Tolstagg was not kind to her mother. Mother had a high-interest loan from him. Handwriting on the note matched Tolstagg. Handwriting in the letter matched Tolstagg and Katenin.

Open cathedral altar had nothing; temple of many gods. Second high priest missing, maybe drunk in nearest tavern by residential district.

Tavern is Tortly Drunk. Halfling and dwarf sharing drinks. Tortle barkeep. Broken furniture in back matched tavern stock.

Behind the tavern was impossible geometry, turning 270 degrees away from the building.

Mothos, tiefling warlock and shop owner. Entangled warlock escaped; circumference lost memory of school days.

Ended in alley with blood stain; divination block gone. Returned to temple to ask cleric.

Cleric divination showed hooded woman stabbing Randall. Knife under bed in bedroom, second room.

Thea brought in and conflicted about what to do with Katenin.

Tortle pickpocketed me. No GP.`;

function abilityMod(score) { return Math.floor((Number(score || 10) - 10) / 2); }
function fmtBonus(n) { const v = Number(n || 0); return `${v >= 0 ? '+' : ''}${v}`; }

function splitCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
      continue;
    }
    if (ch === ',' && !q) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const lines = (text || '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });
    return row;
  });
}

function clean(v) {
  const s = String(v || '').replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

function extractRange(v) {
  const s = clean(v);
  const m = s.match(/(Self|Touch|\d+\s*(feet|foot|miles?|meters?|metres?))/i);
  return m ? m[1] : '';
}

function extractDuration(v) {
  const s = clean(v);
  const m = s.match(/(Instantaneous|Until dispelled|\d+\s*(rounds?|minutes?|hours?|days?)|Concentration,\s*up to\s*\d+\s*(minutes?|hours?|days?))/i);
  return m ? m[1] : '';
}

function wrapWords(text, maxChars) {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const out = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxChars) line = next;
    else {
      if (line) out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out;
}

async function loadLookups(rulesetId) {
  const rid = rulesetId || 'dnd5e_2014';
  const base = `/living-codex/data/${rid}`;
  const [classes, species, subclasses] = await Promise.all([
    fetch(`${base}/classes.min.json`).then(r => r.ok ? r.json() : []),
    fetch(`${base}/species.min.json`).then(r => r.ok ? r.json() : []),
    fetch(`${base}/subclasses.min.json`).then(r => r.ok ? r.json() : []),
  ]).catch(() => [[], [], []]);
  return {
    classes: Object.fromEntries(classes.map(c => [c.id, c.name])),
    species: Object.fromEntries(species.map(s => [s.id, s.name])),
    subclasses: Object.fromEntries(subclasses.map(s => [`${s.class_id}:${s.id}`, s.name])),
  };
}

function injectStyles(theme) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
  :root{--ink:${theme.ink};--muted:${theme.muted};--line:${theme.line};--accent:${theme.accent};--panel:${theme.panel};--bg:${theme.bg};}
  .lcx-pages{display:grid;gap:14px}
  .lcx-page{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:14mm;min-height:270mm;display:flex;flex-direction:column;gap:8px}
  .lcx-body{display:grid;gap:8px;align-content:start}
  .foot{margin-top:auto}
  .lcx-head{display:grid;grid-template-columns:1fr auto;gap:6px;border-bottom:1px solid var(--line);padding-bottom:6px}
  .lcx-title{font:700 20px/1.1 system-ui;color:var(--ink)}
  .lcx-sub{font:600 10px/1.2 system-ui;color:var(--muted)}
  .lcx-tag{font:700 12px/1 system-ui;color:var(--accent);align-self:start}
  .sec{display:grid;gap:6px}
  .sec-h{border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--accent);font:700 11px/1 system-ui;padding:8px 10px}
  .grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
  .grid5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
  .grid6{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}
  .card{border:1px solid var(--line);border-radius:8px;background:#fff;padding:8px 8px 6px;display:grid;gap:8px;min-height:26px}
  .card .k{font:700 8px/1.1 system-ui;color:var(--muted)}
  .card .v{font:700 13px/1 system-ui;color:var(--ink);text-align:center}
  .card .v-sm{font:700 11px/1 system-ui;color:var(--ink);text-align:center}
  .ability .v{font-size:12px}
  .ability .s{font:500 10px/1 system-ui;color:var(--muted);justify-self:end}
  table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:8px;overflow:hidden}
  th,td{border:1px solid var(--line);padding:3px 6px;font:600 11px/1.2 system-ui;color:var(--ink);vertical-align:top}
  th{font:700 11px/1.1 system-ui;background:var(--panel)}
  .foot{display:grid;grid-template-columns:1fr 1fr 1fr;font:600 9px/1 system-ui;color:var(--muted);border-top:1px solid var(--line);padding-top:6px}
  .foot :nth-child(2){text-align:center}.foot :nth-child(3){text-align:right}
  .notes{white-space:pre-wrap;word-wrap:break-word;border:1px solid var(--line);border-radius:8px;background:#fff;padding:24px 12px 12px;font:600 11px/1.45 system-ui;color:var(--ink);position:relative}
  .notes::before{content:'Narrative';position:absolute;top:8px;left:12px;font:700 9px/1 system-ui;color:var(--muted)}
  .wm{position:absolute;right:12px;bottom:12px;opacity:0.09;max-width:90px}

  @media print{
    @page{size:A4;margin:0}
    html,body{background:#fff !important}
    .lcx-pages{gap:0}
    .lcx-page{
      border:0;
      border-radius:0;
      box-sizing:border-box;
      width:210mm;
      height:297mm;
      min-height:297mm;
      margin:0;
      padding:14mm;
      break-after:page;
    }
    .sec,
    .card,
    table,
    .notes{
      break-inside:avoid;
      page-break-inside:avoid;
    }
    .notes--quick{
      min-height:34mm !important;
    }
    .lcx-page:last-child{page-break-after:auto}
  }
  `;
  document.head.append(style);
}

function createPage(title, subtitle, tag) {
  const page = document.createElement('section');
  page.className = 'lcx-page';
  page.innerHTML = `<header class="lcx-head"><div><div class="lcx-title"></div><div class="lcx-sub"></div></div><div class="lcx-tag"></div></header><div class="lcx-body"></div><footer class="foot"><span>The Living Codex</span><span></span><span></span></footer>`;
  page.querySelector('.lcx-title').textContent = title;
  page.querySelector('.lcx-sub').textContent = subtitle;
  page.querySelector('.lcx-tag').textContent = tag;
  return page;
}

function addSection(parent, title) {
  const sec = document.createElement('section');
  sec.className = 'sec';
  sec.innerHTML = `<div class="sec-h"></div>`;
  sec.querySelector('.sec-h').textContent = title;
  parent.append(sec);
  return sec;
}

function card(label, value, cls = '') {
  const d = document.createElement('div');
  d.className = `card ${cls}`;
  d.innerHTML = `<div class="k"></div><div class="v"></div>`;
  d.querySelector('.k').textContent = label;
  d.querySelector('.v').textContent = value ?? '';
  return d;
}

function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }

function createContinuationPageFrom(sourcePage) {
  const title = sourcePage.querySelector('.lcx-title')?.textContent || '[Character Name]';
  const subtitle = sourcePage.querySelector('.lcx-sub')?.textContent || 'Continuation';
  const tag = sourcePage.querySelector('.lcx-tag')?.textContent || 'CONT';
  const p = createPage(title, `${subtitle} (continued)`, tag);
  p.dataset.continuation = '1';
  return p;
}

function moveCoreCurrencyToContinuation(pages) {
  const all = Array.from(pages.children);
  const core = all.find((p) => (p.querySelector('.lcx-tag')?.textContent || '').trim() === 'CORE');
  if (!core) return;
  const coreBody = core.querySelector('.lcx-body');
  if (!coreBody) return;
  const sections = Array.from(coreBody.querySelectorAll(':scope > .sec'));
  const currency = sections.find((sec) => (sec.querySelector('.sec-h')?.textContent || '').trim() === 'Currency and Quick Notes');
  if (!currency) return;

  let next = core.nextElementSibling;
  if (!(next && next.classList.contains('lcx-page') && next.dataset.continuation === '1')) {
    next = createContinuationPageFrom(core);
    core.insertAdjacentElement('afterend', next);
  }
  next.querySelector('.lcx-body')?.prepend(currency);
}

function calcCoreNeedsTail() {
  // Keep all core content on the core page to avoid browser-specific blank-page artifacts.
  return false;
}

function makeCurrencyNotesSection(character) {
  const currency = document.createElement('section');
  currency.className = 'sec';
  currency.innerHTML = `<div class="sec-h">Currency and Quick Notes</div>`;
  const gc = document.createElement('div');
  gc.className = 'grid5';
  const cur = character?.currency || {};
  ['cp', 'sp', 'ep', 'gp', 'pp'].forEach((k) => gc.append(card(k.toUpperCase(), cur[k] ?? 0)));
  currency.append(gc);
  const qn = document.createElement('div');
  qn.className = 'notes notes--quick';
  qn.style.minHeight = '40mm';
  qn.textContent = '';
  currency.append(qn);
  return currency;
}

async function render() {
  let raw = sessionStorage.getItem('lcx_print_payload');
  if (!raw) {
    const handoff = localStorage.getItem('lcx_print_payload_handoff');
    if (handoff) {
      sessionStorage.setItem('lcx_print_payload', handoff);
      localStorage.removeItem('lcx_print_payload_handoff');
      raw = handoff;
    }
  }
  if (!raw) throw new Error('No print payload found. Upload a ZIP from the project page first.');

  const payload = JSON.parse(raw);
  const character = payload.character || {};
  const logs = parseCsv(payload.logCsv || '');
  const lookups = await loadLookups(character?.meta?.ruleset_id);

  const appearance = character?.ui?.appearance || {};
  const theme = {
    ink: appearance.ink || '#1b2432',
    muted: appearance.inkSoft || '#4a5568',
    line: appearance.line || '#c8d1df',
    accent: appearance.accent || '#b73a57',
    panel: appearance.paper || '#f6f8fc',
    bg: appearance.bg || '#ffffff',
  };
  injectStyles(theme);

  const pages = document.createElement('div');
  pages.className = 'lcx-pages';
  const title = character?.meta?.name || '[Character Name]';
  const stamp = `Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;

  const abil = character?.abilities || {};
  const combat = character?.combat || {};
  const pBonus = Number(combat.proficiency_bonus || 0);
  const saves = character?.saving_throws || {};
  const skills = character?.skills || {};

  const passiveInsight = 10 + (() => {
    const sk = skills.insight || {}; const mod = abilityMod(abil.wis); const prof = sk.expertise ? pBonus * 2 : sk.proficient ? pBonus : 0;
    return (sk.bonus_mode === 'manual' ? Number(sk.manual_total || 0) : mod + prof + Number(sk.bonus || 0));
  })();
  const passiveInv = 10 + (() => {
    const sk = skills.investigation || {}; const mod = abilityMod(abil.int); const prof = sk.expertise ? pBonus * 2 : sk.proficient ? pBonus : 0;
    return (sk.bonus_mode === 'manual' ? Number(sk.manual_total || 0) : mod + prof + Number(sk.bonus || 0));
  })();
  const castAbility = (character?.spellcasting?.ability || 'wis').toLowerCase();
  const castMod = abilityMod(abil[castAbility]);

  // CORE
  const p1 = createPage(title, 'Core sheet', 'CORE');
  const b1 = p1.querySelector('.lcx-body');
  const identity = addSection(b1, 'Identity');
  const g4 = document.createElement('div'); g4.className = 'grid4';
  g4.append(card('Player', character?.identity?.player_name || character?.profile?.player_name || ''));
  g4.append(card('Campaign', character?.identity?.campaign || ''));
  g4.append(card('Ruleset', rulesetLabels[character?.meta?.ruleset_id] || character?.meta?.ruleset_id || ''));
  g4.append(card('Species', lookups.species?.[character?.core?.speciesId] || character?.core?.speciesId || ''));
  identity.append(g4);
  identity.append(card('Class / Subclass / Level', (character?.core?.classes || []).map((cl) => {
    const c = lookups.classes?.[cl.id] || cl.id || '';
    const sc = lookups.subclasses?.[`${cl.id}:${cl.subclassId}`] || '';
    return sc ? `${c} - ${sc} - Level ${cl.level}` : `${c} - Level ${cl.level}`;
  }).join(', ')));

  const abilSec = addSection(b1, 'Abilities');
  const g6 = document.createElement('div'); g6.className = 'grid6';
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((k) => {
    const d = card(k.toUpperCase(), fmtBonus(abilityMod(abil[k])), 'ability');
    d.querySelector('.v').className = 'v-sm';
    const s = document.createElement('div'); s.className = 's'; s.textContent = String(abil[k] ?? '');
    d.append(s); g6.append(d);
  });
  abilSec.append(g6);

  const combatSec = addSection(b1, 'Combat');
  const gc1 = document.createElement('div'); gc1.className = 'grid4';
  gc1.append(card('AC', combat.ac ?? ''));
  gc1.append(card('Initiative', fmtBonus(combat.initiative_bonus || 0)));
  gc1.append(card('Speed', combat.speed ?? ''));
  gc1.append(card('Proficiency Bonus', fmtBonus(combat.proficiency_bonus || 0)));
  combatSec.append(gc1);
  const gc2 = document.createElement('div'); gc2.className = 'grid4';
  gc2.append(card('HP Current', combat?.hp?.current ?? ''));
  gc2.append(card('HP Max', combat?.hp?.max ?? ''));
  gc2.append(card('HP Temp', combat?.hp?.temp ?? ''));
  gc2.append(card('Passive Perception', combat?.passive_perception ?? ''));
  combatSec.append(gc2);
  const gc3 = document.createElement('div'); gc3.className = 'grid4';
  gc3.append(card('Hit Dice Used / Total', `${combat.hit_dice_used ?? ''}/${combat.hit_dice_total ?? ''}`));
  const ds = combat?.death_saves || {};
  const conc = combat?.concentration?.active ? 'Yes' : 'No';
  gc3.append(card('Inspiration / Concentration / Death Saves', `${combat?.inspiration ?? 0} / ${conc} / ${ds.success ?? 0}-${ds.fail ?? 0}`));
  gc3.append(document.createElement('div'));
  gc3.append(document.createElement('div'));
  combatSec.append(gc3);

  const saveSkillSec = addSection(b1, 'Saving Throws and Skills');
  const wrap = document.createElement('div'); wrap.style.display = 'grid'; wrap.style.gridTemplateColumns = '37% 1fr'; wrap.style.gap = '6px';
  const saveTable = document.createElement('table');
  saveTable.innerHTML = '<thead><tr><th>Save</th><th>P</th><th>Mod</th><th>Total</th></tr></thead><tbody></tbody>';
  const saveBody = saveTable.querySelector('tbody');
  ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((k) => {
    const row = saves[k] || {};
    const mod = abilityMod(abil[k]);
    const total = row.bonus_mode === 'manual' ? Number(row.manual_total || 0) : mod + (row.proficient ? pBonus : 0) + Number(row.bonus || 0);
    saveBody.insertAdjacentHTML('beforeend', `<tr><td>${k.toUpperCase()}</td><td>${row.proficient ? 'x' : ''}</td><td>${fmtBonus(mod)}</td><td>${fmtBonus(total)}</td></tr>`);
  });

  const skillTable = document.createElement('table');
  skillTable.innerHTML = '<thead><tr><th>Skill</th><th>P</th><th>E</th><th>Mod</th><th>Total</th></tr></thead><tbody></tbody>';
  const skillBody = skillTable.querySelector('tbody');
  Object.keys(skillAbility).sort().forEach((k) => {
    const sk = skills[k] || {};
    const mod = abilityMod(abil[skillAbility[k]]);
    const prof = sk.expertise ? pBonus * 2 : sk.proficient ? pBonus : 0;
    const total = sk.bonus_mode === 'manual' ? Number(sk.manual_total || 0) : mod + prof + Number(sk.bonus || 0);
    skillBody.insertAdjacentHTML('beforeend', `<tr><td>${k.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())}</td><td>${sk.proficient ? 'x' : ''}</td><td>${sk.expertise ? 'x' : ''}</td><td>${fmtBonus(mod)}</td><td>${fmtBonus(total)}</td></tr>`);
  });
  wrap.append(saveTable, skillTable);
  saveSkillSec.append(wrap);

  const sense = addSection(b1, 'Senses and Spellcasting');
  const gs1 = document.createElement('div'); gs1.className = 'grid4';
  gs1.append(card('Passive Perception', combat.passive_perception ?? ''));
  gs1.append(card('Passive Insight / Investigation', `${passiveInsight} / ${passiveInv}`));
  gs1.append(card('Spell Save DC', 8 + pBonus + castMod));
  gs1.append(card('Spell Attack Bonus', fmtBonus(pBonus + castMod)));
  sense.append(gs1);

  const needsTail = calcCoreNeedsTail();
  if (!needsTail) {
    b1.append(makeCurrencyNotesSection(character));
  }
  pages.append(p1);

  if (needsTail) {
    // intentionally disabled
  }

  // SPELLS
  const p2 = createPage(title, 'Spellbook', 'SPELLS');
  const b2 = p2.querySelector('.lcx-body');
  const scSec = addSection(b2, 'Spellcasting Summary');
  const gsc = document.createElement('div'); gsc.className = 'grid4';
  gsc.append(card('Class', lookups.classes?.[character?.spellcasting?.class_id] || character?.spellcasting?.class_id || ''));
  gsc.append(card('Casting Ability', castAbility.toUpperCase()));
  gsc.append(card('Spell Save DC', 8 + pBonus + castMod));
  gsc.append(card('Spell Attack Bonus', fmtBonus(pBonus + castMod)));
  scSec.append(gsc);

  const slSec = addSection(b2, 'Spell Slots');
  const lv = character?.spell_slots?.levels || {};
  slSec.append(card('Slots by Level (max/used)', Array.from({ length: 9 }, (_, i) => `L${i + 1}: ${(lv[String(i + 1)] || {}).max || 0}/${(lv[String(i + 1)] || {}).used || 0}`).join(' | ')));

  const spellRows = (arr) => (arr || []).map((s) => [
    `${s.name || ''} (L${s.level ?? ''})`, s.school || '', s.ritual ? 'Y' : 'N', s.concentration ? 'Y' : 'N', extractRange(s.range), extractDuration(s.duration)
  ]);

  const knownSec = addSection(b2, 'Spells Known');
  const tKnown = document.createElement('table');
  tKnown.innerHTML = '<thead><tr><th>Name/Level</th><th>School</th><th>Ritual</th><th>Conc</th><th>Range</th><th>Duration</th></tr></thead><tbody></tbody>';
  spellRows(character?.spells_known).forEach((r) => tKnown.querySelector('tbody').insertAdjacentHTML('beforeend', `<tr>${r.map((c) => `<td>${clean(c)}</td>`).join('')}</tr>`));
  knownSec.append(tKnown);

  const prepSec = addSection(b2, 'Spells Prepared');
  const tPrep = document.createElement('table');
  tPrep.innerHTML = '<thead><tr><th>Name/Level</th><th>School</th><th>Ritual</th><th>Conc</th><th>Range</th><th>Duration</th></tr></thead><tbody></tbody>';
  spellRows(character?.spells_prepared).forEach((r) => tPrep.querySelector('tbody').insertAdjacentHTML('beforeend', `<tr>${r.map((c) => `<td>${clean(c)}</td>`).join('')}</tr>`));
  prepSec.append(tPrep);
  pages.append(p2);

  // INVENTORY
  const p3 = createPage(title, 'Inventory', 'GEAR');
  const b3 = p3.querySelector('.lcx-body');
  const invSec = addSection(b3, 'Inventory');
  const invT = document.createElement('table');
  invT.innerHTML = '<thead><tr><th>Item / Qty</th><th>Category</th><th>Eq</th><th>Att</th><th>Notes</th></tr></thead><tbody></tbody>';
  (character?.inventory || []).forEach((it) => {
    invT.querySelector('tbody').insertAdjacentHTML('beforeend', `<tr><td>${clean(it.name || '')} x${it.qty || 0}</td><td>${clean(it.category || '')}</td><td>${it.equipped ? 'Y' : 'N'}</td><td>${clean(it.attunement || '')}</td><td>${clean(it.notes || '')}</td></tr>`);
  });
  invSec.append(invT);
  pages.append(p3);

  // PROFILE
  const p4 = createPage(title, 'Story and utility', 'PROFILE');
  const b4 = p4.querySelector('.lcx-body');
  const idStory = addSection(b4, 'Identity and Story');
  const g2 = document.createElement('div'); g2.style.display = 'grid'; g2.style.gridTemplateColumns = '1fr 1fr'; g2.style.gap = '8px';
  const identityNode = character?.identity || {};
  const profile = character?.profile || {};
  const leftIdent = [identityNode.background || profile.background, identityNode.alignment || profile.alignment, identityNode.ancestry].filter(Boolean).join(' | ');
  const rightIdent = [profile.age, profile.height, profile.weight, profile.eyes, profile.skin, profile.hair].filter(Boolean).join(' | ');
  g2.append(card('Background / Alignment / Ancestry', leftIdent));
  g2.append(card('Age / Height / Weight / Eyes / Skin / Hair', rightIdent));
  idStory.append(g2);

  const g2b = document.createElement('div'); g2b.style.display = 'grid'; g2b.style.gridTemplateColumns = '1fr 1fr'; g2b.style.gap = '8px';
  g2b.append(card('Personality Traits', profile.personality_traits || ''));
  g2b.append(card('Ideals / Bonds / Flaws', [profile.ideals, profile.bonds, profile.flaws].filter(Boolean).join(' | ')));
  idStory.append(g2b);

  const g2c = document.createElement('div'); g2c.style.display = 'grid'; g2c.style.gridTemplateColumns = '1fr 1fr'; g2c.style.gap = '8px';
  g2c.append(card('Features / Traits', profile.features_traits || ''));
  g2c.append(card('Backstory', profile.backstory || ''));
  idStory.append(g2c);

  const dp = addSection(b4, 'Defenses and Proficiencies');
  const g2d = document.createElement('div'); g2d.style.display = 'grid'; g2d.style.gridTemplateColumns = '1fr 1fr'; g2d.style.gap = '8px';
  const defenses = character?.defenses || {};
  const profs = character?.proficiencies || {};
  const exps = character?.expertise || {};
  g2d.append(card('Defenses', `Imm: ${(defenses.immunities || []).join(', ')}  Res: ${(defenses.resistances || []).join(', ')}  Vuln: ${(defenses.vulnerabilities || []).join(', ')}`));
  g2d.append(card('Proficiencies / Expertise', `Lang: ${(profs.languages || []).join(', ')}  Tools: ${(profs.tools || []).join(', ')}  Skills(Exp): ${(exps.skills || []).join(', ')}`));
  dp.append(g2d);

  const tn = addSection(b4, 'Trackers and Notes');
  const trackers = character?.trackers || [];
  tn.append(card('Trackers and Notes', trackers.length ? trackers.map((t) => `${t.name || 'tracker'}:${t.value || ''}`).join(' | ') : ''));
  pages.append(p4);

  // SESSION LOG
  const parsedLogs = logs.map((r) => {
    let note = '';
    try { note = JSON.parse(r.data_json || '{}').message || r.data_json || ''; } catch { note = r.data_json || ''; }
    return [String(r.timestamp_utc || '').replace('T', ' ').slice(0, 19), r.type || '', r.label || '', note];
  });

  const sessionCapacity = 35;
  const logChunks = chunk(parsedLogs, sessionCapacity);
  (logChunks.length ? logChunks : [[]]).forEach((rows) => {
    const p = createPage(title, 'Session log', 'SESSION LOG');
    const b = p.querySelector('.lcx-body');
    const sec = addSection(b, 'Session Log');
    const t = document.createElement('table');
    t.innerHTML = '<thead><tr><th>Timestamp</th><th>Type</th><th>Label</th><th>Notes / Outcome</th></tr></thead><tbody></tbody>';
    rows.forEach((r) => t.querySelector('tbody').insertAdjacentHTML('beforeend', `<tr>${r.map((c) => `<td>${clean(c)}</td>`).join('')}</tr>`));
    sec.append(t);
    pages.append(p);
  });

  // CAMPAIGN NOTES
  const noteParas = CAMPAIGN_NOTES_TEXT.split(/\n\n/);
  const noteLines = noteParas.flatMap((p) => [...wrapWords(p, 110), '']);
  const noteChunks = chunk(noteLines, 66).map((lines) => lines.join('\n').trim());
  noteChunks.forEach((text) => {
    const p = createPage(title, 'Campaign notes', 'CAMPAIGN NOTES');
    const b = p.querySelector('.lcx-body');
    const sec = addSection(b, 'Campaign Notes');
    const n = document.createElement('div');
    n.className = 'notes';
    n.style.minHeight = '214mm';
    n.textContent = text;
    sec.append(n);
    pages.append(p);
  });

  // Stable-table behavior: move Currency/Quick Notes to continuation after CORE.
  moveCoreCurrencyToContinuation(pages);
  const allPages = Array.from(pages.children);
  allPages.forEach((p, i) => {
    p.querySelector('.foot span:nth-child(2)').textContent = stamp;
    p.querySelector('.foot span:nth-child(3)').textContent = `Page ${i + 1} of ${allPages.length}`;
  });

  root.innerHTML = '';
  root.append(pages);
  statusEl.textContent = 'Ready to print.';
}

if (printBtn) printBtn.addEventListener('click', () => window.print());

async function loadZipIntoSession(file) {
  const zip = await JSZip.loadAsync(file);
  const charText = await zip.file('character.json')?.async('string');
  if (!charText) throw new Error('ZIP is missing character.json.');

  const payload = {
    character: JSON.parse(charText),
    inventoryCsv: (await zip.file('inventory.csv')?.async('string')) || '',
    spellsKnownCsv: (await zip.file('spells_known.csv')?.async('string')) || '',
    spellsPreparedCsv: (await zip.file('spells_prepared.csv')?.async('string')) || '',
    logCsv: (await zip.file('log.csv')?.async('string')) || '',
  };

  if (payload.character?.ui?.portrait?.data_url) {
    payload.character.ui.portrait.data_url = '';
  }

  sessionStorage.setItem('lcx_print_payload', JSON.stringify(payload));
}

if (loadZipBtn && zipInput) {
  loadZipBtn.addEventListener('click', async () => {
    const file = zipInput.files?.[0];
    if (!file) {
      statusEl.textContent = 'Choose a ZIP file first.';
      return;
    }
    statusEl.textContent = 'Loading ZIP...';
    try {
      await loadZipIntoSession(file);
      await render();
    } catch (err) {
      statusEl.textContent = err instanceof Error ? err.message : 'Could not parse ZIP.';
    }
  });
}

render().catch((err) => {
  statusEl.textContent = err instanceof Error ? err.message : 'Failed to render print layout.';
});
