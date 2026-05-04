import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';
import { jsPDF } from 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/+esm';
import autoTable from 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/+esm';

const form = document.getElementById('lcx-pdf-form');
const fileInput = document.getElementById('lcx-zip');
const status = document.getElementById('lcx-pdf-status');
const download = document.getElementById('lcx-pdf-download');

const PAGE_W = 210;
const PAGE_H = 297;
const M = 14;
const FOOTER_RESERVED = 16;

const defaultTheme = {
  ink: '#1b2432',
  muted: '#4a5568',
  line: '#c8d1df',
  accent: '#b73a57',
  panel: '#f6f8fc',
  bg: '#ffffff',
};

const rulesetLabels = {
  dnd5e_2014: 'D&D 5e (2014)',
  dnd5e_2024: 'D&D 5e (2024)',
};

function abilityMod(score) {
  const n = Number(score || 10);
  return Math.floor((n - 10) / 2);
}
function fmtBonus(n) {
  const v = Number(n || 0);
  return `${v >= 0 ? '+' : ''}${v}`;
}

function csvParse(text) {
  const out = [];
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return out;
  const header = splitCsvLine(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const row = {};
    header.forEach((h, idx) => (row[h] = cols[idx] ?? ''));
    out.push(row);
  }
  return out;
}
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        q = !q;
      }
      continue;
    }
    if (ch === ',' && !q) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

async function loadLookups(rulesetId) {
  const rid = rulesetId || 'dnd5e_2014';
  const roots = ['/living-codex/data'];
  for (const root of roots) {
    const base = `${root}/${rid}`;
    try {
      const [classes, species, subclasses] = await Promise.all([
        fetch(`${base}/classes.min.json`).then((r) => (r.ok ? r.json() : [])),
        fetch(`${base}/species.min.json`).then((r) => (r.ok ? r.json() : [])),
        fetch(`${base}/subclasses.min.json`).then((r) => (r.ok ? r.json() : [])),
      ]);
      return {
        classes: Object.fromEntries(classes.map((c) => [c.id, c.name])),
        species: Object.fromEntries(species.map((s) => [s.id, s.name])),
        subclasses: Object.fromEntries(subclasses.map((s) => [`${s.class_id}:${s.id}`, s.name])),
      };
    } catch {
      // continue
    }
  }
  return { classes: {}, species: {}, subclasses: {} };
}

function drawHeader(doc, title, subtitle, tag, theme) {
  doc.setTextColor(theme.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title || '[Character Name]', M, M - 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(theme.muted);
  doc.text(subtitle, M, M + 4);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(theme.accent);
  doc.text(tag, PAGE_W - M, M - 2, { align: 'right' });
  doc.setDrawColor(theme.line);
  doc.line(M, M + 7, PAGE_W - M, M + 7);
}

function drawFooter(doc, page, total, stamp, theme) {
  doc.setDrawColor(theme.line);
  doc.line(M, PAGE_H - M + 4, PAGE_W - M, PAGE_H - M + 4);
  doc.setTextColor(theme.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('The Living Codex', M, PAGE_H - M + 9);
  doc.text(stamp, PAGE_W / 2, PAGE_H - M + 9, { align: 'center' });
  doc.text(`Page ${page} of ${total}`, PAGE_W - M, PAGE_H - M + 9, { align: 'right' });
}

function section(doc, y, text, theme) {
  doc.setFillColor(theme.panel);
  doc.setDrawColor(theme.line);
  doc.roundedRect(M, y, PAGE_W - M * 2, 8, 2, 2, 'FD');
  doc.setTextColor(theme.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(text, M + 2, y + 5.3);
  return y + 10;
}

function boxValue(doc, x, y, w, h, label, value, theme) {
  doc.setFillColor('#ffffff');
  doc.setDrawColor(theme.line);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');
  doc.setTextColor(theme.muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(label, x + 1.8, y + 4.2);
  doc.setTextColor(theme.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(String(value ?? ''), x + w / 2, y + h / 2 + 1.2, { align: 'center' });
}

function cleanSpellValue(v) {
  const s = String(v || '').replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s.length > 40 ? '' : s;
}

function extractRange(v) {
  const s = cleanSpellValue(v);
  const m = s.match(/(Self|Touch|\d+\s*(feet|foot|miles?|meters?|metres?))/i);
  return m ? m[1] : '';
}
function extractDuration(v) {
  const s = cleanSpellValue(v);
  const m = s.match(/(Instantaneous|Until dispelled|\d+\s*(rounds?|minutes?|hours?|days?)|Concentration,\s*up to\s*\d+\s*(minutes?|hours?|days?))/i);
  return m ? m[1] : '';
}

function classSummary(character, lookups) {
  const classes = character?.core?.classes || [];
  return classes
    .map((cl) => {
      const c = lookups.classes[cl.id] || cl.id || '';
      const sc = lookups.subclasses[`${cl.id}:${cl.subclassId}`] || '';
      return sc ? `${c} - ${sc} - Level ${cl.level}` : `${c} - Level ${cl.level}`;
    })
    .join(', ');
}

function themeFromCharacter(character) {
  const a = character?.ui?.appearance || {};
  return {
    ink: a.ink || defaultTheme.ink,
    muted: a.inkSoft || defaultTheme.muted,
    line: a.line || defaultTheme.line,
    accent: a.accent || defaultTheme.accent,
    panel: a.paper || defaultTheme.panel,
    bg: a.bg || defaultTheme.bg,
  };
}

async function buildPdf(file) {
  const zip = await JSZip.loadAsync(file);
  const charJson = await zip.file('character.json')?.async('string');
  if (!charJson) throw new Error('ZIP missing character.json');
  const character = JSON.parse(charJson);
  const logCsv = await zip.file('log.csv')?.async('string');
  const logs = logCsv ? csvParse(logCsv) : [];

  const lookups = await loadLookups(character?.meta?.ruleset_id);
  const theme = themeFromCharacter(character);

  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const stamp = `Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  const title = character?.meta?.name || '[Character Name]';

  let y = M + 10;
  drawHeader(doc, title, 'Core sheet', 'CORE', theme);

  y = section(doc, y, 'Identity', theme);
  const col4 = (PAGE_W - M * 2 - 6) / 4;
  boxValue(doc, M, y, col4, 16, 'Player', character?.identity?.player_name || character?.profile?.player_name || '', theme);
  boxValue(doc, M + col4 + 2, y, col4, 16, 'Campaign', character?.identity?.campaign || '', theme);
  boxValue(doc, M + (col4 + 2) * 2, y, col4, 16, 'Ruleset', rulesetLabels[character?.meta?.ruleset_id] || character?.meta?.ruleset_id || '', theme);
  boxValue(doc, M + (col4 + 2) * 3, y, col4, 16, 'Species', lookups.species[character?.core?.speciesId] || character?.core?.speciesId || '', theme);
  y += 18;
  boxValue(doc, M, y, PAGE_W - M * 2, 16, 'Class / Subclass / Level', classSummary(character, lookups), theme);
  y += 19;

  y = section(doc, y, 'Abilities', theme);
  const abil = character?.abilities || {};
  const abKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const abW = (PAGE_W - M * 2 - 10) / 6;
  abKeys.forEach((k, i) => {
    const x = M + i * (abW + 2);
    doc.setDrawColor(theme.line);
    doc.setFillColor('#ffffff');
    doc.roundedRect(x, y, abW, 16, 2, 2, 'FD');
    doc.setTextColor(theme.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(k.toUpperCase(), x + 2, y + 4);
    doc.setTextColor(theme.ink);
    doc.setFontSize(9.5);
    doc.text(fmtBonus(abilityMod(abil[k])), x + abW / 2, y + 9.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(String(abil[k] ?? ''), x + abW - 2, y + 13.5, { align: 'right' });
  });
  y += 19;

  y = section(doc, y, 'Combat', theme);
  const combat = character?.combat || {};
  const cW = (PAGE_W - M * 2 - 6) / 4;
  boxValue(doc, M, y, cW, 16, 'AC', combat.ac ?? '', theme);
  boxValue(doc, M + cW + 2, y, cW, 16, 'Initiative', fmtBonus(combat.initiative_bonus || 0), theme);
  boxValue(doc, M + (cW + 2) * 2, y, cW, 16, 'Speed', combat.speed ?? '', theme);
  boxValue(doc, M + (cW + 2) * 3, y, cW, 16, 'Proficiency Bonus', fmtBonus(combat.proficiency_bonus || 0), theme);
  y += 18;
  boxValue(doc, M, y, cW, 16, 'HP Current', combat.hp?.current ?? '', theme);
  boxValue(doc, M + cW + 2, y, cW, 16, 'HP Max', combat.hp?.max ?? '', theme);
  boxValue(doc, M + (cW + 2) * 2, y, cW, 16, 'HP Temp', combat.hp?.temp ?? '', theme);
  boxValue(doc, M + (cW + 2) * 3, y, cW, 16, 'Passive Perception', combat.passive_perception ?? '', theme);
  y += 19;

  const profBonus = Number(combat.proficiency_bonus || 0);
  const saves = character?.saving_throws || {};
  const skills = character?.skills || {};
  const skillAbility = {
    Acrobatics: 'dex', 'Animal Handling': 'wis', Arcana: 'int', Athletics: 'str', Deception: 'cha', History: 'int', Insight: 'wis',
    Intimidation: 'cha', Investigation: 'int', Medicine: 'wis', Nature: 'int', Perception: 'wis', Performance: 'cha', Persuasion: 'cha',
    Religion: 'int', 'Sleight Of Hand': 'dex', Stealth: 'dex', Survival: 'wis'
  };

  y = section(doc, y, 'Saving Throws and Skills', theme);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M + (PAGE_W - M * 2) * 0.63 + 2 },
    head: [['Save', 'P', 'Mod', 'Total']],
    body: abKeys.map((k) => {
      const sv = saves[k] || {};
      const mod = abilityMod(abil[k]);
      const total = sv.bonus_mode === 'manual' ? Number(sv.manual_total || 0) : mod + (sv.proficient ? profBonus : 0) + Number(sv.bonus || 0);
      return [k.toUpperCase(), sv.proficient ? 'x' : '', fmtBonus(mod), fmtBonus(total)];
    }),
    styles: { fontSize: 7.5, cellPadding: 1, lineColor: theme.line, lineWidth: 0.2, textColor: theme.ink },
    headStyles: { fillColor: theme.panel, textColor: theme.ink },
    tableLineColor: theme.line,
    tableLineWidth: 0.2,
  });

  autoTable(doc, {
    startY: y,
    margin: { left: M + (PAGE_W - M * 2) * 0.37 + 4, right: M },
    head: [['Skill', 'P', 'E', 'Mod', 'Total']],
    body: Object.keys(skillAbility).map((name) => {
      const key = name.toLowerCase().replace(/ /g, '_');
      const sk = skills[key] || {};
      const mod = abilityMod(abil[skillAbility[name]]);
      const prof = sk.expertise ? profBonus * 2 : sk.proficient ? profBonus : 0;
      const total = sk.bonus_mode === 'manual' ? Number(sk.manual_total || 0) : mod + prof + Number(sk.bonus || 0);
      return [name, sk.proficient ? 'x' : '', sk.expertise ? 'x' : '', fmtBonus(mod), fmtBonus(total)];
    }),
    styles: { fontSize: 7.2, cellPadding: 1, lineColor: theme.line, lineWidth: 0.2, textColor: theme.ink },
    headStyles: { fillColor: theme.panel, textColor: theme.ink },
    tableLineColor: theme.line,
    tableLineWidth: 0.2,
  });

  y = Math.max(doc.lastAutoTable.finalY + 4, y + 56);
  const needsTail = y + 70 > PAGE_H - FOOTER_RESERVED;

  if (needsTail) {
    drawFooter(doc, 1, 1, stamp, theme); // temp total corrected later
    doc.addPage();
    drawHeader(doc, title, 'Currency and notes', 'NOTES', theme);
    y = M + 10;
  }

  y = section(doc, y, 'Currency and Quick Notes', theme);
  const cur = character?.currency || {};
  const curW = (PAGE_W - M * 2 - 8) / 5;
  ['cp', 'sp', 'ep', 'gp', 'pp'].forEach((k, i) => boxValue(doc, M + i * (curW + 2), y, curW, 14, k.toUpperCase(), cur[k] ?? 0, theme));
  y += 16;
  doc.setFillColor('#ffffff');
  doc.setDrawColor(theme.line);
  const notesH = Math.max(24, PAGE_H - FOOTER_RESERVED - y - 2);
  doc.roundedRect(M, y, PAGE_W - M * 2, notesH, 2, 2, 'FD');
  doc.setTextColor(theme.muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Quick Notes', M + 2, y + 4);

  // Spells page
  doc.addPage();
  drawHeader(doc, title, 'Spellbook', 'SPELLS', theme);
  y = M + 10;
  y = section(doc, y, 'Spellcasting Summary', theme);
  const sc = character?.spellcasting || {};
  const castAbility = (sc.ability || 'wis').toLowerCase();
  const castMod = abilityMod(abil[castAbility]);
  const saveDC = 8 + profBonus + castMod;
  const atkBonus = fmtBonus(profBonus + castMod);
  boxValue(doc, M, y, cW, 16, 'Class', (lookups.classes[sc.class_id] || sc.class_id || '').toLowerCase(), theme);
  boxValue(doc, M + cW + 2, y, cW, 16, 'Casting Ability', castAbility.toUpperCase(), theme);
  boxValue(doc, M + (cW + 2) * 2, y, cW, 16, 'Spell Save DC', saveDC, theme);
  boxValue(doc, M + (cW + 2) * 3, y, cW, 16, 'Spell Attack Bonus', atkBonus, theme);
  y += 19;

  y = section(doc, y, 'Spell Slots', theme);
  const lv = character?.spell_slots?.levels || {};
  const slotTxt = Array.from({ length: 9 }, (_, i) => `L${i + 1}: ${(lv[String(i + 1)] || {}).max || 0}/${(lv[String(i + 1)] || {}).used || 0}`).join(' | ');
  boxValue(doc, M, y, PAGE_W - M * 2, 16, 'Slots by Level (max/used)', slotTxt, theme);
  y += 19;

  const known = (character?.spells_known || []).map((s) => [
    `${s.name || ''} (L${s.level ?? ''})`,
    s.school || '',
    s.ritual ? 'Y' : 'N',
    s.concentration ? 'Y' : 'N',
    extractRange(s.range),
    extractDuration(s.duration),
  ]);
  const prepared = (character?.spells_prepared || []).map((s) => [
    `${s.name || ''} (L${s.level ?? ''})`,
    s.school || '',
    s.ritual ? 'Y' : 'N',
    s.concentration ? 'Y' : 'N',
    extractRange(s.range),
    extractDuration(s.duration),
  ]);

  y = section(doc, y, 'Spells Known', theme);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Name/Level', 'School', 'Ritual', 'Conc', 'Range', 'Duration']],
    body: known,
    styles: { fontSize: 7.2, cellPadding: 1, lineColor: theme.line, lineWidth: 0.2, textColor: theme.ink },
    headStyles: { fillColor: theme.panel, textColor: theme.ink },
    tableLineColor: theme.line,
    tableLineWidth: 0.2,
  });
  y = doc.lastAutoTable.finalY + 4;
  if (y + 40 > PAGE_H - FOOTER_RESERVED) {
    doc.addPage();
    drawHeader(doc, title, 'Spellbook', 'SPELLS', theme);
    y = M + 10;
  }
  y = section(doc, y, 'Spells Prepared', theme);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Name/Level', 'School', 'Ritual', 'Conc', 'Range', 'Duration']],
    body: prepared,
    styles: { fontSize: 7.2, cellPadding: 1, lineColor: theme.line, lineWidth: 0.2, textColor: theme.ink },
    headStyles: { fillColor: theme.panel, textColor: theme.ink },
    tableLineColor: theme.line,
    tableLineWidth: 0.2,
  });

  // Inventory page
  doc.addPage();
  drawHeader(doc, title, 'Inventory', 'GEAR', theme);
  y = M + 10;
  y = section(doc, y, 'Inventory', theme);
  const inv = (character?.inventory || []).map((it) => [
    `${it.name || ''} x${it.qty || 0}`,
    it.category || '',
    it.equipped ? 'Y' : 'N',
    it.attunement || '',
    it.notes || '',
  ]);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Item / Qty', 'Category', 'Eq', 'Att', 'Notes']],
    body: inv,
    styles: { fontSize: 7.2, cellPadding: 1, lineColor: theme.line, lineWidth: 0.2, textColor: theme.ink },
    headStyles: { fillColor: theme.panel, textColor: theme.ink },
    tableLineColor: theme.line,
    tableLineWidth: 0.2,
  });

  // Session log
  doc.addPage();
  drawHeader(doc, title, 'Session log', 'SESSION LOG', theme);
  const logRows = logs.map((r) => {
    let note = '';
    try {
      const parsed = JSON.parse(r.data_json || '{}');
      note = parsed.message || r.data_json || '';
    } catch {
      note = r.data_json || '';
    }
    return [String(r.timestamp_utc || '').replace('T', ' ').slice(0, 19), r.type || '', r.label || '', note];
  });
  autoTable(doc, {
    startY: M + 10,
    margin: { left: M, right: M, bottom: FOOTER_RESERVED },
    head: [['Timestamp', 'Type', 'Label', 'Notes / Outcome']],
    body: logRows,
    styles: { fontSize: 7.5, cellPadding: 1.2, lineColor: theme.line, lineWidth: 0.2, textColor: theme.ink },
    headStyles: { fillColor: theme.panel, textColor: theme.ink },
    tableLineColor: theme.line,
    tableLineWidth: 0.2,
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawHeader(doc, title, 'Session log', 'SESSION LOG', theme);
    },
  });

  // Campaign notes from play_state.session_notes
  const notes = character?.play_state?.session_notes || '';
  if (notes.trim()) {
    doc.addPage();
    drawHeader(doc, title, 'Campaign notes', 'CAMPAIGN NOTES', theme);
    let yy = M + 10;
    yy = section(doc, yy, 'Campaign Notes', theme);
    doc.setFillColor('#ffffff');
    doc.setDrawColor(theme.line);
    const boxH = PAGE_H - FOOTER_RESERVED - yy - 1;
    doc.roundedRect(M, yy, PAGE_W - M * 2, boxH, 2, 2, 'FD');
    doc.setTextColor(theme.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Narrative', M + 2, yy + 4.5);
    doc.setTextColor(theme.ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);

    const lines = doc.splitTextToSize(notes, PAGE_W - M * 2 - 6);
    let cursorY = yy + 10;
    const lineH = 4.4;
    for (const ln of lines) {
      if (cursorY > PAGE_H - FOOTER_RESERVED - 3) {
        doc.addPage();
        drawHeader(doc, title, 'Campaign notes', 'CAMPAIGN NOTES', theme);
        yy = M + 10;
        yy = section(doc, yy, 'Campaign Notes', theme);
        doc.setFillColor('#ffffff');
        doc.setDrawColor(theme.line);
        const h2 = PAGE_H - FOOTER_RESERVED - yy - 1;
        doc.roundedRect(M, yy, PAGE_W - M * 2, h2, 2, 2, 'FD');
        doc.setTextColor(theme.muted);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('Narrative', M + 2, yy + 4.5);
        doc.setTextColor(theme.ink);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.2);
        cursorY = yy + 10;
      }
      doc.text(ln, M + 3, cursorY);
      cursorY += lineH;
    }
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total, stamp, theme);
  }
  return doc;
}

if (form && fileInput && status && download) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    download.hidden = true;
    download.removeAttribute('href');
    status.textContent = '';

    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      status.textContent = 'Choose a ZIP file first.';
      return;
    }

    status.textContent = 'Forging your field journal...';
    try {
      const doc = await buildPdf(file);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      download.href = url;
      download.download = 'living-codex-campaign.pdf';
      download.hidden = false;
      status.textContent = 'PDF ready.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'PDF generation failed.';
    }
  });
}
