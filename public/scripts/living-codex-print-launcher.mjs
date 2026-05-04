import JSZip from 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm';

const form = document.getElementById('lcx-pdf-form');
const fileInput = document.getElementById('lcx-zip');
const status = document.getElementById('lcx-pdf-status');

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? '';
    });
    return row;
  });
}

if (form && fileInput && status) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = '';

    const file = fileInput.files?.[0];
    if (!file) {
      status.textContent = 'Choose a ZIP file first.';
      return;
    }

    status.textContent = 'Preparing print layout...';

    try {
      const zip = await JSZip.loadAsync(file);
      const charText = await zip.file('character.json')?.async('string');
      if (!charText) {
        status.textContent = 'ZIP is missing character.json.';
        return;
      }

      const payload = {
        character: JSON.parse(charText),
        inventoryCsv: (await zip.file('inventory.csv')?.async('string')) || '',
        spellsKnownCsv: (await zip.file('spells_known.csv')?.async('string')) || '',
        spellsPreparedCsv: (await zip.file('spells_prepared.csv')?.async('string')) || '',
        logCsv: (await zip.file('log.csv')?.async('string')) || '',
      };

      // Keep sessionStorage stable; portrait data URL can exceed quotas and isn't required for print layout.
      if (payload.character?.ui?.portrait?.data_url) {
        payload.character.ui.portrait.data_url = '';
      }

      sessionStorage.setItem('lcx_print_payload', JSON.stringify(payload));
      // sessionStorage is tab-scoped; keep a one-time localStorage handoff for new-tab open.
      localStorage.setItem('lcx_print_payload_handoff', JSON.stringify(payload));
      window.open('/living-codex/print-sheet', '_blank');
      status.textContent = 'Print layout opened in a new tab.';
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not parse ZIP.';
    }
  });
}

export { parseCsv };
