// Le pont entre Clerk (qui vit dans React) et le store zustand (qui n'y vit pas).
//
// POURQUOI CE FICHIER EXISTE. Le SDK Expo de Clerk s'utilise par hooks
// (useSignIn, useClerk…). Or les écrans de connexion appellent `useAuthStore`,
// un store zustand : on ne peut pas y appeler de hook. Plutôt que de réécrire
// les écrans — ils sont dessinés, validés, et on n'y touche pas — on capture
// l'instance Clerk une fois montée et on la met à disposition du store.
//
// ⚠️ Ce n'est PAS un singleton global de confort : c'est le seul point où
// l'instance sort de React. Tout le reste passe par lui.
import type { useClerk } from '@clerk/expo';

/** Le type exact que rend useClerk() — pas de dépendance sur @clerk/types. */
type LoadedClerk = ReturnType<typeof useClerk>;

let instance: LoadedClerk | null = null;

/**
 * Le flux SSO (Google/Apple/Facebook) n'est PAS un simple appel d'API : il
 * ouvre un navigateur système et attend le retour. Le SDK Expo ne l'expose
 * qu'en hook (useSSO), d'où ce second branchement.
 */
export type FluxSSO = (options: {
  strategy: string;
  redirectUrl?: string;
}) => Promise<{ createdSessionId?: string | null; setActive?: (p: { session: string }) => Promise<void> }>;

let fluxSSO: FluxSSO | null = null;

export function setFluxSSO(f: FluxSSO | null): void {
  fluxSSO = f;
}

/** Le flux s'il est prêt, sinon null — pour les lectures non bloquantes. */
export function peekFluxSSO(): FluxSSO | null {
  return fluxSSO;
}

export function requireFluxSSO(): FluxSSO {
  if (!fluxSSO) {
    throw new Error("Le flux SSO n'est pas prêt : le ClerkProvider doit être monté.");
  }
  return fluxSSO;
}

export function setClerk(c: LoadedClerk | null | undefined): void {
  instance = c ?? null;
}

/**
 * L'instance Clerk chargée.
 *
 * Lève si Clerk n'est pas encore monté : un appel d'authentification avant le
 * montage du provider est un bug d'ordonnancement, pas un cas à traiter en
 * silence. Le rendre muet donnerait un « échec de connexion » incompréhensible.
 */
export function requireClerk(): LoadedClerk {
  if (!instance) {
    throw new Error(
      "Clerk n'est pas encore prêt. Le ClerkProvider doit être monté avant tout appel d'authentification.",
    );
  }
  return instance;
}

/** L'instance si elle est prête, sinon null — pour les lectures non bloquantes. */
export function peekClerk(): LoadedClerk | null {
  return instance;
}
