# Bundled fonts

`scripts/subset-app-fonts.py` writes every font in this folder. Run it from the
repository root with fontTools installed (`pip install fonttools`) after you
upgrade a font package or add a name to the `MAPPING` of
`components/ui/icon-symbol.tsx`. Its output is deterministic.

## Text faces

| Files | Source | Version | License |
| --- | --- | --- | --- |
| `Lora_*.ttf` | `@expo-google-fonts/lora` 0.4.2 (Google Fonts, [cyrealtype/Lora-Cyrillic](https://github.com/cyrealtype/Lora-Cyrillic)) | 3.008 | SIL OFL 1.1, Reserved Font Name "Lora" ([OFL-Lora.txt](OFL-Lora.txt)) |
| `Fraunces_*.ttf` | `@expo-google-fonts/fraunces` 0.4.1 (Google Fonts, [undercasetype/Fraunces](https://github.com/undercasetype/Fraunces)) | 1.000 | SIL OFL 1.1 ([OFL-Fraunces.txt](OFL-Fraunces.txt)) |
| `Outfit_*.ttf` | `@expo-google-fonts/outfit` 0.4.3 (Google Fonts, [Outfitio/Outfit-Fonts](https://github.com/Outfitio/Outfit-Fonts)) | 1.100 | SIL OFL 1.1 ([OFL-Outfit.txt](OFL-Outfit.txt)) |

Each face keeps only the Latin ranges that English, French, German, Spanish,
Italian and Portuguese need (Basic Latin, Latin-1, Latin Extended-A, the
Romanian comma-below letters, combining marks, general punctuation, currency
signs and a few symbols), with all of its OpenType layout features, kerning
included. Characters outside these ranges, for example a dream typed in
Cyrillic, Greek or Vietnamese, are drawn by the system font.

A subset is a Modified Version under the OFL, and Lora's license reserves the
name "Lora". The Lora subsets are therefore renamed "Noctalia Serif" in their
name table (IDs 1, 3, 4, 6, 16 and 17). The app still loads them under the
`Lora_*` keys, which are only aliases inside the app. Fraunces and Outfit have
no reserved name and keep theirs.

## Icon font

`MaterialIconsSubset.ttf` comes from the MaterialIcons font of
`@expo/vector-icons` 15.0.3 (Material Icons 1.017, Copyright 2018 Google,
Apache License 2.0). It keeps the glyphs that `IconSymbol` can draw on Android
and the web: the `MAPPING` values and the `help` fallback.
`MaterialIconsSubset.json` is its glyph map. iOS draws SF Symbols and never
loads it.
