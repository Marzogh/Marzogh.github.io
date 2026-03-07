const MONO_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

const LANGUAGE_THEMES = {
  arduino: { label: 'Arduino', accent: '#10b7c7' },
  micropython: { label: 'MicroPython', accent: '#f2c94c' },
  circuitpython: { label: 'CircuitPython', accent: '#f2994a' },
  python: { label: 'Python', accent: '#4f9ded' },
  cpp: { label: 'C++', accent: '#86b6ff' },
  c: { label: 'C', accent: '#7eb3d3' },
  html: { label: 'HTML', accent: '#ff8a65' },
  css: { label: 'CSS', accent: '#66bbff' },
  js: { label: 'JavaScript', accent: '#ffd54f' },
  lua: { label: 'Lua', accent: '#9fa8ff' },
  text: { label: 'Text', accent: '#b0bec5' },
};

function languageFromExtension(name) {
  const file = (name || '').toLowerCase();
  if (file.endsWith('.ino')) return 'arduino';
  if (file.endsWith('.py')) return 'python';
  if (file.endsWith('.cpp') || file.endsWith('.cc') || file.endsWith('.cxx') || file.endsWith('.hpp') || file.endsWith('.hh')) return 'cpp';
  if (file.endsWith('.c') || file.endsWith('.h')) return 'c';
  if (file.endsWith('.html') || file.endsWith('.htm')) return 'html';
  if (file.endsWith('.css')) return 'css';
  if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs') || file.endsWith('.ts')) return 'js';
  if (file.endsWith('.lua')) return 'lua';
  return null;
}

function languageFromDeclared(dataLanguage) {
  const lang = (dataLanguage || '').toLowerCase().trim();
  if (!lang) return null;
  if (lang.includes('arduino') || lang === 'ino') return 'arduino';
  if (lang === 'micropython') return 'micropython';
  if (lang === 'circuitpython') return 'circuitpython';
  if (lang === 'python' || lang === 'py') return 'python';
  if (lang === 'cpp' || lang === 'c++' || lang === 'cxx') return 'cpp';
  if (lang === 'c') return 'c';
  if (lang === 'html' || lang === 'xml') return 'html';
  if (lang === 'css' || lang === 'scss' || lang === 'sass') return 'css';
  if (lang === 'js' || lang === 'javascript' || lang === 'ts' || lang === 'typescript') return 'js';
  if (lang === 'lua') return 'lua';
  return null;
}

function languageFromHeuristics(text) {
  const src = (text || '').toLowerCase();
  if (!src.trim()) return null;

  if (/(from\s+machine\s+import|import\s+machine|from\s+network\s+import|import\s+ujson|import\s+utime|pin\()/m.test(src)) {
    return 'micropython';
  }
  if (/(import\s+board|import\s+digitalio|import\s+busio|import\s+adafruit_)/m.test(src)) {
    return 'circuitpython';
  }
  if (/(void\s+setup\s*\(|void\s+loop\s*\(|serial\.begin\s*\(|#include\s*<arduino\.h>)/m.test(src)) {
    return 'arduino';
  }
  if (/(^|\n)\s*def\s+\w+\s*\(|(^|\n)\s*class\s+\w+|(^|\n)\s*import\s+\w+/m.test(src)) {
    return 'python';
  }
  if (/(#include\s*<iostream>|std::|template\s*<|namespace\s+\w+)/m.test(src)) {
    return 'cpp';
  }
  if (/(#include\s*<stdio\.h>|int\s+main\s*\(|printf\s*\()/m.test(src)) {
    return 'c';
  }
  if (/(<!doctype html>|<html|<head|<body|<div|<script)/m.test(src)) {
    return 'html';
  }
  if (/([.#][\w-]+\s*\{)|(@media|@keyframes|--[\w-]+\s*:)/m.test(src)) {
    return 'css';
  }
  if (/(function\s+\w+\(|const\s+\w+\s*=|let\s+\w+\s*=|=>|document\.)/m.test(src)) {
    return 'js';
  }
  if (/(local\s+\w+\s*=|function\s+\w+\s*\(|end\b|require\s*\()/m.test(src)) {
    return 'lua';
  }
  return null;
}

function pickLanguage(filenameText, declared, codeText) {
  const fromExt = languageFromExtension(filenameText);
  if (fromExt) {
    if (fromExt === 'python') {
      const pyFlavor = languageFromHeuristics(codeText);
      if (pyFlavor === 'micropython' || pyFlavor === 'circuitpython') return pyFlavor;
    }
    return fromExt;
  }
  const fromDeclared = languageFromDeclared(declared);
  if (fromDeclared) {
    if (fromDeclared === 'python') {
      const pyFlavor = languageFromHeuristics(codeText);
      if (pyFlavor === 'micropython' || pyFlavor === 'circuitpython') return pyFlavor;
    }
    return fromDeclared;
  }
  return languageFromHeuristics(codeText) || 'text';
}

function extractFilename(titleText) {
  const text = (titleText || '').trim();
  const afterDot = text.split('•').pop()?.trim() || text;
  return afterDot;
}

function ensureBadge(chrome) {
  let badge = chrome.querySelector('.codeLangBadge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'codeLangBadge';
    chrome.appendChild(badge);
  }
  return badge;
}

function ensureCopyButton(chrome, pre) {
  let button = chrome.querySelector('.codeCopyBtn');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'codeCopyBtn';
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy full code block');
    chrome.appendChild(button);
  }

  if (button.dataset.bound === '1') return button;
  button.dataset.bound = '1';

  const setState = (label, state) => {
    button.textContent = label;
    button.dataset.state = state;
  };

  const restoreIdle = () => setState('Copy', 'idle');

  button.addEventListener('click', async () => {
    const codeText = pre.querySelector('code')?.textContent ?? pre.textContent ?? '';
    if (!codeText.trim()) return;

    // Select the full code block so users can see what gets copied.
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(pre);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(codeText);
        copied = true;
      }
    } catch (_) {
      copied = false;
    }

    if (!copied) {
      try {
        copied = document.execCommand('copy');
      } catch (_) {
        copied = false;
      }
    }

    if (copied) {
      setState('Copied', 'ok');
      window.setTimeout(restoreIdle, 1600);
    } else {
      setState('Failed', 'err');
      window.setTimeout(restoreIdle, 2200);
    }
  });

  return button;
}

function applyLanguageStyling(win, pre) {
  const title = win.querySelector('.ideTitle');
  const chrome = win.querySelector('.ideChrome');
  const code = pre.querySelector('code');

  const baseTitle = (title?.dataset.baseTitle || title?.textContent || '').trim();
  if (title && !title.dataset.baseTitle) {
    title.dataset.baseTitle = baseTitle
      .replace(/^Code Window\s*•\s*/i, '')
      .replace(/^Code Terminal\s*•\s*/i, '')
      .replace(/^[^•]+\s*•\s*/, '');
  }
  const filename = extractFilename(title?.dataset.baseTitle || baseTitle);
  const declared = pre.dataset.language || '';
  const codeText = (code?.textContent || pre.textContent || '');
  const lang = pickLanguage(filename, declared, codeText);
  const theme = LANGUAGE_THEMES[lang] || LANGUAGE_THEMES.text;

  win.dataset.lang = lang;
  win.style.setProperty('--lang-accent', theme.accent);

  if (title) {
    title.textContent = `Code Terminal • ${filename}`;
  }
  if (chrome) {
    const badge = ensureBadge(chrome);
    badge.textContent = theme.label;
    ensureCopyButton(chrome, pre);
  }
}

function upgradeCodeWindows() {
  const windows = document.querySelectorAll('.codeFold .ideWindow');
  windows.forEach((win) => {
    const pre = win.querySelector('pre');
    if (!pre) return;

    // Avoid double-upgrading on hot reload / repeated calls.
    if (win.dataset.enhanced === '1') return;
    win.dataset.enhanced = '1';

    const viewport = document.createElement('div');
    viewport.className = 'termViewport';
    pre.parentNode.insertBefore(viewport, pre);
    viewport.appendChild(pre);

    // Force real scrolling behavior in both directions.
    viewport.style.maxHeight = '340px';
    viewport.style.overflow = 'auto';
    viewport.style.webkitOverflowScrolling = 'touch';

    pre.style.margin = '0';
    pre.style.borderRadius = '0';
    pre.style.overflow = 'visible';
    pre.style.minWidth = 'max-content';
    pre.style.fontFamily = MONO_STACK;
    pre.tabIndex = 0;

    const code = pre.querySelector('code');
    if (code) {
      code.style.whiteSpace = 'pre';
      code.style.wordBreak = 'normal';
      code.style.overflowWrap = 'normal';
      code.style.fontFamily = MONO_STACK;
    }

    applyLanguageStyling(win, pre);

    const observer = new MutationObserver(() => {
      applyLanguageStyling(win, pre);
    });
    observer.observe(pre, { childList: true, subtree: true, characterData: true });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', upgradeCodeWindows);
} else {
  upgradeCodeWindows();
}
