# TI-518 — Lucid possède ses observations d'entraînement

Décision d'architecture du 7 septembre 2026. Base : `795878a76`, après fusion du
lot A. Implémentation et preuves locales dans le lot B ; qualification native
distincte dans [TI-531](https://linear.app/ti-max/issue/TI-531).

## Problème

La composition racine montait `DreamsProvider` dans les deux variantes. Le
provider Lucid et six routes lisaient ensuite ce store pour leur journal, leurs
signes et les exercices. Ouvrir Lucid pouvait donc charger ou migrer le Journal
sans action d'import. Retirer seulement le provider aurait cassé ces écrans et
interprété les sources absentes comme des suppressions.

## Décision

Lucid utilise les expériences déjà persistées dans son propre état, par scope
invité ou utilisateur. `lib/lucid/observations.ts` projette texte de rappel,
notes et liaison de capture vocale en observations de lecture. La projection
n'est pas un second store ni un nouveau format de synchronisation. Les routines,
la capture matinale, l'export et la suppression restent propriétaires de l'état
Lucid existant.

Le contrat de source d'entraînement est étroit : identifiant, titre et texte,
avec informations facultatives utiles aux algorithmes. Il ne requiert ni
`DreamAnalysis`, ni image, ni interprétation IA. Les nouveaux identifiants portent
le préfixe `lucid:` et la provenance de l'expérience ; ils ne peuvent pas être
confondus avec les anciens identifiants numériques du Journal. Les nouvelles
suggestions doivent encore être confirmées avant de guider l'entraînement.

Les références historiques du Journal sont conservées dans le scope qui les
possédait, sans lecture implicite de leur récit. Une source devenue inaccessible
par séparation produit ne constitue pas une suppression demandée. Les décisions
de signes et préférences Atlas correspondantes ne doivent pas être effacées ou
réassociées silencieusement à une observation portant un texte similaire.

La composition racine monte le provider et les hosts Journal dans la variante
Journal. Les routes Journal sont protégées dans la variante Lucid. La capture et
la consultation depuis Lucid restent sous `/lucid/`. La déconnexion Lucid ne
nettoie plus le cache Journal. Les fonctions communes d'identité restent
disponibles ; le service d'abonnement existant ne devient pas un mécanisme
d'import. Le partage d'un droit commercial ne vaut jamais consentement au partage
des récits.

## Limites et alternatives

- Un store factice `DreamsProvider` vide masquerait le couplage et détruirait la
  traçabilité des anciennes décisions : écarté.
- Copier tous les rêves Journal au démarrage serait un import non consenti :
  écarté. L'import volontaire relève de TI-522 et des autorisations TI-560.
- Déplacer les dossiers, créer un workspace ou un second build maintenant ne
  résoudrait pas à lui seul la dépendance de données : reporté à TI-561.
- La séparation de composition ne prouve pas l'absence de modules Journal dans
  le bundle ni une baisse mesurée du temps de démarrage. Ces preuves restent
  distinctes des tests d'absence d'appels au runtime.

## Acceptation

Tests comportementaux de montage par variante, absence de lecture Journal même
connecté, capture et relecture locales, scopes invités/comptes, conservation des
références historiques et règles d'import TI-527. Types et tests de régression
Journal sont vérifiés sur l'arbre final. La preuve native exige un binaire ou
update JS attribué au SHA testé ; le Play installé antérieurement ne suffit pas.

Le [contrat de marque](../../../specs/noctalia-brand-contract.md) définit les
promesses utilisateur ; ce document décrit la décision technique correspondante.
