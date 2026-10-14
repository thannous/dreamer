# Règle commune de livraison

1. Avant de push, l'agent lance `npm run verify:pr` sur sa machine. Si ça échoue, il ne pousse pas.
2. La PR indique le commit vérifié et le résultat.
3. Sur demande explicite de thanh, l'agent peut fusionner la PR quand les commentaires sont réglés et que rien ne bloque. Aucune relecture ni intervention du CTO n'est imposée.
4. Rien ne part en prod sans le go de thanh.
