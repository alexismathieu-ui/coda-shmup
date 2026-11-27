# Tech Plan — Évaluation : Nouvel ennemi sinusoïdal + Spread Shot

## 1. Objectif

Ajouter un nouvel ennemi dans **Coda Shmup** respectant l'architecture existante (Phaser 3 / TypeScript / Entity-Components / Pooling) :
- **Mouvement sinusoïdal** (descente verticale + oscillation horizontale).
- **Attaque en Spread Shot** : tir simultané de plusieurs projectiles en éventail, gérant aussi bien un arc restreint (ex. `3` balles sur `30°`) qu'un tir circulaire complet (ex. `60` balles sur `360°`).
- **Pilotage 100 % JSON** : spawn rate, paramètres de mouvement, paramètres de spread shot, visuel et statistiques modifiables sans toucher au code.
- **Distinction visuelle** claire par rapport à l'ennemi de base (`ufoRed`).

---

## 2. Architecture & Choix techniques

### 2.1 Configuration JSON & Typage strict
- **Fichier de données** : `public/assets/Data/sinusoidalEnemy.json` (préchargé dans `HomeScene.preload()` via `GameConstants.CacheKeys.SINUSOIDAL_ENEMY`).
- **Types TypeScript** :
  - `src/gameData/SpreadShotData.ts` (`bulletCount`, `spreadAngle`)
  - `src/gameData/SinusoidalEnemyData.ts` (`spawnRate`, `maxActive`, `poolSize`, `health`, `tint`, `scale`, `shootDelayMin`, `shootDelayMax`, `movement`, `spreadShot`, `bullet`) + helper `parseHexColor()` acceptant `#RRGGBB`, `0xRRGGBB` ou un entier.
- **Compromis retenu** : utiliser des chaînes hexadécimales (`"#44ffcc"`) dans le JSON pour qu'un humain puisse modifier les couleurs facilement, tout en conservant le type `number` attendu par Phaser et `BulletData`.

### 2.2 Composant `SinusoidalMovement` (`src/components/SinusoidalMovement.ts`)
- Implémente `IComponent` (respect des principes **Single Responsibility** et **Open/Closed** : on ne surcharge pas `Movement`, qui reste dédié au mouvement linéaire du joueur et de l'ennemi de base).
- Équation de mouvement :
  - `x(t) = originX + amplitude * sin(2 * PI * frequency * t)` (avec `frequency` en Hz)
  - `y += verticalSpeed * deltaTime`
- Expose `reset(originX)` afin de remettre à zéro la phase (`_elapsedTimeMs = 0`) et l'axe central à chaque réutilisation depuis le pool.

### 2.3 Extension de `Weapon` pour le Spread Shot (`src/components/Weapon.ts`)
- Ajout d'un paramètre optionnel `spreadData?: SpreadShotData` au constructeur de `Weapon` : 100 % rétrocompatible avec `Player` et `Enemy`.
- Calcul des angles dans `computeShotAngles(baseRotation)` :
  - `bulletCount <= 1` : un seul tir dans l'axe `baseRotation`.
  - `spreadAngle >= 360` : répartition uniforme sur le cercle (`step = 360 / bulletCount`) afin d'éviter la superposition des balles à `0°` et `360°` (ex. `60` balles sur `360°` → une balle tous les `6°`).
  - `0 <= spreadAngle < 360` : éventail centré sur `baseRotation` de `-spreadAngle / 2` à `+spreadAngle / 2` avec `step = spreadAngle / (bulletCount - 1)` (ex. `3` balles sur `30°` → `-15°`, `0°`, `+15°`).
- En cas d'épuisement du pool de balles, la boucle s'interrompt proprement sans erreur.

### 2.4 Entité `SinusoidalEnemy` (`src/entities/SinusoidalEnemy.ts`)
- Hérite d'`Entity` et compose `Health`, `SinusoidalMovement` et `Weapon`.
- **Visuel distinct** : teinte dédiée (`setTint` depuis le JSON, par défaut cyan `#44ffcc`), échelle configurable (`scale`) et projectiles de couleur dédiée.
- **Gestion propre du flash de dégât avec teinte permanente** : contrairement à `Enemy` qui s'appuie sur `this.isTinted` et `this.clearTint()`, `SinusoidalEnemy` utilise un booléen dédié `_isHitFlashing` et restaure `this.setTint(this._baseTint)` après le flash, afin de ne pas perdre sa couleur ni rester ralenti en permanence.
- **Pooling & reset complet d'état** :
  - `enable(x, y)` : clamp de `originX` dans les marges de l'écran (`amplitude + displayWidth / 2`) pour éviter les sorties latérales, réactivation du corps physique, restauration de la texture et de la teinte, annulation d'un éventuel timer de flash, reset de `SinusoidalMovement`, reset du timer de tir, et soin complet silencieux (`health.heal(health.max, false)`).
  - `disable()` : arrêt de l'animation et suppression des listeners `ANIMATION_COMPLETE`, annulation du timer de flash, désactivation physique et mise en pause du timer de tir.

### 2.5 Intégration dans `EntityManager` & `GameConstants`
- **Constantes nommées** dans `src/GameConstants.ts` (`CacheKeys`, `TextureKeys`, `SpriteFrames`, `AnimKeys`, `SoundKeys`, `Colors`, `Pools`).
- **Pool dédié** `_sinusoidalEnemies` pré-rempli via `GroupUtils.populate(config.poolSize, ...)` et timer de spawn piloté par `config.spawnRate`.
- **Pool de balles ennemies agrandi** à `512` (`GameConstants.Pools.ENEMY_BULLETS_MAX_SIZE`) pour supporter confortablement les configurations extrêmes (ex. `60` balles à `360°`).
- **Factorisation des collisions** dans `registerEnemyCollisions(enemyGroup)` pour éviter la duplication entre `_enemies` et `_sinusoidalEnemies`.
- **Séparation logique / UI préservée** : le score continue de passer uniquement par `scene.registry.inc(...)` et les événements Phaser, sans aucune dépendance vers `MainUIScene`.

---

## 3. Fichiers ajoutés / modifiés

| Fichier | Rôle |
| :--- | :--- |
| `public/assets/Data/sinusoidalEnemy.json` | Configuration JSON complète du nouvel ennemi |
| `src/gameData/SpreadShotData.ts` | Type TS pour la configuration du Spread Shot |
| `src/gameData/SinusoidalEnemyData.ts` | Types TS du nouvel ennemi + `parseHexColor()` |
| `src/GameConstants.ts` | Constantes nommées (cache, textures, animations, sons, pools) |
| `src/components/SinusoidalMovement.ts` | Composant de mouvement sinusoïdal réinitialisable |
| `src/components/Weapon.ts` | Support optionnel du Spread Shot (éventail + 360°) |
| `src/entities/SinusoidalEnemy.ts` | Entité du nouvel ennemi avec pooling et reset complet |
| `src/managers/EntityManager.ts` | Pool, spawn JSON et collisions factorisées |
| `src/scenes/HomeScene.ts` | Préchargement de `sinusoidalEnemy.json` |
| `TECH_PLAN.md` | Documentation technique et plan de playtest |

---

## 4. Playtest manuel

### Scénario 1 — Configuration par défaut (`3` balles sur `30°`)
1. Lancer `npm run dev-nolog`, démarrer la partie avec `SPACE`.
2. Vérifier que les ennemis rouges classiques (`Enemy`) continuent de spawner et de se comporter normalement.
3. Vérifier que les nouveaux ennemis cyan (`SinusoidalEnemy`) apparaissent toutes les ~3 s (`spawnRate: 3000`), oscillent en sinusoïde sans sortir des bords gauche/droite, et tirent un éventail symétrique de **3 projectiles cyan espacés sur 30°** (`-15°`, `0°`, `+15°`).
4. Tirer sur un `SinusoidalEnemy` : vérifier le flash blanc au premier impact puis le retour à sa teinte cyan (2 PV), et sa destruction avec explosion + incrément du score au deuxième impact.
5. Laisser plusieurs ennemis sortir par le bas de l'écran et en détruire d'autres : vérifier que les ennemis recyclés depuis le pool repartent bien en haut avec toute leur vie, leur teinte cyan et une phase sinusoïdale propre.

### Scénario 2 — Test extrême via JSON uniquement (`60` balles sur `360°`)
1. Modifier uniquement `public/assets/Data/sinusoidalEnemy.json` :
   - `"spawnRate": 1500`
   - `"movement": { "verticalSpeed": 0.12, "amplitude": 260, "frequency": 0.9 }`
   - `"spreadShot": { "bulletCount": 60, "spreadAngle": 360 }`
2. Recharger la page sans toucher au code TypeScript.
3. Vérifier que le spawn est plus rapide, l'oscillation plus large et plus rapide, et que chaque tir produit un **anneau complet régulier de 60 balles sur 360°** (sans doublon ni crash du pool).

### Scénario 3 — Build & vérification statique
- `npx tsc --noEmit` : passe sans erreur.
- `npm run build-nolog` : passe sans erreur.
