#!/usr/bin/env python3
"""Add new dream symbols to sitemap.xml"""

from datetime import date
from pathlib import Path

SITEMAP_PATH = Path(__file__).resolve().parent.parent / "sitemap.xml"

# New symbols with their slugs (Tier 2)
new_symbols = [
    {
        'en': 'swimming',
        'fr': 'nager',
        'es': 'nadar'
    },
    {
        'en': 'crying',
        'fr': 'pleurer',
        'es': 'llorar'
    },
    {
        'en': 'elevator',
        'fr': 'ascenseur',
        'es': 'ascensor'
    },
    {
        'en': 'cliff',
        'fr': 'falaise',
        'es': 'acantilado'
    },
    {
        'en': 'lost',
        'fr': 'perdu',
        'es': 'perdido'
    }
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
        f'    <xhtml:link rel="alternate" hreflang="x-default" href="{alternates["x-default"]}" />',
        "  </url>",
    ]
    return "\n".join(lines) + "\n"


def main() -> None:
    sitemap = SITEMAP_PATH.read_text(encoding="utf-8")
    insert_at = sitemap.rfind("\n</urlset>")
    if insert_at == -1:
        raise RuntimeError(f"Could not find </urlset> in {SITEMAP_PATH}")

    blocks: list[str] = []
    skipped = 0

    for symbol in new_symbols:
        alternates = {
            "en": f'https://noctalia.app/en/symbols/{symbol["en"]}',
            "fr": f'https://noctalia.app/fr/symboles/{symbol["fr"]}',
            "es": f'https://noctalia.app/es/simbolos/{symbol["es"]}',
            "x-default": f'https://noctalia.app/en/symbols/{symbol["en"]}',
        }

        for lang, path_segment in [("en", "symbols"), ("fr", "symboles"), ("es", "simbolos")]:
            loc = f'https://noctalia.app/{lang}/{path_segment}/{symbol[lang]}'
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
