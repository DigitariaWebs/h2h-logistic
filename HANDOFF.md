# Reprise sur une nouvelle machine — H2H Logistic

> Écrit le 31/08/2026. Ce dépôt est le **second** des deux : il partage son
> backend, son application Clerk et son keystore avec la marketplace.

## 🔴 Lisez d'abord le document principal

Le handoff complet vit dans l'autre dépôt :

**`hand-to-hand/HANDOFF.md`** — <https://github.com/ProgixDev/hand-to-hand.git>

Il porte tout ce qui est commun aux deux apps : le keystore de signature (qui ne
voyage pas avec git et qui est irremplaçable), les valeurs d'environnement, la
chaîne d'outils, la documentation backend, et les pièges qui échouent en
silence. Ce fichier-ci ne répète que ce qui est propre à H2H Logistic.

---

## Ce qui est propre à ce dépôt

```bash
git clone https://github.com/ProgixDev/h2h-logistic.git
cd h2h-logistic && npm ci
cp .env.example .env.local     # puis collez les vraies valeurs
npm test                       # attendu : 39 tests, 0 échec
npm start                      # expo start --go
```

> ⚠️ **Si les 39 tests ne tombent pas juste, regardez les fins de ligne avant le
> code.** Git for Windows pose `core.autocrlf=true` au niveau système et un
> clone y réécrit toute la copie de travail en CRLF. Le `.gitattributes` ajouté
> le 01/09/2026 l'empêche ; une copie plus ancienne se rattrape avec
> `git config --local core.autocrlf false` puis
> `git rm --cached -r . -q && git reset --hard HEAD`. Côté marketplace, le même
> piège fait tomber trois garde-fous en désignant de fausses pistes — c'est le
> piège **0** du handoff principal.

### Les 3 variables d'environnement

Elles sont détaillées dans [`.env.example`](.env.example), remis à jour le
31/08/2026. Leurs valeurs sont **exactement celles de
`hand-to-hand/.env.local`** :

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

> ⚠️ **Ne créez pas une seconde application Clerk pour cette app.** Ses jetons
> porteraient un `sub` d'un autre espace : `app.uid()` rendrait `NULL` et
> **toutes les policies RLS échoueraient en silence** — pas d'erreur, pas de
> refus, juste zéro ligne partout. Un cotransporteur, c'est un profil de la même
> base avec le rôle `transporter`, pas un utilisateur d'un autre système.

Une quatrième variable existe, optionnelle :
`EXPO_PUBLIC_AUTORISER_CLES_LIVE_EN_DEV`. Elle lève le refus de
`src/utils/clesDeProduction.ts`, qui empêche l'app de démarrer en développement
sur des clés LIVE. Laissez-la absente en temps normal.

### Navigation guidée : dormante

`src/components/navigation/MapboxNavigation.tsx` est un **placeholder**
(« Navigation temporairement indisponible »). Aucun jeton Mapbox n'est lu par le
code aujourd'hui. `.env.example` mentionne les deux variables historiques en
section « dormant » — **ne les provisionnez pas** sur la nouvelle machine tant
que le SDK natif n'est pas rebranché.

### Ce qui ne voyage pas

`node_modules/`, `.env.local`, et les dossiers natifs `android/` / `ios/` (tous
ignorés). Les natifs se regénèrent avec `npx expo prebuild`. Ce dépôt n'a pas de
dossier `.claude/`.

---

## La frontière avec la marketplace

Elle se décide **par le geste** :

> Publier un trajet · accepter une mission · scanner un colis
> → **ici, et nulle part ailleurs.**

14 écrans `logistics/*` ont été supprimés de la marketplace le 25/08/2026 pour
cette raison, et un garde-fou (`appCoursierSeparee.test.ts`, côté marketplace)
échoue s'ils reviennent.

## Vocabulaire — non négociable dans la copy visible

| Toujours | Jamais |
|---|---|
| « cotransporteur particulier » (forme longue) | « transporteur » seul |
| « participations » | « gains », « revenu » |
| « co-livraison » | « livraison » |
| « demandeur » = rôle de **facturation** (qui est facturé) | ne pas le confondre avec… |
| « acheteur » = rôle **opérationnel** (scan, rencontre) | …et ne jamais renommer l'un en l'autre |

Ce vocabulaire porte le positionnement L. 3232-1 (cotransportage, partage des
frais). Les clés i18n et les enums techniques ne sont pas concernés.

La palette est **partagée mot pour mot** avec la marketplace — famille
céruléenne, `#007BA7` en clair et `#2A9CC4` en sombre. `src/constants/Colors.ts`
et `hand-to-hand/src/constants/Colors.ts` bougent ensemble.
