// Le vocabulaire visible — trois règles de marque, tenues mot pour mot.
//
// 🔴 CE QUI EST EN JEU. Ces trois mots ne sont pas des préférences de style :
//   • « cotransporteur particulier » est la position juridique de l'app au sens
//     de l'article L. 3232-1 du Code des transports. Écrire « transporteur »
//     seul, c'est décrire un transporteur public routier de marchandises —
//     ce que ces conducteurs ne sont pas, et ce que la plateforme affirme
//     précisément qu'ils ne sont pas dans ses conditions ;
//   • « participation » (jamais « gain » ni « revenu ») découle du même cadre :
//     un partage des frais, pas une rémunération ;
//   • « co-livraison » (jamais « livraison » seule) distingue le trajet partagé
//     d'une prestation de livraison.
//
// ⚠️ CES MOTS SE PERDENT UN PAR UN, dans une chaîne ajoutée à la hâte. Aucun
// compilateur ne les défend.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

/** Toutes les chaînes littérales visibles des écrans et composants. */
function fichiersSource(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      fichiersSource(chemin, acc);
    } else if (['.ts', '.tsx'].includes(extname(chemin)) && !chemin.includes('.test.')) {
      acc.push(chemin);
    }
  }
  return acc;
}

/** Le fichier sans ses commentaires — seul le texte RENDU compte. */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, 'utf8')
    .split('\n')
    .filter((l) => {
      const t = l.trimStart();
      return (
        !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('{/*')
      );
    })
    .join('\n');
}

const SOURCES = [
  ...fichiersSource(join(process.cwd(), 'src', 'app')),
  ...fichiersSource(join(process.cwd(), 'src', 'components')),
  ...fichiersSource(join(process.cwd(), 'src', 'i18n')),
];

test('🔴 « TRANSPORTEUR » NE S’ÉCRIT JAMAIS SEUL', () => {
  // ⚠️ La forme longue est obligatoire, y compris pour les pros XL et tiers.
  // On cherche le mot NON précédé de « co » et NON suivi de « particulier ».
  const fautifs: string[] = [];
  for (const chemin of SOURCES) {
    const code = codeSeul(chemin);
    for (const ligne of code.split('\n')) {
      // « cotransporteur » et « cotransporteurs » sont corrects — on les écarte
      // avant de chercher le mot nu.
      const nu = ligne.replace(/cotransporteurs?/gi, '');
      const m = nu.match(/[Tt]ransporteurs?(?!\s+particuliers?)/);
      if (!m) continue;
      // Les identifiants techniques ne sont pas du texte visible.
      // ⚠️ ON NE JUGE QUE LE TEXTE VISIBLE. Les identifiants techniques —
      // `transporterId`, `ConventionTransporteur`, un import de module — ne
      // sont lus par personne d'autre que le compilateur, et les renommer
      // n'apporterait rien à l'utilisateur.
      if (/^\s*import |from '@\//.test(ligne)) continue;
      if (/[A-Z]\w*Transporteur|transporterId|transporter:|'transporter'|"transporter"|transporterName/.test(ligne)) continue;
      fautifs.push(`${chemin.split('src')[1]} — ${ligne.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(fautifs, [], `« transporteur » seul :\n${fautifs.join('\n')}`);
});

test('🔴 L’ARGENT DU COTRANSPORTEUR EST UNE « PARTICIPATION », jamais un gain', () => {
  // ⚠️ « Gains », « revenus », « salaire » décriraient une rémunération. Le
  // cadre du cotransportage est un PARTAGE DES FRAIS : le mot porte la règle.
  const fautifs: string[] = [];
  for (const chemin of SOURCES) {
    for (const ligne of codeSeul(chemin).split('\n')) {
      if (!/['"`][^'"`]*\b(gains?|revenus?|salaires?)\b/i.test(ligne)) continue;
      // `useEarningsStore`, `transporterEarning` — identifiants, pas du texte.
      if (/Earnings|earning/.test(ligne)) continue;
      fautifs.push(`${chemin.split('src')[1]} — ${ligne.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(fautifs, [], `vocabulaire de rémunération :\n${fautifs.join('\n')}`);
});

test('⚠️ LES TROIS MOTS SONT BIEN PRÉSENTS — un test qui ne trouve rien ne prouve rien', () => {
  // 🔴 SANS CETTE VÉRIFICATION, les deux tests ci-dessus passeraient sur une
  // application vide, ou si `SOURCES` se retrouvait vide après un déplacement
  // de dossier. Ils affirmeraient une conformité qu'ils n'ont pas vérifiée.
  assert.ok(SOURCES.length > 50, `seulement ${SOURCES.length} fichiers balayés`);
  const tout = SOURCES.map(codeSeul).join('\n');
  assert.ok(/cotransporteur particulier/i.test(tout), '« cotransporteur particulier » absent');
  assert.ok(/participation/i.test(tout), '« participation » absent');
  assert.ok(/co-livraison/i.test(tout), '« co-livraison » absent');
});
