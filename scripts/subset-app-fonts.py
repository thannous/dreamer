#!/usr/bin/env python3
"""Subset the app's text and icon fonts.

Run from the repository root with fontTools installed (`pip install fonttools`):

    python3 scripts/subset-app-fonts.py

Text fonts: the 11 Lora, Fraunces and Outfit faces from @expo-google-fonts are
cut down to the Latin ranges that English, French, German, Spanish, Italian and
Portuguese need, keeping every OpenType layout feature (kerning, ligatures).
Lora is published with the Reserved Font Name "Lora", so its subsets are renamed
"Noctalia Serif" as the SIL Open Font License requires for a modified version.

Icon font: MaterialIcons from @expo/vector-icons is cut down to the glyphs the
Android and web IconSymbol fallback can render, and a matching glyph map is
written next to it.

The outputs are committed; rerun this script after upgrading a font package or
adding a name to the MAPPING of components/ui/icon-symbol.tsx.
"""
import json
import os
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'fonts')

# Basic Latin, Latin-1 and Latin Extended-A, the Romanian comma-below letters,
# modifier apostrophes, combining marks (NFD input), general punctuation,
# currency signs, and the few symbols the app's copy uses.
LATIN_UNICODES = (
    'U+0020-007E,U+00A0-017F,U+0152-0153,U+0218-021B,U+02BB-02BC,U+02C6,'
    'U+02DA,U+02DC,U+0300-036F,U+2000-206F,U+20A0-20CF,U+2122,U+2190-2199,'
    'U+2212,U+2215,U+221E,U+2248,U+2260,U+2264-2265,U+25CF,U+2713,U+FEFF,U+FFFD'
)

TEXT_FACES = {
    'lora': ['400Regular', '400Regular_Italic', '700Bold', '700Bold_Italic'],
    'fraunces': ['400Regular', '500Medium', '600SemiBold', '700Bold'],
    'outfit': ['400Regular', '500Medium', '700Bold'],
}

# Name IDs that carry the family name: family, full name, PostScript name,
# typographic family and subfamily, plus the unique ID.
RENAMED_NAME_IDS = (1, 3, 4, 6, 16, 17)
LORA_RENAME = ('Lora', 'Noctalia Serif')
LORA_POSTSCRIPT_RENAME = ('Lora', 'NoctaliaSerif')

VECTOR_ICONS = os.path.join(ROOT, 'node_modules', '@expo', 'vector-icons', 'build', 'vendor',
                            'react-native-vector-icons')
ICON_SYMBOL = os.path.join(ROOT, 'components', 'ui', 'icon-symbol.tsx')
# IconSymbol renders this name when MAPPING has no entry.
FALLBACK_ICON = 'help'


def subset_font(source, target, unicodes, layout_features):
    options = subset.Options()
    options.layout_features = layout_features
    options.name_IDs = ['*']
    options.name_languages = ['*']
    options.notdef_outline = True
    options.glyph_names = False
    options.drop_tables += ['DSIG']
    font = TTFont(source, recalcTimestamp=False)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    return font


def rename_lora(font):
    for record in font['name'].names:
        if record.nameID not in RENAMED_NAME_IDS:
            continue
        text = record.toUnicode()
        old, new = LORA_POSTSCRIPT_RENAME if record.nameID == 6 else LORA_RENAME
        record.string = text.replace(old, new)
    leftover = [r.toUnicode() for r in font['name'].names
                if r.nameID in RENAMED_NAME_IDS and 'Lora' in r.toUnicode()]
    if leftover:
        sys.exit(f'Lora subset still carries the reserved name: {leftover}')


def write_text_fonts():
    unicodes = subset.parse_unicodes(LATIN_UNICODES)
    for package, faces in TEXT_FACES.items():
        family = package.capitalize()
        for face in faces:
            key = f'{family}_{face}'
            source = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', package, face, f'{key}.ttf')
            font = subset_font(source, None, unicodes, ['*'])
            if package == 'lora':
                rename_lora(font)
            target = os.path.join(OUT, f'{key}.ttf')
            font.save(target)
            print(f'{key}: {os.path.getsize(source):,} -> {os.path.getsize(target):,} B')


def write_material_icons():
    source_text = open(ICON_SYMBOL).read()
    mapping = re.search(r'const MAPPING[^=]*= \{(.*?)\n\};', source_text, re.S)
    if not mapping:
        sys.exit('MAPPING not found in components/ui/icon-symbol.tsx')
    names = re.findall(r":\s*'([a-z0-9-]+)',", mapping.group(1)) + [FALLBACK_ICON]
    full_map = json.load(open(os.path.join(VECTOR_ICONS, 'glyphmaps', 'MaterialIcons.json')))
    missing = [name for name in names if name not in full_map]
    if missing:
        sys.exit(f'Unknown MaterialIcons names: {missing}')
    glyph_map = {name: full_map[name] for name in sorted(set(names))}
    source = os.path.join(VECTOR_ICONS, 'Fonts', 'MaterialIcons.ttf')
    # @expo/vector-icons draws by codepoint, never by ligature, so no layout table is kept.
    font = subset_font(source, None, sorted(set(glyph_map.values())), [])
    target = os.path.join(OUT, 'MaterialIconsSubset.ttf')
    font.save(target)
    with open(os.path.join(OUT, 'MaterialIconsSubset.json'), 'w') as handle:
        json.dump(glyph_map, handle, indent=2, sort_keys=True)
        handle.write('\n')
    print(f'MaterialIconsSubset: {len(glyph_map)} glyphs, {os.path.getsize(source):,} -> {os.path.getsize(target):,} B')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    write_text_fonts()
    write_material_icons()
