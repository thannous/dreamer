# Règle commune de livraison

1. Avant de push, l'agent lance `npm run verify:pr` sur sa machine. Si ça échoue, il ne pousse pas.
2. La PR indique le commit vérifié et le résultat.
3. Le CTO relit et merge quand les commentaires sont réglés et que rien ne bloque.
4. Rien ne part en prod sans le go de thanh.
