'use strict';

const { validateCommunityGates } = require('./check-social-community-gates');

const mandate = `
Reddit reste hors mandat opérationnel tant qu'un compte Noctalia dédié n'a pas été créé.
Le compte Reddit personnel existant ne doit pas être utilisé, renommé ou modifié.
`;
const program = `
au moins trois contributions DreamViews publiques et utiles, dont au moins deux ont reçu une réponse organique.
au moins **14 jours** d'ancienneté et **10 contributions textuelles utiles**.
Le compte personnel \`u/Emergency_Gap_1440\` reste hors périmètre.
`;
const register = `
Verdict actuel : **DREAMVIEWS EN MATURATION — REDDIT GELÉ**.
| Contributions publiques utiles | 3 | **1/3** |
| Contributions ayant reçu une réponse organique | 2 | **0/2** |
| Compte Noctalia dédié, inscrit au mandat | obligatoire | **ABSENT** |
| Ancienneté | 14 jours minimum | **NON DÉMARRÉ** |
| Contributions textuelles utiles sans lien | 10 minimum | **0/10** |
| Communautés pertinentes | 2 minimum | **0/2** |
| Échanges organiques | 3 minimum | **0/3** |
`;

describe('social community gates guard', () => {
  it('accepts the current DreamViews then Reddit gates', () => {
    expect(() => validateCommunityGates(mandate, program, register)).not.toThrow();
  });

  it('rejects opening Reddit without the dedicated-account absence proof', () => {
    const premature = register.replace('REDDIT GELÉ', 'REDDIT OUVERT').replace('**ABSENT**', '**@noctalia**');
    expect(() => validateCommunityGates(mandate, program, premature))
      .toThrow('Reddit ne peut pas être ouvert');
  });

  it('rejects weakening the DreamViews response threshold', () => {
    expect(() => validateCommunityGates(mandate, program.replace('au moins deux', 'au moins une'), register))
      .toThrow('seuil DreamViews 2 réponses absent');
  });

  it('accepts progress without freezing the register to the initial counts', () => {
    const progressed = register.replace('**1/3**', '**2/3**').replace('**0/2**', '**1/2**');
    expect(validateCommunityGates(mandate, program, progressed)).toEqual({
      contributions: 2,
      replies: 1,
      accountState: 'ABSENT',
    });
  });

  it('rejects impossible DreamViews counters', () => {
    expect(() => validateCommunityGates(mandate, program, register.replace('**1/3**', '**4/3**')))
      .toThrow('progression DreamViews supérieure au seuil documenté');
  });
});
