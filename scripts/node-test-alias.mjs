// Résolution de l'alias `@/*` -> `src/*` pour le test runner intégré de Node
// (`node --test`). Metro/Babel et TypeScript résolvent déjà cet alias ; Node,
// non. Ce hook comble uniquement cet écart — aucune dépendance ajoutée.
//
// Utilisé via `npm test` (cf. package.json) :
//   node --test --import ./scripts/node-test-alias.mjs src/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { register } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATES = ['.ts', '.tsx', '.js', '/index.ts', '/index.tsx', '/index.js', ''];

const firstExisting = (base) => {
  for (const ext of CANDIDATES) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
};

export function resolve(specifier, context, next) {
  // Alias `@/*` -> `src/*` (et `@/assets/*` -> `assets/*`).
  const aliased = specifier.startsWith('@/assets/')
    ? path.join(ROOT, 'assets', specifier.slice('@/assets/'.length))
    : specifier.startsWith('@/')
      ? path.join(ROOT, 'src', specifier.slice('@/'.length))
      : null;

  if (aliased) {
    const found = firstExisting(aliased);
    if (found) return next(pathToFileURL(found).href, context);
  }

  // Imports relatifs SANS extension (`./fr`, `../utils/x`) : Metro les résout,
  // Node ESM non. Sans ça, un module aliasé qui importe un voisin en relatif
  // casse la suite de tests alors que l'app fonctionne.
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !path.extname(specifier) &&
    context.parentURL?.startsWith('file:')
  ) {
    const base = path.resolve(
      path.dirname(fileURLToPath(context.parentURL)),
      specifier,
    );
    const found = firstExisting(base);
    if (found) return next(pathToFileURL(found).href, context);
  }

  return next(specifier, context);
}

// Auto-enregistrement quand le fichier est passé à `node --import`.
register(import.meta.url, import.meta.url);
