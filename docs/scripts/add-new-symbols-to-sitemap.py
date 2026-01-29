#!/usr/bin/env python3
"""Add new dream symbols to sitemap.xml"""

import xml.etree.ElementTree as ET
from datetime import date

# Register namespaces
ET.register_namespace('', 'http://www.sitemaps.org/schemas/sitemap/0.9')
ET.register_namespace('xhtml', 'http://www.w3.org/1999/xhtml')

# Parse sitemap
tree = ET.parse('../sitemap.xml')
root = tree.getroot()

# Namespace
ns = {
    '': 'http://www.sitemaps.org/schemas/sitemap/0.9',
    'xhtml': 'http://www.w3.org/1999/xhtml'
}

# New symbols with their slugs
new_symbols = [
    {
        'en': 'wedding',
        'fr': 'mariage',
        'es': 'boda'
    },
    {
        'en': 'hospital',
        'fr': 'hopital',
        'es': 'hospital'
    },
    {
        'en': 'running',
        'fr': 'courir',
        'es': 'correr'
    },
    {
        'en': 'school',
        'fr': 'ecole',
        'es': 'escuela'
    },
    {
        'en': 'pregnancy',
        'fr': 'grossesse',
        'es': 'embarazo'
    }
]

today = date.today().isoformat()

# For each language, add URLs
for symbol in new_symbols:
    for lang, path_segment in [('en', 'symbols'), ('fr', 'symboles'), ('es', 'simbolos')]:
        slug = symbol[lang]

        # Create URL element
        url_elem = ET.Element('url')

        # Add loc
        loc = ET.SubElement(url_elem, 'loc')
        loc.text = f'https://noctalia.app/{lang}/{path_segment}/{slug}'

        # Add lastmod
        lastmod = ET.SubElement(url_elem, 'lastmod')
        lastmod.text = today

        # Add priority
        priority = ET.SubElement(url_elem, 'priority')
        priority.text = '0.6'

        # Add hreflang links
        for hreflang, href_lang, href_path in [
            ('en', 'en', 'symbols'),
            ('fr', 'fr', 'symboles'),
            ('es', 'es', 'simbolos')
        ]:
            xhtml_link = ET.SubElement(url_elem, '{http://www.w3.org/1999/xhtml}link')
            xhtml_link.set('rel', 'alternate')
            xhtml_link.set('hreflang', hreflang)
            xhtml_link.set('href', f'https://noctalia.app/{href_lang}/{href_path}/{symbol[href_lang]}')

        # Add x-default
        xhtml_default = ET.SubElement(url_elem, '{http://www.w3.org/1999/xhtml}link')
        xhtml_default.set('rel', 'alternate')
        xhtml_default.set('hreflang', 'x-default')
        xhtml_default.set('href', f'https://noctalia.app/en/symbols/{symbol["en"]}')

        # Append to root (before the last few static pages)
        root.insert(-5, url_elem)

# Write back
tree.write('../sitemap.xml', encoding='utf-8', xml_declaration=True)
print(f"✓ Added 15 new URLs to sitemap.xml (5 symbols × 3 languages)")
print(f"✓ Updated lastmod to {today}")
