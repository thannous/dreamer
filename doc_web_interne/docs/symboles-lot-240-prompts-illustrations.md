# Illustrations des 40 symboles du lot 200 → 240 (prompts)

18 octobre 2026. Une illustration par symbole ajouté au dictionnaire dans cette PR. En attendant,
chaque fiche affiche une affiche provisoire (`docs-src/static/img/symbols/placeholders-2026-10-18/`),
enregistrée dans `docs-src/config/symbol-image-assets.json`.

## Style commun

Repris des 40 illustrations du 17 octobre (`editorial-2026-10-17/`, par exemple tigre, église,
portefeuille) : peinture numérique détaillée, nuit bleu-violet, une seule source de lumière chaude
(lanterne, bougie, fenêtre éclairée, lune), brume légère, ambiance calme et un peu étrange, jamais gore.

À coller avant chaque prompt :

```text
Painterly digital illustration for a dream dictionary, cinematic 16:9 landscape, 1600x900.
Deep indigo and violet night palette, soft mist, one warm amber light source as the only accent,
gentle moonlight rim light, rich detail, calm and slightly uncanny dream atmosphere.
Main subject clearly readable at thumbnail size, placed slightly off-centre with breathing room on
all sides (the image is cropped to cards and to a 16:9 hero). No text, no letters, no logos,
no watermark, no frame. No recognisable real person, no visible face in close-up, no gore,
no weapon pointed at the viewer.
```

Import : comme pour le lot du 17 octobre, une image par identifiant (colonne « id »), puis
`docs:build` régénère les déclinaisons responsives. L'URL des pages ne change pas.

## Prompts

| id | Symbole | Prompt (scène) |
| --- | --- | --- |
| `light` | Lumière | A long dark stone corridor at night ending in a soft doorway of warm golden light; dust motes floating in the beam, the floor wet and reflecting the glow, the rest of the corridor in deep violet shadow. |
| `lighthouse` | Phare | A tall white lighthouse on a black rocky headland at night, its warm beam sweeping across a violet sea through light mist, a full moon behind thin clouds, waves breaking softly on the rocks below. |
| `window` | Fenêtre | An old wooden window seen from inside a dark bedroom, half open, a sheer curtain lifting in the night breeze; outside, an impossible moonlit landscape of floating hills; a small amber lamp on the sill. |
| `clock` | Horloge | A large antique wall clock in a dim hallway, its pendulum caught mid-swing and its hands slightly blurred as if spinning; amber light from a wall lamp, long shadows, violet night through a nearby window. |
| `train-station` | Gare | An empty railway platform at night under an iron and glass canopy, one warm lamp lit, a departure board with blank panels (no text), mist drifting over the tracks, a single train light far away in the dark. |
| `wall` | Mur | A tall ancient stone wall crossing a misty moonlit field, ivy climbing it, one small arched wooden door closed in the middle with a warm lantern hanging beside it; the wall seems to go on forever on both sides. |
| `library` | Bibliothèque | An immense silent library at night with shelves rising into darkness, rolling ladders, a single reading table lit by a green-shaded brass lamp, an open book glowing faintly, violet moonlight through tall windows. |
| `neighbor` | Voisin | Two small houses side by side at night separated by a low garden fence; one window lit warm amber, the other dark; a shared path between them, a cat sitting on the fence, mist over the lawns. |
| `hallway` | Couloir | An endless hallway with identical closed doors on both sides receding into violet darkness, an old patterned carpet, one door at the far end slightly ajar with warm light leaking out. |
| `city` | Ville | A dreamlike city at night seen from a rooftop, streets glowing amber, buildings subtly shifting and folding into each other at the edges, a crescent moon above a violet sky, light fog between the towers. |
| `street` | Rue | A narrow cobbled street at night after rain, old façades with closed shutters, one streetlamp casting warm light on the wet stones, a lit café window, the street curving away into mist. |
| `tunnel` | Tunnel | Inside a long arched brick tunnel at night, puddles on the ground reflecting a warm circle of light at the far end, the walls damp and violet in the shadows, faint mist drifting toward the exit. |
| `maze` | Labyrinthe | A tall hedge maze seen from slightly above at night, paths glowing faintly in moonlight, a single warm lantern placed at one junction deep inside, mist pooling in the corridors, no visible exit. |
| `tower` | Tour | A solitary old stone tower on a hill under a full moon, one window near the top lit warm amber, a spiral staircase visible through a broken section of wall, clouds drifting around its summit. |
| `wind` | Vent | A lone tree on a moonlit hillside bent by a strong wind, leaves and petals streaming through the air in long curves, grass flattened in waves, a small amber lantern swinging from a branch. |
| `fog` | Brouillard | A country road disappearing into thick fog at night, two faint amber lights glowing somewhere inside the mist, the silhouettes of trees barely visible, moonlight diffused into a soft violet haze. |
| `ice` | Glace / Gel | A frozen lake at night with thin cracks spreading across the ice like veins of light, a small warm lantern resting on the ice, snowy pines on the shore, a pale moon reflected in the clear patches. |
| `clouds` | Nuages | A sea of soft clouds at night seen from above, lit violet and silver by the moon, a few clouds glowing warm amber from a hidden light beneath, the tops forming gentle hills and towers. |
| `waves` | Vagues | Tall waves rolling toward a moonlit shore at night, one large wave curling with light shining through its crest, spray glittering, a small warm light on a distant jetty, violet sky with thin clouds. |
| `outer-space` | Espace / Planètes | A small figure seen from behind, tiny in the frame, floating weightless above a violet planet with rings, the Earth far away as a blue marble, stars and nebula mist around, a warm glow from a distant sun. |
| `burglar` | Voleur / Cambrioleur | A dark living room at night seen from the hallway, a back door slightly open onto the moonlit garden, a tall indistinct shadow on the wall (no figure visible), a warm lamp in the hall, curtains moving. |
| `royalty` | Roi / Reine | An empty throne room at night, a golden crown resting on a velvet cushion on the throne, moonlight through tall arched windows, candles burning in wall sconces, long violet shadows on the marble floor. |
| `crowd` | Foule | A dense crowd of indistinct silhouettes in a moonlit city square at night, all turned in the same direction, one figure seen from behind standing still among them, warm lanterns strung above, light mist. |
| `twins` | Jumeaux | Two identical silhouettes seen from behind, standing hand in hand on a moonlit beach, their reflections in the wet sand slightly different from each other, a warm light on the horizon, violet sky. |
| `dragon` | Dragon | A large dragon with dark violet scales curled around a rocky peak at night, wings half folded, its eyes glowing warm amber, mist below, a full moon behind, majestic rather than menacing. |
| `unicorn` | Licorne | A white unicorn standing in a misty forest clearing at night, its horn catching the moonlight, fireflies and a warm glow among the ferns, ancient trees around, quiet and luminous. |
| `fox` | Renard | A red fox sitting at the edge of a moonlit forest path at night, looking back over its shoulder, its fur lit warm by a lantern hanging from a branch, mist between the trees. |
| `fly` | Mouche | A single housefly resting on the rim of a glass on a kitchen table at night, shown large and detailed, iridescent wings catching the light of a warm lamp, a few other flies blurred in the violet background. |
| `jellyfish` | Méduse | Glowing jellyfish drifting in deep violet water at night, their tentacles trailing like threads of light, one larger jellyfish in the foreground lit from within in warm amber, moonlight from the surface above. |
| `octopus` | Pieuvre | A large octopus in a moonlit underwater cave, its tentacles spreading gracefully across the rocks, one tentacle curled around an old brass lantern glowing warm, small bubbles rising, violet water. |
| `candle` | Bougie | A single candle burning on a wooden table in a dark room, its flame bending slightly in a draught, melted wax, a soft circle of warm light, moonlight through a window behind, the rest in violet shadow. |
| `broken-glass` | Verre brisé | Shards of a broken window scattered on a wooden floor at night, each shard reflecting fragments of the moon and a warm lamp, the empty window frame behind open onto a violet sky, no blood. |
| `gift` | Cadeau | A wrapped gift box with a loose silk ribbon on the floor of an empty room at night, its lid slightly lifted and warm light spilling out from inside, moonlight through a window, dust in the air. |
| `bag` | Sac / Sac à main | A leather handbag lying open on a wet bench at a deserted bus shelter at night, a few belongings half spilled out, a streetlamp casting warm light, mist on the empty street, violet sky. |
| `explosion` | Explosion / Bombe | A distant explosion seen from a quiet hilltop at night, a bloom of warm orange light and smoke over a far valley, sparks drifting like embers, foreground grass and a lone tree in violet shadow, no people, no casualties. |
| `searching` | Chercher quelque chose | A hand holding a small flashlight searching through a dark attic full of boxes and old furniture at night, the warm beam revealing dust and a half-open drawer, moonlight through a small roof window. |
| `driving` | Conduire / Perdre le contrôle | The view from a car's driver seat at night on a winding mountain road, headlights cutting through mist, the steering wheel in the foreground with no visible driver, a warm glow from the dashboard (no text), the road bending into darkness. |
| `climbing` | Grimper | A small climber seen from behind on a steep rock face at night, holding on with one hand, a headlamp casting a warm circle, the summit lost in clouds above, a moonlit valley far below. |
| `breakup` | Rupture | Two empty chairs facing away from each other on a moonlit balcony, a single cup left on the small table between them, a warm light in the room behind, a photograph torn in two on the floor, no faces. |
| `stage` | Être sur scène | An empty theatre seen from the stage at night, a single warm spotlight on the bare boards, rows of red velvet seats fading into violet darkness, the heavy curtain half open, dust in the light beam. |
