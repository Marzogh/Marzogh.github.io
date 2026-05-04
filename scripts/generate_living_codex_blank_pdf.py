#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime, timezone
import argparse
import json
import zipfile
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
import re

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "docs" / "pdf"
OUT_FILE = OUT_DIR / "living-codex-blank-template-v1.pdf"
OUT_FILE_V2 = OUT_DIR / "living-codex-blank-template-v2.pdf"
IMG_DIR = ROOT / "public" / "images" / "projects" / "living-codex"

PAGE_W, PAGE_H = A4
M = 14 * mm
CONTENT_W = PAGE_W - 2 * M
FOOTER_RESERVED = M + 22


def clamp_bottom(y_value):
    return max(y_value, FOOTER_RESERVED)

THEME = {
    "ink": colors.HexColor("#1b2432"),
    "muted": colors.HexColor("#4a5568"),
    "line": colors.HexColor("#c8d1df"),
    "accent": colors.HexColor("#b73a57"),
    "panel": colors.HexColor("#f6f8fc"),
}

ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"]
SKILL_ABILITY = {
    "acrobatics": "dex",
    "animal_handling": "wis",
    "arcana": "int",
    "athletics": "str",
    "deception": "cha",
    "history": "int",
    "insight": "wis",
    "intimidation": "cha",
    "investigation": "int",
    "medicine": "wis",
    "nature": "int",
    "perception": "wis",
    "performance": "cha",
    "persuasion": "cha",
    "religion": "int",
    "sleight_of_hand": "dex",
    "stealth": "dex",
    "survival": "wis",
}

RULESET_LABELS = {
    "dnd5e_2014": "D&D 5e (2014)",
    "dnd5e_2024": "D&D 5e (2024)",
}
LOOKUP_CACHE = {}


def draw_header(c, title, subtitle, page_tag, icon=True):
    top = PAGE_H - M
    c.setFillColor(THEME["ink"])
    c.setFont("Helvetica-Bold", 18)
    c.drawString(M, top, title)

    c.setFont("Helvetica", 10)
    c.setFillColor(THEME["muted"])
    c.drawString(M, top - 14, subtitle)

    c.setFillColor(THEME["accent"])
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(PAGE_W - M, top, page_tag)

    if icon:
        icon_path = IMG_DIR / "rahu-watermark-1.png"
        if icon_path.exists():
            c.saveState()
            c.setFillAlpha(0.18)
            c.drawImage(ImageReader(str(icon_path)), PAGE_W - M - 34, top - 28, width=28, height=28, mask='auto', preserveAspectRatio=True)
            c.restoreState()

    c.setStrokeColor(THEME["line"])
    c.setLineWidth(1)
    c.line(M, top - 22, PAGE_W - M, top - 22)


def draw_footer(c, left_text, center_text, right_text):
    c.setStrokeColor(THEME["line"])
    c.line(M, M - 2, PAGE_W - M, M - 2)
    c.setFont("Helvetica", 8)
    c.setFillColor(THEME["muted"])
    c.drawString(M, M - 10, left_text)
    c.drawCentredString(PAGE_W / 2, M - 10, center_text)
    c.drawRightString(PAGE_W - M, M - 10, right_text)


def box(c, x, y, w, h, label, lines=1):
    c.setFillColor(colors.white)
    c.setStrokeColor(THEME["line"])
    c.roundRect(x, y, w, h, 4, stroke=1, fill=1)
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(THEME["muted"])
    c.drawString(x + 4, y + h - 11, label)
    if lines > 0:
        c.setStrokeColor(colors.HexColor("#e6ebf3"))
        for i in range(lines):
            ly = y + h - 20 - (i * 11)
            if ly > y + 4:
                c.line(x + 4, ly, x + w - 4, ly)


def box_value(c, x, y, w, h, label, value, align="left"):
    box(c, x, y, w, h, label, lines=0)
    c.setFillColor(THEME["ink"])
    c.setFont("Helvetica-Bold", 9)
    text = "" if value is None else str(value)
    if len(text) > 52:
        text = text[:49] + "..."
    value_y = y + h / 2 - 8
    if align == "center":
        c.drawCentredString(x + w / 2, value_y, text)
    elif align == "right":
        c.drawRightString(x + w - 6, value_y, text)
    else:
        c.drawString(x + 6, value_y, text)


def section_title(c, x, y, text, width=170):
    c.setFillColor(THEME["panel"])
    c.setStrokeColor(THEME["line"])
    c.roundRect(x, y - 16, width, 20, 6, stroke=1, fill=1)
    c.setFillColor(THEME["accent"])
    c.setFont("Helvetica-Bold", 10)
    c.drawString(x + 6, y - 6, text)


def ability_mod(score):
    try:
        return (int(score) - 10) // 2
    except Exception:
        return 0


def fmt_bonus(n):
    sign = "+" if n >= 0 else ""
    return f"{sign}{n}"


def load_character_from_zip(zip_path):
    if not zip_path:
        return {}
    p = Path(zip_path).expanduser()
    if not p.exists():
        return {}
    with zipfile.ZipFile(p, "r") as zf:
        with zf.open("character.json") as f:
            return json.load(f)


def _is_hex_color(value):
    if not isinstance(value, str):
        return False
    v = value.strip()
    if not v.startswith("#"):
        return False
    h = v[1:]
    return len(h) in (3, 6, 8) and all(ch in "0123456789abcdefABCDEF" for ch in h)


def apply_theme_from_character(character):
    appearance = (character or {}).get("ui", {}).get("appearance", {})
    if not isinstance(appearance, dict):
        return
    mapping = {
        "ink": "ink",
        "inkSoft": "muted",
        "line": "line",
        "accent": "accent",
        "paper": "panel",
    }
    for src, dest in mapping.items():
        val = appearance.get(src)
        if _is_hex_color(val):
            THEME[dest] = colors.HexColor(val)


def load_log_rows_from_zip(zip_path):
    if not zip_path:
        return []
    p = Path(zip_path).expanduser()
    if not p.exists():
        return []
    rows = []
    with zipfile.ZipFile(p, "r") as zf:
        try:
            raw = zf.read("log.csv").decode("utf-8", errors="replace").splitlines()
        except KeyError:
            return []
    if not raw:
        return []
    header = [h.strip() for h in raw[0].split(",")]
    for line in raw[1:]:
        # safe parse for CSV with quoted JSON payload
        parts = []
        cur = []
        in_q = False
        i = 0
        while i < len(line):
            ch = line[i]
            if ch == '"' and (i + 1 < len(line) and line[i + 1] == '"'):
                cur.append('"')
                i += 2
                continue
            if ch == '"':
                in_q = not in_q
                i += 1
                continue
            if ch == "," and not in_q:
                parts.append("".join(cur))
                cur = []
                i += 1
                continue
            cur.append(ch)
            i += 1
        parts.append("".join(cur))
        row = dict(zip(header, parts))
        msg = ""
        dj = row.get("data_json", "").strip()
        if dj:
            try:
                msg = json.loads(dj).get("message", "") or ""
            except Exception:
                msg = dj
        rows.append({
            "timestamp": row.get("timestamp_utc", ""),
            "type": row.get("type", ""),
            "label": row.get("label", ""),
            "notes": msg,
        })
    return rows


def build_derived(character):
    abilities = character.get("abilities", {})
    combat = character.get("combat", {})
    prof_bonus = int(combat.get("proficiency_bonus", 0) or 0)
    saves = character.get("saving_throws", {})
    skills = character.get("skills", {})
    spellcasting = character.get("spellcasting", {})

    ability_mods = {k: ability_mod(abilities.get(k, 10)) for k in ABILITY_ORDER}

    save_rows = []
    for ab in ABILITY_ORDER:
        node = saves.get(ab, {})
        manual_mode = node.get("bonus_mode") == "manual"
        if manual_mode:
            total = int(node.get("manual_total", 0) or 0)
        else:
            total = ability_mods[ab] + (prof_bonus if node.get("proficient") else 0) + int(node.get("bonus", 0) or 0)
        save_rows.append({
            "name": ab.upper(),
            "prof": "x" if node.get("proficient") else "",
            "mod": fmt_bonus(ability_mods[ab]),
            "total": fmt_bonus(total),
        })

    skill_rows = []
    for name in sorted(SKILL_ABILITY.keys()):
        node = skills.get(name, {})
        ab = SKILL_ABILITY[name]
        manual_mode = node.get("bonus_mode") == "manual"
        if manual_mode:
            total = int(node.get("manual_total", 0) or 0)
        else:
            prof_part = prof_bonus * (2 if node.get("expertise") else (1 if node.get("proficient") else 0))
            total = ability_mods[ab] + prof_part + int(node.get("bonus", 0) or 0)
        skill_rows.append({
            "name": name.replace("_", " ").title(),
            "p": "x" if node.get("proficient") else "",
            "e": "x" if node.get("expertise") else "",
            "mod": fmt_bonus(ability_mods[ab]),
            "total": fmt_bonus(total),
        })

    cast_ability = spellcasting.get("ability", "")
    if cast_ability in ability_mods:
        cast_mod = ability_mods[cast_ability]
    else:
        cast_mod = max(ability_mods.values() or [0])
    save_dc = 8 + prof_bonus + cast_mod
    atk_bonus = prof_bonus + cast_mod
    passives = {
        "passive_perception": int(combat.get("passive_perception", 10) or 10),
        "passive_investigation": 10 + next((int(r["total"]) for r in skill_rows if r["name"] == "Investigation"), 0),
        "passive_insight": 10 + next((int(r["total"]) for r in skill_rows if r["name"] == "Insight"), 0),
        "spell_save_dc": save_dc,
        "spell_attack_bonus": fmt_bonus(atk_bonus),
    }

    return {
        "ability_mods": ability_mods,
        "save_rows": save_rows,
        "skill_rows": skill_rows,
        "passives": passives,
    }


def classes_summary(character):
    classes = character.get("core", {}).get("classes", []) if character else []
    if not classes:
        return ""
    ruleset_id = character.get("meta", {}).get("ruleset_id", "dnd5e_2014") if character else "dnd5e_2014"
    lookups = load_rules_lookups(ruleset_id)
    parts = []
    for cl in classes:
        cid = cl.get("id", "")
        class_name = lookups["classes"].get(cid, cid.replace("_", " ").title())
        sub = cl.get("subclassId", "")
        subclass_name = lookups["subclasses"].get((cid, sub), sub.replace("_", " ").title() if sub else "")
        lvl = cl.get("level", "")
        if sub:
            parts.append(f"{class_name} - {subclass_name} - Level {lvl}")
        else:
            parts.append(f"{class_name} - Level {lvl}")
    return ", ".join(parts)


def ruleset_label(ruleset_id):
    return RULESET_LABELS.get(ruleset_id, ruleset_id or "")


def species_label(species_id):
    return (species_id or "").replace("_", " ").title()


def load_rules_lookups(ruleset_id):
    rid = ruleset_id or "dnd5e_2014"
    if rid in LOOKUP_CACHE:
        return LOOKUP_CACHE[rid]
    candidate_roots = [
        ROOT / "public" / "living-codex" / "data",      # deployed/mirrored app assets
        ROOT / "vendor" / "the-living-codex" / "data",  # submodule source in repo
    ]
    base = None
    for root in candidate_roots:
        trial = root / rid
        if trial.exists():
            base = trial
            break
    if base is None:
        for root in candidate_roots:
            trial = root / "dnd5e_2014"
            if trial.exists():
                base = trial
                break
    if base is None:
        LOOKUP_CACHE[rid] = {"classes": {}, "species": {}, "subclasses": {}}
        return LOOKUP_CACHE[rid]

    lookups = {"classes": {}, "species": {}, "subclasses": {}}
    class_file = base / "classes.json"
    species_file = base / "species.json"
    subclass_file = base / "subclasses.json"
    if not class_file.exists():
        class_file = base / "classes.min.json"
    if not species_file.exists():
        species_file = base / "species.min.json"
    if not subclass_file.exists():
        subclass_file = base / "subclasses.min.json"

    try:
        if class_file.exists():
            for r in json.loads(class_file.read_text()):
                lookups["classes"][r.get("id", "")] = r.get("name", r.get("id", ""))
    except Exception:
        pass
    try:
        if species_file.exists():
            for r in json.loads(species_file.read_text()):
                lookups["species"][r.get("id", "")] = r.get("name", r.get("id", ""))
    except Exception:
        pass
    try:
        if subclass_file.exists():
            for r in json.loads(subclass_file.read_text()):
                lookups["subclasses"][(r.get("class_id", ""), r.get("id", ""))] = r.get("name", r.get("id", ""))
    except Exception:
        pass

    LOOKUP_CACHE[rid] = lookups
    return lookups


def clean_spell_field(value):
    if value is None:
        return ""
    txt = "".join(ch for ch in str(value) if 32 <= ord(ch) <= 126).strip()
    txt = " ".join(txt.split())
    # Hide obviously corrupted glyph soup
    if txt.count(".") > 8 or txt.count("|") > 6:
        return ""
    # keep only sensible printable values
    if not any(ch.isalpha() for ch in txt):
        return ""
    return txt


def extract_spell_range(value):
    txt = clean_spell_field(value)
    if not txt:
        return ""
    m = re.search(r"\b(Self|Touch|\d+\s*(?:feet|foot|miles?|meters?|metres?))\b", txt, flags=re.IGNORECASE)
    return m.group(1) if m else ""


def extract_spell_duration(value):
    txt = clean_spell_field(value)
    if not txt:
        return ""
    m = re.search(
        r"\b(Instantaneous|Until dispelled|\d+\s*(?:rounds?|minutes?|hours?|days?)|Concentration,\s*up to\s*\d+\s*(?:minutes?|hours?|days?))\b",
        txt,
        flags=re.IGNORECASE,
    )
    return m.group(1) if m else ""


def wrap_text_by_width(text, font_name, font_size, max_width):
    words = (text or "").split()
    lines = []
    line = ""
    for w in words:
        candidate = w if not line else f"{line} {w}"
        if stringWidth(candidate, font_name, font_size) <= max_width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def draw_list_table(c, x, y_top, w, h, title, columns, rows, row_height=12):
    box(c, x, y_top - h, w, h, title, lines=0)
    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColor(THEME["ink"])
    head_y = y_top - 22
    labels = [label for label, _ in columns]
    widths = [frac for _, frac in columns]
    col_x = [x + 5]
    running = x + 5
    for frac in widths[:-1]:
        running += w * frac
        col_x.append(running)
    for i, label in enumerate(labels):
        c.drawString(col_x[i], head_y, label)

    c.setStrokeColor(colors.HexColor("#e6ebf3"))
    c.line(x + 4, y_top - 26, x + w - 4, y_top - 26)
    c.setFont("Helvetica", 7.5)
    y = y_top - 37
    for row in rows:
        if y < (y_top - h + 8):
            break
        vals = [row.get("name", ""), row.get("prof", row.get("p", "")), row.get("e", ""), row.get("mod", ""), row.get("total", "")]
        for i, val in enumerate(vals[:len(labels)]):
            c.drawString(col_x[i], y, str(val))
        c.line(x + 4, y - 3, x + w - 4, y - 3)
        y -= row_height


def draw_two_col_text_blocks(c, x, y_top, w, h, title, rows, row_height=11):
    box(c, x, y_top - h, w, h, title, lines=0)
    c.setFont("Helvetica", 7.5)
    c.setFillColor(THEME["ink"])
    y = y_top - 18
    for left, right in rows:
        if y < y_top - h + 8:
            break
        ltxt = (left or "")[:38]
        rtxt = (right or "")[:62]
        c.drawString(x + 6, y, ltxt)
        c.drawString(x + w * 0.46, y, rtxt)
        c.setStrokeColor(colors.HexColor("#e6ebf3"))
        c.line(x + 4, y - 3, x + w - 4, y - 3)
        y -= row_height


def draw_grid_table(c, x, y_top, w, h, title, columns, rows, row_height=12):
    if title:
        box(c, x, y_top - h, w, h, title, lines=0)
        header_y = y_top - 18
        divider_y = y_top - 22
        start_y = y_top - 32
    else:
        c.setFillColor(colors.white)
        c.setStrokeColor(THEME["line"])
        c.roundRect(x, y_top - h, w, h, 4, stroke=1, fill=1)
        header_y = y_top - 12
        divider_y = y_top - 16
        start_y = y_top - 26
    # columns: [(label, key, frac), ...], frac sums to 1.0
    x_positions = [x + 4]
    run = x + 4
    for _, _, frac in columns[:-1]:
        run += (w - 8) * frac
        x_positions.append(run)

    c.setFillColor(THEME["ink"])
    c.setFont("Helvetica-Bold", 8)
    for i, (label, _, _) in enumerate(columns):
        c.drawString(x_positions[i] + 1, header_y, label)
    c.setStrokeColor(colors.HexColor("#d8dee8"))
    c.line(x + 4, divider_y, x + w - 4, divider_y)

    y = start_y
    c.setFont("Helvetica", 7.2)
    for row in rows:
        if y < y_top - h + 8:
            break
        for i, (_, key, _) in enumerate(columns):
            txt = str(row.get(key, ""))
            if len(txt) > 42:
                txt = txt[:39] + "..."
            c.drawString(x_positions[i] + 1, y, txt)
        c.line(x + 4, y - 2, x + w - 4, y - 2)
        y -= row_height


def page_core(c, title, stamp, character, derived, page_no, total_pages):
    draw_header(
        c,
        title,
        "Core sheet",
        "CORE",
    )

    y = PAGE_H - M - 38
    section_title(c, M, y, "Identity", width=CONTENT_W)
    y -= 26

    identity = character.get("identity", {}) if character else {}
    meta = character.get("meta", {}) if character else {}
    core = character.get("core", {}) if character else {}
    profile = character.get("profile", {}) if character else {}
    lookups = load_rules_lookups(meta.get("ruleset_id", "dnd5e_2014"))

    col = CONTENT_W / 4
    box_value(c, M, y - 34, col - 4, 32, "Player", identity.get("player_name") or profile.get("player_name", ""))
    box_value(c, M + col, y - 34, col - 4, 32, "Campaign", identity.get("campaign", ""))
    box_value(c, M + 2 * col, y - 34, col - 4, 32, "Ruleset", ruleset_label(meta.get("ruleset_id", "")))
    box_value(c, M + 3 * col, y - 34, col - 4, 32, "Species", lookups["species"].get(core.get("speciesId", ""), species_label(core.get("speciesId", ""))))

    y -= 42
    box_value(c, M, y - 36, CONTENT_W, 34, "Class / Subclass / Level", classes_summary(character))

    y -= 48
    section_title(c, M, y, "Abilities", width=CONTENT_W)
    y -= 26

    tile_w = (CONTENT_W - 20) / 6
    labels = ["STR", "DEX", "CON", "INT", "WIS", "CHA"]
    ability_mods = derived.get("ability_mods", {})
    ability_scores = (character or {}).get("abilities", {})
    for i, lab in enumerate(labels):
        x = M + i * (tile_w + 4)
        box(c, x, y - 46, tile_w, 44, f"{lab}", lines=0)
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(THEME["ink"])
        c.drawCentredString(x + tile_w / 2, y - 30, f"{fmt_bonus(ability_mods.get(lab.lower(), 0))}")
        c.setFont("Helvetica", 7.5)
        c.setFillColor(THEME["muted"])
        c.drawRightString(x + tile_w - 4, y - 40, f"{ability_scores.get(lab.lower(), '')}")

    y -= 58
    section_title(c, M, y, "Combat", width=CONTENT_W)
    y -= 26

    c_w = (CONTENT_W - 12) / 4
    combat = character.get("combat", {}) if character else {}
    top_vals = [combat.get("ac", ""), fmt_bonus(int(combat.get("initiative_bonus", 0) or 0)), combat.get("speed", ""), fmt_bonus(int(combat.get("proficiency_bonus", 0) or 0))]
    top_labels = ["AC", "Initiative", "Speed", "Proficiency Bonus"]
    for i, lab in enumerate(top_labels):
        box_value(c, M + i * (c_w + 4), y - 34, c_w, 32, lab, top_vals[i], align="center")

    y -= 42
    hp = combat.get("hp", {})
    low_vals = [hp.get("current", ""), hp.get("max", ""), hp.get("temp", ""), combat.get("passive_perception", "")]
    low_labels = ["HP Current", "HP Max", "HP Temp", "Passive Perception"]
    for i, lab in enumerate(low_labels):
        box_value(c, M + i * (c_w + 4), y - 34, c_w, 32, lab, low_vals[i], align="center")

    y -= 42
    box_value(c, M, y - 34, (CONTENT_W - 8) / 2, 32, "Hit Dice Used / Total", f"{combat.get('hit_dice_used','')}/{combat.get('hit_dice_total','')}", align="center")
    ds = combat.get("death_saves", {})
    conc = combat.get("concentration", {}).get("active", False)
    box_value(c, M + (CONTENT_W - 8) / 2 + 8, y - 34, (CONTENT_W - 8) / 2, 32, "Inspiration / Concentration / Death Saves", f"{combat.get('inspiration',0)} / {'Yes' if conc else 'No'} / {ds.get('success',0)}-{ds.get('fail',0)}", align="center")

    y -= 48
    section_title(c, M, y, "Saving Throws and Skills", width=CONTENT_W)
    y -= 26

    left_w = (CONTENT_W - 8) * 0.37
    right_w = (CONTENT_W - 8) * 0.63
    save_rows = derived.get("save_rows", [])
    skill_rows = derived.get("skill_rows", [])
    draw_list_table(
        c, M, y, left_w, 132, "Saving Throws",
        [("Save", 0.46), ("P", 0.14), ("Mod", 0.20), ("Total", 0.20)],
        save_rows[:6],
        row_height=15,
    )
    draw_list_table(
        c, M + left_w + 8, y, right_w, 132, "Skills",
        [("Skill", 0.52), ("P", 0.10), ("E", 0.10), ("Mod", 0.14), ("Total", 0.14)],
        skill_rows,
        row_height=13,
    )

    y -= 144
    section_title(c, M, y, "Senses and Spellcasting", width=CONTENT_W)
    y -= 26
    p = derived.get("passives", {})
    box_value(c, M, y - 34, (CONTENT_W - 8) / 2, 32, "Passive Perception", p.get("passive_perception", ""), align="center")
    box_value(c, M + (CONTENT_W - 8) / 2 + 8, y - 34, (CONTENT_W - 8) / 2, 32, "Passive Insight / Investigation", f"{p.get('passive_insight', '')} / {p.get('passive_investigation', '')}", align="center")

    y -= 46
    box_value(c, M, y - 34, (CONTENT_W - 8) / 2, 32, "Spell Save DC", p.get("spell_save_dc", ""), align="center")
    box_value(c, M + (CONTENT_W - 8) / 2 + 8, y - 34, (CONTENT_W - 8) / 2, 32, "Spell Attack Bonus", p.get("spell_attack_bonus", ""), align="center")

    # If this section cannot fit cleanly, move it to a dedicated next page.
    y -= 46
    needed_h = 26 + 26 + 24 + 10 + 38  # section title + gap + currency row + gap + notes box
    can_fit_tail = (y - needed_h) >= FOOTER_RESERVED
    if can_fit_tail:
        section_title(c, M, y, "Currency and Quick Notes", width=CONTENT_W)
        y -= 26
        cur_w = (CONTENT_W - 16) / 5
        currency = character.get("currency", {}) if character else {}
        for i, lab in enumerate(["CP", "SP", "EP", "GP", "PP"]):
            box_value(c, M + i * (cur_w + 4), y - 26, cur_w, 24, lab, currency.get(lab.lower(), ""), align="center")
        y -= 36
        box(c, M, y - 38, CONTENT_W, 38, "Quick Notes")

    draw_footer(c, "The Living Codex", stamp, f"Page {page_no} of {total_pages}")
    return not can_fit_tail


def page_currency_notes(c, title, stamp, character, page_no, total_pages):
    draw_header(c, title, "Currency and notes", "NOTES")
    y = PAGE_H - M - 38
    section_title(c, M, y, "Currency and Quick Notes", width=CONTENT_W)
    y -= 26
    cur_w = (CONTENT_W - 16) / 5
    currency = character.get("currency", {}) if character else {}
    for i, lab in enumerate(["CP", "SP", "EP", "GP", "PP"]):
        box_value(c, M + i * (cur_w + 4), y - 26, cur_w, 24, lab, currency.get(lab.lower(), ""), align="center")
    y -= 36
    notes_h = max(48, y - FOOTER_RESERVED)
    box(c, M, y - notes_h, CONTENT_W, notes_h, "Quick Notes")
    draw_footer(c, "The Living Codex", stamp, f"Page {page_no} of {total_pages}")


def _spell_rows(spells):
    rows = []
    for s in spells:
        rows.append({
            "name": f"{s.get('name','')} (L{s.get('level','')})",
            "school": s.get("school", ""),
            "ritual": "Y" if s.get("ritual") else "N",
            "conc": "Y" if s.get("concentration") else "N",
            "range": extract_spell_range(s.get("range", "")),
            "duration": extract_spell_duration(s.get("duration", "")),
        })
    return rows


def page_spells_known(c, title, stamp, character, page_no, total_pages):
    draw_header(
        c,
        title,
        "Spellbook",
        "SPELLS",
    )

    y = PAGE_H - M - 38
    section_title(c, M, y, "Spellcasting Summary", width=CONTENT_W)
    y -= 26

    col = CONTENT_W / 4
    sc = character.get("spellcasting", {}) if character else {}
    core = character.get("core", {}) if character else {}
    combat = character.get("combat", {}) if character else {}
    abilities = character.get("abilities", {}) if character else {}
    pbonus = int(combat.get("proficiency_bonus", 0) or 0)
    cast_ability = sc.get("ability") or "wis"
    cmod = ability_mod(abilities.get(cast_ability, 10))
    sdc = 8 + pbonus + cmod
    sab = fmt_bonus(pbonus + cmod)
    box_value(c, M, y - 30, col - 3, 28, "Class", sc.get("class_id") or (core.get("classes", [{}])[0].get("id", "") if core.get("classes") else ""), align="center")
    box_value(c, M + col, y - 30, col - 3, 28, "Casting Ability", (cast_ability or "").upper(), align="center")
    box_value(c, M + 2 * col, y - 30, col - 3, 28, "Spell Save DC", sdc, align="center")
    box_value(c, M + 3 * col, y - 30, col - 3, 28, "Spell Attack Bonus", sab, align="center")

    y -= 40
    section_title(c, M, y, "Spell Slots", width=CONTENT_W)
    y -= 26
    slots = character.get("spell_slots", {}).get("levels", {}) if character else {}
    slot_text = " | ".join([f"L{lvl}: {slots.get(str(lvl),{}).get('max',0)}/{slots.get(str(lvl),{}).get('used',0)}" for lvl in range(1, 10)])
    box_value(c, M, y - 56, CONTENT_W, 54, "Slots by Level (max/used)", slot_text)

    y -= 68
    section_title(c, M, y, "Spells Known", width=CONTENT_W)
    y -= 26
    known_rows = _spell_rows(character.get("spells_known", []) if character else [])
    # Keep room for prepared section and footer-safe boundary.
    min_bottom = FOOTER_RESERVED
    available_h = max(110, (y - min_bottom) * 0.48)
    known_h = min(170, available_h)
    draw_grid_table(
        c, M, y, CONTENT_W, known_h,
        "",
        [
            ("Name/Level", "name", 0.34),
            ("School", "school", 0.20),
            ("Ritual", "ritual", 0.10),
            ("Conc", "conc", 0.10),
            ("Range", "range", 0.13),
            ("Duration", "duration", 0.13),
        ],
        known_rows,
        row_height=13,
    )

    y2 = y - known_h - 14
    section_title(c, M, y2, "Spells Prepared", width=CONTENT_W)
    y2 -= 26
    prepared_rows = _spell_rows(character.get("spells_prepared", []) if character else [])
    prepared_h = max(90, y2 - FOOTER_RESERVED)
    draw_grid_table(
        c, M, y2, CONTENT_W, prepared_h,
        "",
        [
            ("Name/Level", "name", 0.34),
            ("School", "school", 0.20),
            ("Ritual", "ritual", 0.10),
            ("Conc", "conc", 0.10),
            ("Range", "range", 0.13),
            ("Duration", "duration", 0.13),
        ],
        prepared_rows,
        row_height=13,
    )
    draw_footer(c, "The Living Codex", stamp, f"Page {page_no} of {total_pages}")


def page_inventory(c, title, stamp, character, page_no, total_pages):
    draw_header(c, title, "Inventory", "GEAR")
    y = PAGE_H - M - 38
    section_title(c, M, y, "Inventory", width=CONTENT_W)
    y -= 26
    inv_rows = []
    for it in (character.get("inventory", []) if character else []):
        inv_rows.append({
            "item": f"{it.get('name','')} x{it.get('qty','')}",
            "cat": it.get("category", ""),
            "eq": "Y" if it.get("equipped") else "N",
            "att": it.get("attunement", ""),
            "notes": it.get("notes", ""),
        })
    inv_h = max(90, y - FOOTER_RESERVED)
    draw_grid_table(
        c, M, y, CONTENT_W, inv_h,
        "",
        [
            ("Item / Qty", "item", 0.36),
            ("Category", "cat", 0.16),
            ("Eq", "eq", 0.08),
            ("Att", "att", 0.10),
            ("Notes", "notes", 0.30),
        ],
        inv_rows,
        row_height=13,
    )
    draw_footer(c, "The Living Codex", stamp, f"Page {page_no} of {total_pages}")


def page_profile(c, title, stamp, character, page_no, total_pages):
    draw_header(
        c,
        title,
        "Story and utility",
        "PROFILE",
    )

    y = PAGE_H - M - 38
    section_title(c, M, y, "Identity and Story", width=CONTENT_W)
    y -= 26
    half = (CONTENT_W - 8) / 2
    identity = character.get("identity", {}) if character else {}
    profile = character.get("profile", {}) if character else {}
    left_ident = " | ".join(filter(None, [identity.get("background") or profile.get("background"), identity.get("alignment") or profile.get("alignment"), identity.get("ancestry")]))
    right_ident = " | ".join(filter(None, [str(profile.get("age","")), profile.get("height",""), profile.get("weight",""), profile.get("eyes",""), profile.get("skin",""), profile.get("hair","")]))
    box_value(c, M, y - 34, half, 32, "Background / Alignment / Ancestry", left_ident)
    box_value(c, M + half + 8, y - 34, half, 32, "Age / Height / Weight / Eyes / Skin / Hair", right_ident)

    y -= 46
    box_value(c, M, y - 76, half, 74, "Personality Traits", profile.get("personality_traits", ""))
    box_value(c, M + half + 8, y - 76, half, 74, "Ideals / Bonds / Flaws", " | ".join(filter(None, [profile.get("ideals",""), profile.get("bonds",""), profile.get("flaws","")])))

    y -= 88
    box_value(c, M, y - 76, half, 74, "Features / Traits", profile.get("features_traits", ""))
    box_value(c, M + half + 8, y - 76, half, 74, "Backstory", profile.get("backstory", ""))

    y -= 88
    section_title(c, M, y, "Defenses and Proficiencies", width=CONTENT_W)
    y -= 26
    defenses = character.get("defenses", {}) if character else {}
    prof = character.get("proficiencies", {}) if character else {}
    expertise = character.get("expertise", {}) if character else {}
    box_value(c, M, y - 72, half, 70, "Defenses", f"Imm: {', '.join(defenses.get('immunities', []))}  Res: {', '.join(defenses.get('resistances', []))}  Vuln: {', '.join(defenses.get('vulnerabilities', []))}")
    box_value(c, M + half + 8, y - 72, half, 70, "Proficiencies / Expertise", f"Lang: {', '.join(prof.get('languages', []))}  Tools: {', '.join(prof.get('tools', []))}  Skills(Exp): {', '.join(expertise.get('skills', []))}")

    y -= 84
    section_title(c, M, y, "Trackers and Notes", width=CONTENT_W)
    y -= 26
    trackers = character.get("trackers", []) if character else []
    track_txt = " | ".join([f"{t.get('name','tracker')}:{t.get('value','')}" for t in trackers]) if trackers else ""
    box_value(c, M, y - 70, CONTENT_W, 68, "Trackers and Notes", track_txt)

    # subtle character art on side
    art_path = IMG_DIR / "tarakesh-standing.png"
    if art_path.exists():
        c.saveState()
        c.setFillAlpha(0.11)
        c.drawImage(ImageReader(str(art_path)), PAGE_W - M - 68, M + 18, width=62, height=150, preserveAspectRatio=True, mask='auto')
        c.restoreState()

    draw_footer(c, "The Living Codex", stamp, f"Page {page_no} of {total_pages}")


def page_session_log(c, page_no, total_pages, title, stamp, log_rows):
    draw_header(
        c,
        title,
        "Session log",
        "SESSION LOG",
    )

    y = PAGE_H - M - 38

    data_rows = max(1, len(log_rows))
    row_h = 14
    rows = data_rows + 1

    x0 = M
    x1 = M + CONTENT_W * 0.22
    x2 = M + CONTENT_W * 0.36
    x3 = M + CONTENT_W * 0.50
    x4 = PAGE_W - M

    c.setStrokeColor(THEME["line"])
    c.setFillColor(colors.white)
    table_top = y - 6
    table_bottom = table_top - (rows * row_h)
    min_bottom = M + 14
    if table_bottom < min_bottom:
        row_h = max(10, (table_top - min_bottom) / rows)
        table_bottom = table_top - (rows * row_h)
    c.rect(M, table_bottom, CONTENT_W, table_top - table_bottom, stroke=1, fill=1)

    # header row
    hy = table_top
    c.setFillColor(THEME["panel"])
    c.rect(M, hy - row_h, CONTENT_W, row_h, stroke=1, fill=1)
    c.setFillColor(THEME["ink"])
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x0 + 4, hy - 11, "Timestamp")
    c.drawString(x1 + 4, hy - 11, "Type")
    c.drawString(x2 + 4, hy - 11, "Label")
    c.drawString(x3 + 4, hy - 11, "Notes / Outcome")

    c.setStrokeColor(THEME["line"])
    for x in [x1, x2, x3]:
        c.line(x, table_bottom, x, hy)

    y_line = hy - row_h
    for _ in range(data_rows):
        c.line(M, y_line, PAGE_W - M, y_line)
        y_line -= row_h

    # fill rows from zip log data
    c.setFillColor(THEME["ink"])
    c.setFont("Helvetica", 7)
    y_txt = hy - row_h - 9
    for row in log_rows:
        ts = row.get("timestamp", "")
        if len(ts) > 19:
            ts = ts[:19].replace("T", " ")
        typ = row.get("type", "")
        lab = row.get("label", "")
        notes = row.get("notes", "")
        if len(notes) > 68:
            notes = notes[:65] + "..."
        c.drawString(x0 + 3, y_txt, ts)
        c.drawString(x1 + 3, y_txt, typ)
        c.drawString(x2 + 3, y_txt, lab)
        c.drawString(x3 + 3, y_txt, notes)
        y_txt -= row_h

    # soft watermark
    mark = IMG_DIR / "rahu-watermark.png"
    if mark.exists():
        c.saveState()
        c.setFillAlpha(0.05)
        c.drawImage(ImageReader(str(mark)), M + CONTENT_W * 0.64, M + 24, width=92, height=92, preserveAspectRatio=True, mask='auto')
        c.restoreState()

    draw_footer(c, "The Living Codex", stamp, f"Page {page_no} of {total_pages}")


CAMPAIGN_NOTES_TEXT = """Generally rich population. Library of Ermack, fabled for knowledge, not open to public, takes up half the town and fountain. Body just appeared, might be magic. Bookkeeper's guild maintains order. Little child hears splash in fountain in town square and finds a man's corpse with a note pinned to the body: 'Next one at midnight'. Radall Tolstagg, local jeweller, found by Kara, daughter of local apothecary Katernin. We were at the bookkeeper's guild, 9 pm. Divination was blocked; priests could not work divination.

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

Tortle pickpocketed me. No GP."""


NOTES_LEADING = 10.2


def page_session_notes(c, page_no, total_pages, title, stamp, narrative_text):
    draw_header(
        c,
        title,
        "Campaign notes",
        "CAMPAIGN NOTES",
    )
    y = PAGE_H - M - 38
    section_title(c, M, y, "Campaign Notes", width=CONTENT_W)
    y -= 26
    # Fill the full remaining printable area down to footer margin.
    h = y - (M + 6)
    box(c, M, y - h, CONTENT_W, h, "Narrative", lines=0)
    c.setFont("Helvetica", 8.2)
    c.setFillColor(THEME["ink"])
    tx = c.beginText(M + 8, y - 28)
    tx.setLeading(NOTES_LEADING)
    max_width = CONTENT_W - 16
    bottom_y = y - h + 12
    for para in narrative_text.split("\n\n"):
        for line in wrap_text_by_width(para, "Helvetica", 8.2, max_width):
            if tx.getY() < bottom_y:
                break
            tx.textLine(line)
        if tx.getY() < bottom_y:
            break
        tx.textLine("")
    c.drawText(tx)
    draw_footer(c, "The Living Codex", stamp, f"Page {page_no} of {total_pages}")


def paginate_campaign_notes(text):
    paras = text.split("\n\n")
    pages = []
    current = []
    # Derive usable line budget from actual campaign notes layout geometry.
    y = PAGE_H - M - 38
    y -= 26  # below section title
    h = y - (M + 6)
    text_start = y - 28
    bottom_y = y - h + 12
    line_budget = max(8, int((text_start - bottom_y) / NOTES_LEADING))
    line_count = 0
    for para in paras:
        lines = wrap_text_by_width(para, "Helvetica", 8.2, CONTENT_W - 16)
        needed = len(lines) + 1
        if line_count + needed > line_budget and current:
            pages.append("\n\n".join(current))
            current = [para]
            line_count = needed
        else:
            current.append(para)
            line_count += needed
    if current:
        pages.append("\n\n".join(current))
    return pages


def core_needs_currency_tail_page():
    # Mirror page_core vertical flow deterministically.
    y = PAGE_H - M - 38
    y -= 26  # Identity title gap
    y -= 42  # identity row
    y -= 48  # class row + gap
    y -= 26  # abilities title gap
    y -= 58  # abilities tiles
    y -= 26  # combat title gap
    y -= 42  # combat row 1
    y -= 42  # combat row 2
    y -= 48  # hit dice/inspiration row
    y -= 26  # saves title gap
    y -= 144 # saves/skills block
    y -= 26  # senses title gap
    y -= 46  # senses row 1
    y -= 46  # senses row 2
    y -= 46  # pre-currency offset
    needed_h = 26 + 26 + 24 + 10 + 38
    return (y - needed_h) < FOOTER_RESERVED


def generate():
    parser = argparse.ArgumentParser(description="Generate Living Codex printable template PDF.")
    parser.add_argument("--zip", dest="zip_path", default="", help="Path to Living Codex export zip (optional).")
    parser.add_argument("--out", dest="out_path", default="", help="Output PDF path (optional).")
    args = parser.parse_args()

    character = load_character_from_zip(args.zip_path)
    apply_theme_from_character(character)
    all_logs = load_log_rows_from_zip(args.zip_path)
    derived = build_derived(character)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = Path(args.out_path).expanduser() if args.out_path else OUT_FILE_V2
    output_path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output_path), pagesize=A4)
    c.setTitle("The Living Codex - Blank Template v2")
    c.setAuthor("ChipsnCode / The Living Codex")
    c.setSubject("Printable blank sheet template generated from Living Codex v2 contract")
    cname = character.get("meta", {}).get("name", "[Character Name]")
    title = cname
    stamp = datetime.now(timezone.utc).strftime("Exported %Y-%m-%d %H:%M UTC")

    # Capacity mirrors page_session_log geometry and avoids orphan single-row pages.
    session_row_h = 14
    session_table_top = (PAGE_H - M - 38) - 6
    session_min_bottom = M + 14
    session_capacity = max(1, int((session_table_top - session_min_bottom) // session_row_h) - 1)
    log_chunks = [all_logs[i:i + session_capacity] for i in range(0, len(all_logs), session_capacity)] or [[]]
    note_pages = paginate_campaign_notes(CAMPAIGN_NOTES_TEXT)
    has_currency_tail = core_needs_currency_tail_page()
    total_pages = 5 + len(log_chunks) + max(0, len(note_pages) - 1) + (1 if has_currency_tail else 0)

    needs_tail = page_core(c, title, stamp, character, derived, 1, total_pages)
    page_idx = 2
    if needs_tail:
        c.showPage()
        page_currency_notes(c, title, stamp, character, page_idx, total_pages)
        page_idx += 1
    c.showPage()
    page_spells_known(c, title, stamp, character, page_idx, total_pages)
    page_idx += 1
    c.showPage()
    page_inventory(c, title, stamp, character, page_idx, total_pages)
    page_idx += 1
    c.showPage()
    page_profile(c, title, stamp, character, page_idx, total_pages)
    page_idx += 1

    for i, chunk in enumerate(log_chunks, start=1):
        c.showPage()
        page_session_log(c, page_idx, total_pages, title, stamp, chunk)
        page_idx += 1
    for idx, notes_text in enumerate(note_pages, start=1):
        c.showPage()
        page_session_notes(c, page_idx, total_pages, title, stamp, notes_text)
        page_idx += 1
    c.save()

    print(f"Generated: {output_path}")


if __name__ == "__main__":
    generate()
