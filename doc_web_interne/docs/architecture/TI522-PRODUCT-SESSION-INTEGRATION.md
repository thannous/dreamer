# TI522 — Sessions et parcours d’import volontaire

## Décision

L’import utilise deux autorités produit distinctes et le consentement serveur de TI560. Le client Supabase historique reste inchangé. Une session legacy ne devient jamais une autorité Journal ou Lucid par un booléen local ou des métadonnées utilisateur.

Le propriétaire de session produit conserve ses jetons dans un espace sécurisé distinct par issuer et client. Il vérifie identité et produit auprès du serveur avant de publier une autorité. Chaque transition invalide les résultats asynchrones antérieurs. Une rotation de refresh token doit être persistée avant publication. Une erreur de stockage ou de vérification rend la session indisponible ; aucun repli sur le client historique.

Le protocole OAuth serveur utilise `/auth/v1/oauth/authorize` puis `/auth/v1/oauth/token`, avec client public, PKCE S256, state aléatoire et callback enregistré exact. Les méthodes historiques `exchangeCodeForSession` et `refreshSession` du SDK inspecté ne sont pas les échanges OAuth produit. L’authentification et le consentement navigateur restent séparés de la confirmation d’import.

## Parcours à intégrer

1. Action secondaire dans les données Lucid, sans lecture avant action volontaire.
2. Expliquer le compte source, le périmètre, les copies locales et l’absence de synchronisation automatique. Une configuration indisponible doit produire une indisponibilité honnête.
3. Session Journal vérifiée : choix tout ou sélection puis création du grant, avec destination Lucid explicite.
4. Retour validé ne contenant que la référence du grant et les métadonnées nécessaires ; aucun jeton ou récit dans l’URL.
5. Session Lucid du même propriétaire vérifiée, confirmation du périmètre puis lecture RPC. Progression émise uniquement après persistance d’une page.
6. Annulation, expiration ou révocation arrêtent les nouvelles lectures. Les copies déjà persistées restent locales et sous le contrôle de l’utilisateur.
7. Consultation de provenance, arbitrage des conflits, suppression et réimport manuel. Aucun signe généré automatiquement ni upload implicite.

## Effacement et concurrence

Le propriétaire runtime doit annuler le moteur avant l’effacement du namespace. Le verrou du stockage sérialise les écritures déjà émises ; il ne peut arrêter un moteur qui lancerait ultérieurement une autre page. L’inventaire d’effacement permet de reprendre une suppression partielle, sans supprimer un autre compte ni le journal source.

## Conditions de qualification

Les tests locaux du propriétaire et du lecteur ne suffisent pas à livrer ce parcours. La preuve complète nécessite un issuer joignable par le navigateur et l’application, deux clients publics enregistrés, leurs callbacks et mappings privés, ainsi qu’une page de consentement réellement servie. Le banc jetable permet cette qualification sans activer la production.

Les contrats existants de commerce, Apple et suppression globale ne sont pas élargis par ce lot. Une bascule globale de l’authentification vers des tokens produit doit attendre leur prise en charge explicite. Aucun déploiement, enregistrement client ou modification de production n’est inclus dans cette décision.

## État

Décision d’architecture et séquence d’intégration. Ne constitue pas une preuve que les écrans, la session native ou l’activation sont livrés.
