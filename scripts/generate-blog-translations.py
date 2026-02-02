#!/usr/bin/env python3
"""
Generate DE/IT blog translations from EN templates.

Usage:
  python3 scripts/generate-blog-translations.py extract
  python3 scripts/generate-blog-translations.py generate --lang de
  python3 scripts/generate-blog-translations.py generate --lang it
  python3 scripts/generate-blog-translations.py update-hreflang
  python3 scripts/generate-blog-translations.py update-sitemap

Notes:
- Uses Google Translate via deep-translator (no API key required).
- Preserves HTML structure by translating HTML fragments.
"""

import argparse
import json
import os
import re
import sys
import html as html_lib
import time
import unicodedata
from typing import Dict, List, Tuple

from bs4 import BeautifulSoup, NavigableString, Comment
from deep_translator import GoogleTranslator

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DOCS_DIR = os.path.join(ROOT, 'docs')
DATA_DIR = os.path.join(ROOT, 'data')
BLOG_SLUGS_PATH = os.path.join(DATA_DIR, 'blog-slugs.json')
DOMAIN = 'https://noctalia.app'

LANGS = ['en', 'fr', 'es', 'de', 'it']

LANG_INFO = {
    'en': {'locale': 'en_US', 'label': 'EN', 'name': 'English', 'symbols_dir': 'symbols'},
    'fr': {'locale': 'fr_FR', 'label': 'FR', 'name': 'Français', 'symbols_dir': 'symboles'},
    'es': {'locale': 'es_ES', 'label': 'ES', 'name': 'Español', 'symbols_dir': 'simbolos'},
    'de': {'locale': 'de_DE', 'label': 'DE', 'name': 'Deutsch', 'symbols_dir': 'traumsymbole'},
    'it': {'locale': 'it_IT', 'label': 'IT', 'name': 'Italiano', 'symbols_dir': 'simboli'},
}

DROPDOWN_ITEM_CLASS = (
    'dropdown-item flex items-center justify-between px-4 py-2 text-sm '
    'text-purple-100/80 hover:bg-white/10 hover:text-white transition-colors'
)

CHECK_ICON_CLASS = 'w-4 h-4 text-dream-salmon'

MAX_BATCH_CHARS = 2500
TRANSLATE_SLEEP = 0.1


def read_file(path: str) -> str:
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def write_file(path: str, content: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)


def list_blog_files(lang: str) -> List[str]:
    blog_dir = os.path.join(DOCS_DIR, lang, 'blog')
    if not os.path.isdir(blog_dir):
        return []
    return [os.path.join(blog_dir, name) for name in sorted(os.listdir(blog_dir)) if name.endswith('.html')]


def extract_slug_from_url(url: str) -> Tuple[str, str]:
    if not url or not url.startswith(DOMAIN):
        return ('', '')
    path = url[len(DOMAIN):]
    match = re.match(r'^/(en|fr|es|de|it)/blog/?([^?#]*)', path)
    if not match:
        return ('', '')
    lang = match.group(1)
    rest = match.group(2).strip('/')
    slug = '' if rest == '' else rest
    return (lang, slug)


def build_blog_url(lang: str, slug: str) -> str:
    if slug:
        return f'{DOMAIN}/{lang}/blog/{slug}'
    return f'{DOMAIN}/{lang}/blog/'


def slugify(text: str) -> str:
    value = text.strip().lower()
    value = value.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue')
    value = value.replace('ß', 'ss')
    value = unicodedata.normalize('NFKD', value)
    value = ''.join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r'[^a-z0-9]+', '-', value)
    value = re.sub(r'-+', '-', value).strip('-')
    return value


def load_symbol_slug_map() -> Dict[str, Dict[str, str]]:
    symbols_path = os.path.join(DOCS_DIR, 'data', 'dream-symbols.json')
    if not os.path.exists(symbols_path):
        return {}
    with open(symbols_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    mapping: Dict[str, Dict[str, str]] = {}
    for symbol in data.get('symbols', []):
        en = symbol.get('en', {}).get('slug')
        if not en:
            continue
        mapping[en] = {}
        for lang in ['fr', 'es', 'de', 'it']:
            target = symbol.get(lang, {}).get('slug')
            if target:
                mapping[en][lang] = target
    return mapping


def load_symbol_i18n() -> Dict[str, Dict[str, str]]:
    path = os.path.join(DOCS_DIR, 'data', 'symbol-i18n.json')
    if not os.path.exists(path):
        return {}
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def build_slug_map(translators: Dict[str, GoogleTranslator]) -> Dict[str, Dict[str, str]]:
    en_files = list_blog_files('en')
    slug_map: Dict[str, Dict[str, str]] = {}

    for file_path in en_files:
        name = os.path.basename(file_path)
        en_slug = '' if name == 'index.html' else name.replace('.html', '')
        html = read_file(file_path)
        soup = BeautifulSoup(html, 'html.parser')

        alternates = {}
        for link in soup.find_all('link', rel='alternate'):
            hreflang = link.get('hreflang')
            href = link.get('href')
            if not hreflang or not href:
                continue
            lang, slug = extract_slug_from_url(href)
            if lang:
                alternates[lang] = slug

        entry = slug_map.setdefault(en_slug or 'index', {})
        entry['en'] = en_slug
        for lang in ['fr', 'es']:
            if lang in alternates:
                entry[lang] = alternates[lang]

    # Generate de/it slugs from translated H1 or title
    used_slugs = {lang: set() for lang in ['de', 'it']}
    for key, mapping in slug_map.items():
        if key == 'index':
            mapping['de'] = ''
            mapping['it'] = ''
            continue
        en_slug = mapping.get('en', key)
        en_path = os.path.join(DOCS_DIR, 'en', 'blog', f'{en_slug}.html')
        if not os.path.exists(en_path):
            continue
        html = read_file(en_path)
        soup = BeautifulSoup(html, 'html.parser')
        h1 = soup.find('h1')
        title_text = h1.get_text(strip=True) if h1 else en_slug

        for lang in ['de', 'it']:
            if mapping.get(lang):
                continue
            translator = translators[lang]
            translated_title = translator.translate(title_text)
            candidate = slugify(translated_title)
            if not candidate:
                candidate = slugify(title_text)
            base = candidate
            counter = 2
            while candidate in used_slugs[lang]:
                candidate = f'{base}-{counter}'
                counter += 1
            used_slugs[lang].add(candidate)
            mapping[lang] = candidate

    return slug_map


def save_slug_map(slug_map: Dict[str, Dict[str, str]]) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    payload = {
        'version': 1,
        'defaultLang': 'en',
        'articles': {k: {'slugs': v} for k, v in sorted(slug_map.items())},
    }
    write_file(BLOG_SLUGS_PATH, json.dumps(payload, ensure_ascii=False, indent=2) + '\n')


def load_slug_map() -> Dict[str, Dict[str, str]]:
    if not os.path.exists(BLOG_SLUGS_PATH):
        return {}
    with open(BLOG_SLUGS_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    articles = data.get('articles', {})
    return {k: v.get('slugs', {}) for k, v in articles.items()}


def translate_text(text: str, translator: GoogleTranslator, cache: Dict[str, str]) -> str:
    if text in cache:
        return cache[text]
    if not text.strip():
        cache[text] = text
        return text
    last_err = None
    for attempt in range(3):
        try:
            translated = translator.translate(text)
            cache[text] = translated
            if TRANSLATE_SLEEP:
                time.sleep(TRANSLATE_SLEEP)
            return translated
        except Exception as err:
            last_err = err
            time.sleep(0.5 * (attempt + 1))
    raise last_err


SKIP_TEXT_PARENTS = {'script', 'style', 'code', 'pre', 'noscript'}


def translate_text_nodes(root, translator: GoogleTranslator, cache: Dict[str, str]) -> None:
    pending: List[Tuple[int, NavigableString, str, str, str]] = []
    batch_len = 0
    idx = 0

    def flush(batch_items: List[Tuple[int, NavigableString, str, str, str]]) -> None:
        if not batch_items:
            return
        html = ''.join(
            f'<span data-i=\"{i}\">{html_lib.escape(core)}</span>'
            for i, _, _, core, _ in batch_items
        )
        translated_html = translate_text(html, translator, cache)
        parsed = BeautifulSoup(translated_html, 'html.parser')
        for i, node, prefix, core, suffix in batch_items:
            span = parsed.find('span', attrs={'data-i': str(i)})
            translated = span.get_text() if span else core
            cache[core] = translated
            node.replace_with(f'{prefix}{translated}{suffix}')

    for node in root.find_all(string=True):
        if not isinstance(node, NavigableString):
            continue
        if isinstance(node, Comment):
            continue
        text = str(node)
        if not text.strip():
            continue
        parent = node.parent
        if parent and parent.name in SKIP_TEXT_PARENTS:
            continue

        match = re.match(r'^(\s*)(.*?)(\s*)$', text, re.S)
        if not match:
            continue
        prefix, core, suffix = match.groups()
        if not core:
            continue

        if core in cache:
            translated = cache[core]
            node.replace_with(f'{prefix}{translated}{suffix}')
            continue

        wrapper = f'<span data-i=\"{idx}\">{html_lib.escape(core)}</span>'
        if pending and batch_len + len(wrapper) > MAX_BATCH_CHARS:
            flush(pending)
            pending = []
            batch_len = 0
            idx = 0

        pending.append((idx, node, prefix, core, suffix))
        batch_len += len(wrapper)
        idx += 1

    flush(pending)


def translate_attributes(root, translator: GoogleTranslator, cache: Dict[str, str], attrs: List[str]) -> None:
    for tag in root.find_all(True):
        for attr in attrs:
            value = tag.get(attr)
            if not value or not isinstance(value, str):
                continue
            if value in cache:
                tag[attr] = cache[value]
                continue
            translated = translate_text(value, translator, cache)
            tag[attr] = translated


def update_hreflang_links(soup: BeautifulSoup, slug_map: Dict[str, Dict[str, str]], en_slug: str) -> None:
    head = soup.head
    if not head:
        return

    for link in head.find_all('link', rel='alternate'):
        link.decompose()

    insert_after = head.find('link', rel='next') or head.find('link', rel='prev') or head.find('link', rel='canonical')
    order = ['fr', 'en', 'es', 'de', 'it', 'x-default']

    for lang in order:
        if lang == 'x-default':
            href = build_blog_url('en', slug_map.get(en_slug, {}).get('en', en_slug) if en_slug != 'index' else '')
        else:
            slug = '' if en_slug == 'index' else slug_map.get(en_slug, {}).get(lang, '')
            href = build_blog_url(lang, slug)
        tag = soup.new_tag('link', rel='alternate')
        tag['hreflang'] = lang
        tag['href'] = href
        if insert_after:
            insert_after.insert_after(tag)
            insert_after = tag
        else:
            head.append(tag)
            insert_after = tag


def update_language_dropdown(soup: BeautifulSoup, current_lang: str, slug_map: Dict[str, Dict[str, str]], en_slug: str) -> None:
    button = soup.find('button', id='languageDropdownButton')
    if button:
        span = button.find('span')
        if span:
            span.string = LANG_INFO[current_lang]['label']

    menu = soup.find('div', id='languageDropdownMenu')
    if not menu:
        return
    menu.clear()

    for lang in ['en', 'fr', 'es', 'de', 'it']:
        slug = '' if en_slug == 'index' else slug_map.get(en_slug, {}).get(lang, '')
        href = f"../../{lang}/blog/{slug}" if slug else f"../../{lang}/blog/"

        item = soup.new_tag('a', href=href)
        item['hreflang'] = lang
        item['class'] = DROPDOWN_ITEM_CLASS
        item['role'] = 'menuitem'

        label = soup.new_tag('span')
        label.string = LANG_INFO[lang]['name']
        item.append(label)

        icon = soup.new_tag('i')
        icon['data-lucide'] = 'check'
        icon['class'] = CHECK_ICON_CLASS + ('' if lang == current_lang else ' hidden')
        item.append(icon)

        menu.append(item)


def update_internal_links(soup: BeautifulSoup, lang: str, slug_map: Dict[str, Dict[str, str]], symbol_slugs: Dict[str, Dict[str, str]]) -> None:
    lang_info = LANG_INFO[lang]
    for a in soup.find_all('a'):
        href = a.get('href')
        if not href:
            continue
        if href.startswith('http://') or href.startswith('https://') or href.startswith('mailto:'):
            continue
        if href.startswith('#'):
            continue

        # Language root links
        if href.startswith('/en/'):
            href = '/'+lang+href[3:]

        # Blog index
        if href.startswith('/en/blog/'):
            href = href.replace('/en/blog/', f'/{lang}/blog/')

        # Symbols links
        if href.startswith('../symbols/'):
            en_symbol = href.split('../symbols/', 1)[1]
            target = symbol_slugs.get(en_symbol, {}).get(lang, en_symbol)
            href = f"../{lang_info['symbols_dir']}/{target}"

        # Relative blog slugs
        if not href.startswith('/') and '/' not in href and href not in ['.', '..']:
            if href in slug_map:
                target_slug = slug_map[href].get(lang)
                if target_slug:
                    href = target_slug

        a['href'] = href


def update_nav_links(soup: BeautifulSoup, lang: str, i18n: Dict[str, Dict[str, str]]) -> None:
    nav = soup.find('nav', id='navbar')
    if not nav:
        return
    lang_data = i18n.get(lang, {})
    # brand
    brand = nav.find('a', href=re.compile(r'^/en/'))
    if brand:
        brand['href'] = f'/{lang}/'

    # nav items
    for link in nav.find_all('a'):
        if link.get('hreflang'):
            continue
        href = link.get('href', '')
        if href.endswith('#how-it-works') or href.endswith('#comment-ca-marche') or href.endswith('#como-funciona'):
            anchor = lang_data.get('nav_how_it_works_anchor')
            if anchor:
                link['href'] = f'/{lang}/#{anchor}'
            label = lang_data.get('nav_how_it_works')
            if label:
                link.string = label
        elif href.endswith('#features') or href.endswith('#fonctionnalites') or href.endswith('#caracteristicas'):
            anchor = lang_data.get('nav_features_anchor')
            if anchor:
                link['href'] = f'/{lang}/#{anchor}'
            label = lang_data.get('nav_features')
            if label:
                link.string = label
        elif '/blog/' in href:
            link['href'] = f'/{lang}/blog/'
            label = lang_data.get('nav_resources')
            if label:
                link.string = label


def update_footer_links(soup: BeautifulSoup, lang: str, i18n: Dict[str, Dict[str, str]]) -> None:
    footer = soup.find('footer')
    if not footer:
        return
    lang_data = i18n.get(lang, {})
    # resource link to blog index
    for link in footer.find_all('a'):
        href = link.get('href', '')
        if href.endswith('/blog/') or href.endswith('/blog'):
            link['href'] = f'/{lang}/blog/'
        # about/legal/privacy/terms
        if href.endswith('legal-notice') or href.endswith('mentions-legales') or href.endswith('aviso-legal'):
            slug = lang_data.get('legal_slug')
            if slug:
                link['href'] = f'../{slug}'
        if href.endswith('privacy-policy') or href.endswith('politique-confidentialite') or href.endswith('politica-privacidad'):
            slug = lang_data.get('privacy_slug')
            if slug:
                link['href'] = f'../{slug}'
        if href.endswith('terms') or href.endswith('cgu') or href.endswith('terminos'):
            slug = lang_data.get('terms_slug')
            if slug:
                link['href'] = f'../{slug}'
        if href.endswith('/about') or href.endswith('/a-propos') or href.endswith('/sobre'):
            slug = lang_data.get('about_slug')
            if slug:
                link['href'] = f'/{lang}/{slug}'


def translate_head(soup: BeautifulSoup, translator: GoogleTranslator, cache: Dict[str, str], lang: str, slug_map: Dict[str, Dict[str, str]], en_slug: str) -> None:
    # Title
    title_tag = soup.find('title')
    if title_tag and title_tag.string:
        title_tag.string = translate_text(title_tag.string, translator, cache)

    # Meta descriptions
    for meta in soup.find_all('meta'):
        name = meta.get('name')
        prop = meta.get('property')
        if name in ['description', 'twitter:description'] or prop in ['og:description']:
            content = meta.get('content')
            if content:
                meta['content'] = translate_text(content, translator, cache)
        if name == 'twitter:title' or prop == 'og:title':
            content = meta.get('content')
            if content:
                meta['content'] = translate_text(content, translator, cache)
        if prop == 'og:image:alt':
            content = meta.get('content')
            if content:
                meta['content'] = translate_text(content, translator, cache)
        if name == 'twitter:image:alt':
            content = meta.get('content')
            if content:
                meta['content'] = translate_text(content, translator, cache)
        if prop == 'og:locale':
            meta['content'] = LANG_INFO[lang]['locale']

    # Canonical + og:url
    canonical = soup.find('link', rel='canonical')
    if canonical:
        slug = '' if en_slug == 'index' else slug_map.get(en_slug, {}).get(lang, '')
        canonical['href'] = build_blog_url(lang, slug)
    og_url = soup.find('meta', property='og:url')
    if og_url:
        slug = '' if en_slug == 'index' else slug_map.get(en_slug, {}).get(lang, '')
        og_url['content'] = build_blog_url(lang, slug)

    # Prev/next links
    for rel in ['prev', 'next']:
        link = soup.find('link', rel=rel)
        if not link:
            continue
        href = link.get('href', '')
        _, target_en_slug = extract_slug_from_url(href)
        if target_en_slug:
            target_slug = slug_map.get(target_en_slug, {}).get(lang, target_en_slug)
            link['href'] = build_blog_url(lang, target_slug)

    # JSON-LD
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(script.string or '')
        except Exception:
            continue
        if isinstance(data, dict) and data.get('@type') == 'BlogPosting':
            if 'headline' in data:
                data['headline'] = translate_text(str(data['headline']), translator, cache)
            if 'description' in data:
                data['description'] = translate_text(str(data['description']), translator, cache)
            data['inLanguage'] = lang
            slug = '' if en_slug == 'index' else slug_map.get(en_slug, {}).get(lang, '')
            url = build_blog_url(lang, slug)
            if 'url' in data:
                data['url'] = url
            if 'mainEntityOfPage' in data and isinstance(data['mainEntityOfPage'], dict):
                data['mainEntityOfPage']['@id'] = url
        if isinstance(data, dict) and data.get('@type') == 'FAQPage':
            entities = data.get('mainEntity', [])
            for entity in entities:
                if not isinstance(entity, dict):
                    continue
                if 'name' in entity:
                    entity['name'] = translate_text(str(entity['name']), translator, cache)
                ans = entity.get('acceptedAnswer')
                if isinstance(ans, dict) and 'text' in ans:
                    ans['text'] = translate_text(str(ans['text']), translator, cache)
        if isinstance(data, dict) and data.get('@type') == 'Blog':
            if 'name' in data:
                data['name'] = translate_text(str(data['name']), translator, cache)
            if 'description' in data:
                data['description'] = translate_text(str(data['description']), translator, cache)
            data['inLanguage'] = lang
            data['url'] = build_blog_url(lang, '')
        if isinstance(data, dict) and data.get('@type') == 'ItemList':
            items = data.get('itemListElement', [])
            for item in items:
                if not isinstance(item, dict):
                    continue
                if 'name' in item:
                    item['name'] = translate_text(str(item['name']), translator, cache)
                if 'url' in item and isinstance(item['url'], str):
                    _, slug = extract_slug_from_url(item['url'])
                    if slug:
                        item['url'] = build_blog_url(lang, slug_map.get(slug, {}).get(lang, slug))
        script.string = json.dumps(data, ensure_ascii=False, indent=8)


def translate_body(soup: BeautifulSoup, translator: GoogleTranslator, cache: Dict[str, str]) -> None:
    targets = []
    nav = soup.find('nav', id='navbar')
    if nav:
        targets.append(nav)
    article = soup.find('article')
    if article:
        targets.append(article)
    aside = soup.find('aside', attrs={'role': 'note'})
    if aside:
        targets.append(aside)
    footer = soup.find('footer')
    if footer:
        targets.append(footer)

    for target in targets:
        translate_text_nodes(target, translator, cache)
        translate_attributes(target, translator, cache, ['alt', 'aria-label', 'title'])


def generate_article(lang: str, slug_map: Dict[str, Dict[str, str]], symbol_slugs: Dict[str, Dict[str, str]], i18n: Dict[str, Dict[str, str]], en_file: str, cache: Dict[str, str]) -> None:
    name = os.path.basename(en_file)
    en_slug = '' if name == 'index.html' else name.replace('.html', '')
    key = en_slug or 'index'
    target_slug = '' if key == 'index' else slug_map.get(key, {}).get(lang)
    if key != 'index' and not target_slug:
        return

    html = read_file(en_file)
    soup = BeautifulSoup(html, 'html.parser')

    if soup.html:
        soup.html['lang'] = lang

    translator = GoogleTranslator(source='en', target=lang)

    translate_head(soup, translator, cache, lang, slug_map, key)
    translate_body(soup, translator, cache)

    update_hreflang_links(soup, slug_map, key)
    update_language_dropdown(soup, lang, slug_map, key)
    update_nav_links(soup, lang, i18n)
    update_footer_links(soup, lang, i18n)
    update_internal_links(soup, lang, slug_map, symbol_slugs)

    out_dir = os.path.join(DOCS_DIR, lang, 'blog')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'index.html' if key == 'index' else f'{target_slug}.html')
    write_file(out_path, str(soup))


def update_existing_hreflang(slug_map: Dict[str, Dict[str, str]], i18n: Dict[str, Dict[str, str]]) -> None:
    for lang in ['en', 'fr', 'es', 'de', 'it']:
        for file_path in list_blog_files(lang):
            name = os.path.basename(file_path)
            en_slug = 'index' if name == 'index.html' else None
            if not en_slug:
                # use hreflang to resolve en slug
                html = read_file(file_path)
                soup = BeautifulSoup(html, 'html.parser')
                alternates = {link.get('hreflang'): link.get('href') for link in soup.find_all('link', rel='alternate')}
                en_href = alternates.get('en', '')
                _, en_slug = extract_slug_from_url(en_href)
                if not en_slug:
                    en_slug = name.replace('.html', '')
                en_slug = en_slug or 'index'
            else:
                html = read_file(file_path)
                soup = BeautifulSoup(html, 'html.parser')

            update_hreflang_links(soup, slug_map, en_slug)
            update_language_dropdown(soup, lang, slug_map, en_slug)
            update_nav_links(soup, lang, i18n)
            update_footer_links(soup, lang, i18n)
            write_file(file_path, str(soup))


def update_sitemap(slug_map: Dict[str, Dict[str, str]]) -> None:
    sitemap_path = os.path.join(DOCS_DIR, 'sitemap.xml')
    if not os.path.exists(sitemap_path):
        print('Missing docs/sitemap.xml', file=sys.stderr)
        return
    xml = read_file(sitemap_path)

    # Remove existing blog url blocks
    xml = re.sub(r'<url>\s*<loc>https://noctalia\.app/en/blog/.*?</url>\s*', '', xml, flags=re.S)

    def make_block(en_slug: str) -> str:
        slug = '' if en_slug == 'index' else en_slug
        main_url = build_blog_url('en', slug)
        lines = ['  <url>', f'    <loc>{main_url}</loc>']
        for lang in ['fr', 'en', 'es', 'de', 'it']:
            slug_value = '' if en_slug == 'index' else slug_map.get(en_slug, {}).get(lang, '')
            href = build_blog_url(lang, slug_value)
            lines.append(f'    <xhtml:link rel="alternate" hreflang="{lang}" href="{href}" />')
        lines.append(f'    <xhtml:link rel="alternate" hreflang="x-default" href="{main_url}" />')
        lines.append('  </url>')
        return '\n'.join(lines)

    blocks = []
    for en_slug in sorted(slug_map.keys()):
        blocks.append(make_block(en_slug))

    insert_pos = xml.rfind('</urlset>')
    if insert_pos == -1:
        print('Invalid sitemap.xml', file=sys.stderr)
        return
    next_xml = xml[:insert_pos] + '\n' + '\n'.join(blocks) + '\n' + xml[insert_pos:]
    write_file(sitemap_path, next_xml)


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='cmd', required=True)

    sub.add_parser('extract')

    gen = sub.add_parser('generate')
    gen.add_argument('--lang', required=True, choices=['de', 'it'])

    sub.add_parser('update-hreflang')
    sub.add_parser('update-sitemap')

    args = parser.parse_args()

    i18n = load_symbol_i18n()
    symbol_slugs = load_symbol_slug_map()

    if args.cmd == 'extract':
        translators = {
            'de': GoogleTranslator(source='en', target='de'),
            'it': GoogleTranslator(source='en', target='it'),
        }
        slug_map = build_slug_map(translators)
        save_slug_map(slug_map)
        print(f'Wrote slug map to {BLOG_SLUGS_PATH}')
        return

    slug_map = load_slug_map()
    if not slug_map:
        translators = {
            'de': GoogleTranslator(source='en', target='de'),
            'it': GoogleTranslator(source='en', target='it'),
        }
        slug_map = build_slug_map(translators)
        save_slug_map(slug_map)

    if args.cmd == 'generate':
        lang = args.lang
        en_files = list_blog_files('en')
        cache: Dict[str, str] = {}
        for en_file in en_files:
            generate_article(lang, slug_map, symbol_slugs, i18n, en_file, cache)
        return

    if args.cmd == 'update-hreflang':
        update_existing_hreflang(slug_map, i18n)
        return

    if args.cmd == 'update-sitemap':
        update_sitemap(slug_map)
        return


if __name__ == '__main__':
    main()
