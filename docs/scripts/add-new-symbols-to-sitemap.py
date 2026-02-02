#!/usr/bin/env python3
"""Add new dream symbols to sitemap.xml.

Note: this is a one-off helper. Source of truth for slugs is `data/dream-symbols.json`.
"""

from datetime import date
from pathlib import Path
import json

SITEMAP_PATH = Path(__file__).resolve().parent.parent / "sitemap.xml"
SYMBOLS_PATH = Path(__file__).resolve().parent.parent / "data" / "dream-symbols.json"

LANGS = ["en", "fr", "es", "de", "it"]
PATH_SEGMENT = {
    "en": "symbols",
    "fr": "symboles",
    "es": "simbolos",
    "de": "traumsymbole",
    "it": "simboli",
}

# New symbols by id (must exist in data/dream-symbols.json)
new_symbol_ids = [
    "wolf",
    "horse",
    "ex-partner",
    "rainbow",
    "storm",
]

today = date.today().isoformat()

def build_url_block(*, loc: str, lastmod: str, priority: str, alternates: dict[str, str]) -> str:
    lines: list[str] = [
        "  <url>",
        f"    <loc>{loc}</loc>",
        f"    <lastmod>{lastmod}</lastmod>",
        f"    <priority>{priority}</priority>",
        f'    <xhtml:link rel="alternate" hreflang="en" href="{alternates["en"]}" />',
        f'    <xhtml:link rel="alternate" hreflang="fr" href="{alternates["fr"]}" />',
        f'    <xhtml:link rel="alternate" hreflang="es" href="{alternates["es"]}" />',
        f'    <xhtml:link rel="alternate" hreflang="de" href="{alternates["de"]}" />',
        f'    <xhtml:link rel="alternate" hreflang="it" href="{alternates["it"]}" />',
        f'    <xhtml:link rel="alternate" hreflang="x-default" href="{alternates["x-default"]}" />',
        "  </url>",
    ]
    return "\n".join(lines) + "\n"


def main() -> None:
    sitemap = SITEMAP_PATH.read_text(encoding="utf-8")
    insert_at = sitemap.rfind("\n</urlset>")
    if insert_at == -1:
        raise RuntimeError(f"Could not find </urlset> in {SITEMAP_PATH}")

    symbols_data = json.loads(SYMBOLS_PATH.read_text(encoding="utf-8"))
    by_id = {s["id"]: s for s in symbols_data.get("symbols", [])}

    blocks: list[str] = []
    skipped = 0

    for symbol_id in new_symbol_ids:
        symbol = by_id.get(symbol_id)
        if not symbol:
            raise RuntimeError(f'Symbol id "{symbol_id}" not found in {SYMBOLS_PATH}')

        slugs = {}
        for lang in LANGS:
            slug = symbol.get(lang, {}).get("slug")
            if not slug:
                raise RuntimeError(f'Symbol id "{symbol_id}" missing {lang}.slug in {SYMBOLS_PATH}')
            slugs[lang] = slug

        alternates = {
            lang: f'https://noctalia.app/{lang}/{PATH_SEGMENT[lang]}/{slugs[lang]}' for lang in LANGS
        }
        alternates["x-default"] = alternates["en"]

        for lang in LANGS:
            path_segment = PATH_SEGMENT[lang]
            loc = f'https://noctalia.app/{lang}/{path_segment}/{slugs[lang]}'
            if f"<loc>{loc}</loc>" in sitemap:
                skipped += 1
                continue

            blocks.append(
                build_url_block(
                    loc=loc,
                    lastmod=today,
                    priority="0.6",
                    alternates=alternates,
                )
            )

    if not blocks:
        print("✓ No new URLs to add (all present already)")
        return

    updated = sitemap[:insert_at] + "".join(blocks) + sitemap[insert_at:]
    SITEMAP_PATH.write_text(updated, encoding="utf-8")

    added = len(blocks)
    print(f"✓ Added {added} new URLs to sitemap.xml")
    if skipped:
        print(f"✓ Skipped {skipped} URLs already present")
    print(f"✓ Set lastmod to {today}")


if __name__ == "__main__":
    main()
