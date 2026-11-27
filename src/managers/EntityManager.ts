import {GameObjects, Physics, Plugins, Scene} from "phaser";
import Health from "../components/Health.ts";
import ArcadeEnemy from "../entities/ArcadeEnemy.ts";
import Boss from "../entities/Boss.ts";
import Bullet from "../entities/Bullet.ts";
import Meteor from "../entities/Meteor.ts";
import Player from "../entities/Player.ts";
import PowerUp from "../entities/PowerUp.ts";
import GameConstants from "../GameConstants.ts";
import type {BossData} from "../gameData/BossData.ts";
import {CAMPAIGN_FINAL_WAVE, getDifficultyConfig, type DifficultyConfig, type GameModeId} from "../gameData/DifficultyData.ts";
import type {EnemiesCatalogData} from "../gameData/EnemyArchetypeData.ts";
import {POWERUP_CATALOG, type PowerUpKind} from "../gameData/PowerUpData.ts";
import {ROGUELITE_CARDS, type RogueliteCard, type RogueliteCardId} from "../gameData/RogueliteCardData.ts";
import {computeModifierScoreMultiplier, type RunModifierId} from "../gameData/RunModifiersData.ts";
import RegistryConstants from "../RegistryConstants.ts";
import GroupUtils from "../utils/GroupUtils.ts";
import AchievementManager from "./AchievementManager.ts";
import BestiaryManager from "./BestiaryManager.ts";
import SoundManager from "./SoundManager.ts";
import VfxManager from "./VfxManager.ts";

export default class EntityManager extends Plugins.ScenePlugin {
    public static readonly PLUGIN_KEY: string = 'EntityManager';
    public static readonly MAPPING_NAME: string = 'entityManager';

    private static readonly SPAWN_MARGIN_X: number = 76;
    private static readonly COMBO_DURATION_MS: number = 4200;
    private static readonly EMP_ENEMY_DAMAGE: number = 15;
    private static readonly EMP_BOSS_DAMAGE: number = 8;
    private static readonly POWERUP_DROP_COOLDOWN_MS: number = 3500;

    private readonly playerBulletConfig = {
        classType: Bullet,
        maxSize: GameConstants.Pools.PLAYER_BULLETS_MAX_SIZE,
        runChildUpdate: true,
        createCallback: (bullet: GameObjects.GameObject) => {
            (bullet as Bullet).init();
        },
    };

    private readonly enemyBulletConfig = {
        classType: Bullet,
        maxSize: GameConstants.Pools.ENEMY_BULLETS_MAX_SIZE,
        runChildUpdate: true,
        createCallback: (bullet: GameObjects.GameObject) => {
            (bullet as Bullet).init();
        },
    };

    private _player!: Player;
    private _playerBullets!: Physics.Arcade.Group;
    private _enemyBullets!: Physics.Arcade.Group;
    private _enemies!: Physics.Arcade.Group;
    private _powerUps!: Physics.Arcade.Group;
    private _meteors!: Physics.Arcade.Group;
    private _bossGroup!: Physics.Arcade.Group;
    private _activeBoss: Boss | null = null;

    private _enemiesCatalog!: EnemiesCatalogData;
    private _bossCatalog: BossData[] = [];
    private _difficulty!: DifficultyConfig;
    private _mode: GameModeId = 'campaign';
    private _modifiers: RunModifierId[] = [];
    private _modifierScoreMult: number = 1;
    private _noPowerUps: boolean = false;
    private _turboMode: boolean = false;

    private _currentWave: number = 1;
    private _killsInWave: number = 0;
    private _totalKills: number = 0;
    private _grazeCount: number = 0;
    private _tookHitThisWave: boolean = false;
    private _killsRequiredForWave: number = 10;
    private _waveTransitioning: boolean = false;
    private _bossActive: boolean = false;

    // Tutorial state
    private _tutorialActive: boolean = false;
    private _tutorialStep: number = 0;
    private _tutorialAdvancing: boolean = false;
    private _tutorialDummies: ArcadeEnemy[] = [];

    // Active arena events
    private _blackHoleVisual?: GameObjects.Arc;
    private _blackHolePos?: {x: number; y: number};
    private _eclipseOverlay?: GameObjects.Rectangle;
    private _eclipseHalo?: GameObjects.Arc;
    private _aegisGraphics?: GameObjects.Graphics;

    private _comboCount: number = 0;
    private _comboMultiplier: number = 1;
    private _maxCombo: number = 0;
    private _comboDecayTimer?: Phaser.Time.TimerEvent;

    private _spawnTimer?: Phaser.Time.TimerEvent;
    private _bossSpawnTimer?: Phaser.Time.TimerEvent;
    private _randomEventTimer?: Phaser.Time.TimerEvent;
    private _lastPowerUpDropTime: number = 0;
    private _onWarpCallback?: (active: boolean) => void;
    private _onVictoryCallback?: () => void;

    constructor(scene: Scene, pluginManager: Plugins.PluginManager) {
        super(scene, pluginManager, EntityManager.PLUGIN_KEY);
    }

    public setWarpCallback(callback: (active: boolean) => void): void {
        this._onWarpCallback = callback;
    }

    public setVictoryCallback(callback: () => void): void {
        this._onVictoryCallback = callback;
    }

    public initAndSpawnPlayer(): Player {
        this._difficulty = getDifficultyConfig(this.scene!.registry.get(RegistryConstants.Keys.SELECTED_DIFFICULTY));
        this._mode = (this.scene!.registry.get(RegistryConstants.Keys.SELECTED_MODE) as GameModeId) ?? 'campaign';
        this._modifiers = (this.scene!.registry.get(RegistryConstants.Keys.RUN_MODIFIERS) as RunModifierId[] | undefined) ?? [];
        this._modifierScoreMult = computeModifierScoreMultiplier(this._modifiers);
        this._noPowerUps = this._modifiers.includes('no_powerups');
        this._turboMode = this._modifiers.includes('turbo');

        this._playerBullets = this.scene!.physics.add.group(this.playerBulletConfig);
        GroupUtils.populate(GameConstants.Pools.PLAYER_BULLETS_INITIAL_SIZE, this._playerBullets);

        this._player = new Player(
            this.scene!,
            this.scene!.cameras.main.centerX,
            this.scene!.cameras.main.height - 180
        );
        this._player.init(
            this._playerBullets,
            () => this.triggerEmpNova(),
            (x, y) => this.triggerDashNova(x, y),
            (x, y) => this.handlePlayerBeamTick(x, y),
            (active) => {
                if (this.scene?.physics?.world) {
                    this.scene.physics.world.timeScale = active ? 1.55 : 1;
                }
            }
        );

        this.game!.events.emit(GameConstants.Events.PLAYER_SPAWNED_EVENT, this._player);
        return this._player;
    }

    public initEnemies(): Physics.Arcade.Group {
        this._enemiesCatalog = this.scene!.cache.json.get(GameConstants.CacheKeys.ENEMIES) as EnemiesCatalogData;
        this._bossCatalog = (this.scene!.cache.json.get(GameConstants.CacheKeys.BOSSES) as BossData[]) ?? [];

        this._enemyBullets = this.scene!.physics.add.group(this.enemyBulletConfig);
        GroupUtils.populate(GameConstants.Pools.ENEMY_BULLETS_MAX_SIZE, this._enemyBullets);

        this._enemies = this.scene!.physics.add.group({
            classType: ArcadeEnemy,
            maxSize: GameConstants.Pools.ARCADE_ENEMIES_POOL_SIZE,
            defaultKey: GameConstants.TextureKeys.SPRITES,
            defaultFrame: GameConstants.SpriteFrames.ENEMY_UFO,
            createCallback: (enemy) => {
                (enemy as ArcadeEnemy).init(this._enemyBullets, this._player);
            },
        });
        GroupUtils.populate(GameConstants.Pools.ARCADE_ENEMIES_POOL_SIZE, this._enemies);

        this._powerUps = this.scene!.physics.add.group({
            classType: PowerUp,
            maxSize: GameConstants.Pools.POWERUPS_POOL_SIZE,
            createCallback: (pu) => {
                (pu as PowerUp).init(this._player);
            },
        });
        GroupUtils.populate(GameConstants.Pools.POWERUPS_POOL_SIZE, this._powerUps);

        this._meteors = this.scene!.physics.add.group({
            classType: Meteor,
            maxSize: GameConstants.Pools.METEORS_POOL_SIZE,
            defaultKey: 'planet',
            createCallback: (m) => {
                (m as Meteor).init();
            },
        });
        GroupUtils.populate(GameConstants.Pools.METEORS_POOL_SIZE, this._meteors);

        this._bossGroup = this.scene!.physics.add.group();
        this._aegisGraphics = this.scene!.add.graphics().setDepth(15);

        this._currentWave = 0;
        this._totalKills = 0;
        this._grazeCount = 0;
        this._tookHitThisWave = false;
        this._comboCount = 0;
        this._comboMultiplier = 1;
        this._maxCombo = 0;
        this._bossActive = false;
        this._activeBoss = null;
        this._tutorialActive = false;
        this._tutorialAdvancing = false;
        this._tutorialDummies = [];

        this.scene!.registry.set(RegistryConstants.Keys.MAX_COMBO, 0);
        this.emitComboState();

        const tutorialEnabled = Boolean(this.scene!.registry.get(RegistryConstants.Keys.TUTORIAL_ENABLED) ?? true);
        if (tutorialEnabled) {
            this.startInteractiveTutorial();
        } else {
            this.startNextWave();
        }

        this._randomEventTimer = this.scene!.time.addEvent({
            delay: 18000,
            callback: this.tryTriggerRandomEvent,
            callbackScope: this,
            loop: true,
        });

        this.game!.events.off(GameConstants.Events.CHEAT_ACTION, this.handleCheatAction, this);
        this.game!.events.on(GameConstants.Events.CHEAT_ACTION, this.handleCheatAction, this);

        return this._enemies;
    }

    public initGroupCollisions(): void {
        const physics = this.scene!.physics;

        // Player bullets vs Enemies
        physics.add.overlap(this._playerBullets, this._enemies, (bulletObj, enemyObj) => {
            const bullet = bulletObj as Bullet;
            const enemy = enemyObj as ArcadeEnemy;
            if (!bullet.active || !enemy.active) return;

            bullet.disable();
            this.damageArcadeEnemy(enemy, bullet.damage);
        });

        // Player bullets vs Boss
        physics.add.overlap(this._playerBullets, this._bossGroup, (bulletObj, bossObj) => {
            const bullet = bulletObj as Bullet;
            const boss = bossObj as Boss;
            if (!bullet.active || !boss.isVulnerable) return;

            bullet.disable();
            this.damageBoss(boss, bullet.damage);
        });

        // Player bullets vs Meteors
        physics.add.overlap(this._playerBullets, this._meteors, (bulletObj, meteorObj) => {
            const bullet = bulletObj as Bullet;
            const meteor = meteorObj as Meteor;
            if (!bullet.active || !meteor.active) return;

            bullet.disable();
            this.damageMeteor(meteor, bullet.damage);
        });

        // Player vs Enemy Bullets
        physics.add.overlap(this._player, this._enemyBullets, (_playerObj, bulletObj) => {
            const bullet = bulletObj as Bullet;
            if (!bullet.active || !this._player.active) return;

            bullet.disable();
            if (this._player.takeHit(bullet.damage)) {
                this.resetCombo();
                this.scene?.cameras.main.shake(120, 0.012);
            }
        });

        // Player vs Enemies
        physics.add.overlap(this._player, this._enemies, (_playerObj, enemyObj) => {
            const enemy = enemyObj as ArcadeEnemy;
            if (!enemy.active || !this._player.active) return;

            this.damageArcadeEnemy(enemy, 999);
            if (this._player.takeHit(1)) {
                this.resetCombo();
                this.scene?.cameras.main.shake(140, 0.02);
            }
        });

        // Player vs Boss
        physics.add.overlap(this._player, this._bossGroup, (_playerObj, bossObj) => {
            const boss = bossObj as Boss;
            if (!boss.isVulnerable || !this._player.active) return;

            if (this._player.takeHit(1)) {
                this.resetCombo();
                this.scene?.cameras.main.shake(160, 0.022);
            }
        });

        // Player vs Meteors
        physics.add.overlap(this._player, this._meteors, (_playerObj, meteorObj) => {
            const meteor = meteorObj as Meteor;
            if (!meteor.active || !this._player.active) return;

            this.damageMeteor(meteor, 999);
            if (this._player.takeHit(1)) {
                this.resetCombo();
                this.scene?.cameras.main.shake(150, 0.02);
            }
        });

        // Player vs PowerUps
        physics.add.overlap(this._player, this._powerUps, (_playerObj, powerUpObj) => {
            const powerUp = powerUpObj as PowerUp;
            if (!powerUp.active || !this._player.active) return;

            this.collectPowerUp(powerUp);
        });
    }

    private getVfx(): VfxManager | undefined {
        return (this.scene as unknown as {vfxManager?: VfxManager}).vfxManager;
    }

    private getSound(): SoundManager | undefined {
        return (this.scene as unknown as {soundManager?: SoundManager}).soundManager;
    }

    private damageArcadeEnemy(enemy: ArcadeEnemy, damage: number): void {
        const health = enemy.getComponent(Health);
        if (!health || health.current <= 0) return;

        const vfx = this.getVfx();
        const sound = this.getSound();
        const isCrit = damage < 100 && this._player.critChance > 0 && Math.random() < this._player.critChance;
        let finalDamage = isCrit ? damage * 2 : damage;

        // Aegis Guardian halves incoming damage for nearby allies
        if (!enemy.isAegis && !enemy.isDummy && this.hasActiveAegis()) {
            finalDamage = Math.max(0.5, finalDamage * 0.5);
        }

        health.damage(finalDamage, true);

        if (isCrit) {
            vfx?.spawnFloatingText(enemy.x, enemy.y - 44, 'CRIT!', '#f72585', 26);
        }

        if (health.current > 0) {
            vfx?.spawnHitSpark(enemy.x, enemy.y, enemy.baseTint);
            sound?.playHit();
            return;
        }

        // Tutorial dummy destroyed!
        if (enemy.isDummy) {
            vfx?.spawnExplosion(enemy.x, enemy.y, 0x4cc9f0, 1.3);
            sound?.playExplosion(false);
            enemy.disable();
            this._tutorialDummies = this._tutorialDummies.filter(d => d !== enemy && d.active);
            if (this._tutorialActive && this._tutorialStep === 2 && !this._tutorialAdvancing) {
                this.advanceTutorialStep();
            }
            return;
        }

        const archetype = enemy.archetype;
        BestiaryManager.discover(this.scene!, archetype.id);
        const isHeavy = archetype.id === 'tank' || archetype.id === 'cargo';
        vfx?.spawnExplosion(enemy.x, enemy.y, enemy.baseTint, isHeavy ? 1.45 : 1.0);
        if (isHeavy) {
            vfx?.triggerHitstop(40);
            this.scene?.cameras.main.shake(120, 0.01);
        }
        sound?.playExplosion(isHeavy);

        this._totalKills++;
        if (this._totalKills === 1) {
            AchievementManager.unlock(this.scene!, 'first_blood');
        }
        if (this._player.hasVampirism && this._totalKills % 25 === 0 && this._player.healOne()) {
            vfx?.spawnFloatingText(this._player.x, this._player.y - 60, 'NANOBOTS +1 HP', '#80ed99', 28);
        }

        this.incrementCombo();
        this._player.addOverdriveCharge(5);

        const overdriveMult = this._player.isOverdriveActive ? 2 : 1;
        const earned = Math.round(archetype.scoreValue * this._comboMultiplier * this._difficulty.scoreMultiplier * this._modifierScoreMult * overdriveMult);
        this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE, earned);
        vfx?.spawnFloatingText(
            enemy.x,
            enemy.y - 20,
            this._comboMultiplier > 1 ? `+${earned} x${this._comboMultiplier}` : `+${earned}`,
            isHeavy ? '#ffd166' : '#ffffff',
            isHeavy ? 36 : 26
        );

        // Bounty Target killed!
        if (enemy.isBounty) {
            this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE, 2000);
            this._player.addBomb(1);
            AchievementManager.unlock(this.scene!, 'bounty_hunter');
            vfx?.spawnFloatingText(enemy.x, enemy.y - 65, 'BOUNTY +2000 & +1 EMP!', '#ffd166', 34);
        }

        // Acid Splitter splits into 3 fast mini-enemies!
        if (archetype.splitsOnDeath) {
            const miniType = this._enemiesCatalog['kamikaze'] ?? this._enemiesCatalog['scout'];
            if (miniType) {
                for (const ox of [-70, 0, 70]) {
                    const mini = this._enemies.get() as ArcadeEnemy | null;
                    if (mini) {
                        mini.enableWithArchetype(enemy.x + ox, enemy.y + 40, miniType, 0.8, this._difficulty);
                    }
                }
            }
        }

        const now = this.scene!.time.now;
        const dropChance = Math.min(1, archetype.dropChance * this._difficulty.dropChanceMult);
        if (!this._noPowerUps && (archetype.guaranteedDrop || (now - this._lastPowerUpDropTime >= EntityManager.POWERUP_DROP_COOLDOWN_MS && Math.random() < dropChance))) {
            this._lastPowerUpDropTime = now;
            this.spawnRandomPowerUp(enemy.x, enemy.y);
        }

        enemy.disable();

        if (!this._bossActive && !this._waveTransitioning && !this._tutorialActive) {
            this._killsInWave++;
            this.game!.events.emit(GameConstants.Events.WAVE_PROGRESS_CHANGED, {
                current: this._killsInWave,
                target: this._killsRequiredForWave,
            });
            if (this._killsInWave >= this._killsRequiredForWave) {
                this.completeRegularWave();
            }
        }
    }

    private damageBoss(boss: Boss, damage: number): void {
        const health = boss.getComponent(Health);
        if (!health || health.current <= 0) return;

        const vfx = this.getVfx();
        const sound = this.getSound();
        const isCrit = damage < 100 && this._player.critChance > 0 && Math.random() < this._player.critChance;
        health.damage(isCrit ? damage * 2 : damage, true);

        if (health.current > 0) {
            vfx?.spawnHitSpark(boss.x + Phaser.Math.Between(-45, 45), boss.y + 30, boss.currentTint);
            if (isCrit) {
                vfx?.spawnFloatingText(boss.x + Phaser.Math.Between(-40, 40), boss.y + 50, 'CRIT!', '#f72585', 28);
            }
            sound?.playHit();
            return;
        }

        // Boss defeated!
        boss.markDying();
        BestiaryManager.discover(this.scene!, boss.bossData.id);
        this.clearAllEnemyBullets();
        sound?.playExplosion(true);
        AchievementManager.unlock(this.scene!, 'boss_slayer');
        if (this._difficulty.id === 'cauchemar') {
            AchievementManager.unlock(this.scene!, 'nightmare_boss');
        }

        const bossX = boss.x;
        const bossY = boss.y;
        const bossColor = boss.currentTint;
        const bossScore = Math.round(boss.bossData.scoreValue * this._comboMultiplier * this._difficulty.scoreMultiplier * this._modifierScoreMult);

        this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE, bossScore);
        this.game!.events.emit(GameConstants.Events.BOSS_DEFEATED_EVENT);
        this.game!.events.emit(GameConstants.Events.BANNER_EVENT, {
            title: 'BOSS DESTROYED!',
            subtitle: `+${bossScore} PTS`,
            color: '#ffd166',
        });

        vfx?.playBossDeathSequence(bossX, bossY, bossColor, () => {
            boss.destroy();
            this._activeBoss = null;
            this._bossActive = false;
            this.getSound()?.setMusicMode(this._difficulty.id === 'cauchemar' ? 'nightmare' : 'normal');

            // Campaign victory on final wave boss!
            if (this._mode === 'campaign' && this._currentWave >= CAMPAIGN_FINAL_WAVE) {
                AchievementManager.unlock(this.scene!, 'emperor_slayer');
                this.scene?.time.delayedCall(1400, () => {
                    this._onVictoryCallback?.();
                });
                return;
            }

            // Reward the player with 1 targeted power-up (balanced!)
            if (!this._noPowerUps) {
                const playerHealth = this._player.getComponent(Health);
                const rewardKind: PowerUpKind = playerHealth && playerHealth.current < playerHealth.max ? 'heal' : 'weapon';
                this.spawnRandomPowerUp(bossX, bossY, rewardKind);
            }

            this.scene?.time.delayedCall(2000, () => {
                if (!this._player?.active) return;
                if (this._mode === 'roguelite') {
                    this.offerRogueliteCards(() => this.startNextWave());
                } else {
                    this.startNextWave();
                }
            });
        });
    }

    private damageMeteor(meteor: Meteor, damage: number): void {
        const health = meteor.getComponent(Health);
        if (!health || health.current <= 0) return;

        health.damage(damage, true);
        if (health.current > 0) {
            this.getVfx()?.spawnHitSpark(meteor.x, meteor.y, 0xd4a373);
            this.getSound()?.playHit();
            return;
        }

        this.getVfx()?.spawnExplosion(meteor.x, meteor.y, 0xd4a373, 1.15);
        this.getSound()?.playExplosion(false);
        this.incrementCombo();
        const pts = 150 * this._comboMultiplier;
        this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE, pts);
        this.getVfx()?.spawnFloatingText(meteor.x, meteor.y, `+${pts}`, '#ffd166', 26);
        meteor.disable();
    }

    private startNextWave(): void {
        this._currentWave++;
        this._killsInWave = 0;
        this._tookHitThisWave = false;
        this._killsRequiredForWave = 9 + this._currentWave * 3;
        this._waveTransitioning = false;

        this.scene!.registry.set(RegistryConstants.Keys.CURRENT_WAVE, this._currentWave);
        this.game!.events.emit(GameConstants.Events.WAVE_CHANGED, this._currentWave);
        this.game!.events.emit(GameConstants.Events.WAVE_PROGRESS_CHANGED, {
            current: 0,
            target: this._killsRequiredForWave,
        });

        if (this._player.shieldEachWave && !this._player.hasShield) {
            this._player.setShield(true);
        }

        this._spawnTimer?.remove(false);

        const isBossWave = this._currentWave % 6 === 0 && this._bossCatalog.length > 0;
        if (isBossWave) {
            this.startBossWave();
            return;
        }

        this.getSound()?.setMusicMode(this._difficulty.id === 'cauchemar' ? 'nightmare' : 'normal');

        const subtitle = this._difficulty.id === 'cauchemar'
            ? 'CAUCHEMAR · SURVIVEZ AU BULLET HELL'
            : this._currentWave === 1 ? 'READY — ENGAGE!' : 'HOSTILES INCOMING';
        this.game!.events.emit(GameConstants.Events.BANNER_EVENT, {
            title: `WAVE ${this._currentWave}`,
            subtitle,
            color: this._difficulty.id === 'cauchemar' ? '#ff1e42' : '#4cc9f0',
        });

        const baseDelay = Math.max(580, 1380 - this._currentWave * 85);
        const turboMult = this._turboMode ? 0.74 : 1;
        const spawnDelay = Math.max(260, Math.round(baseDelay * this._difficulty.enemySpawnDelayMult * turboMult));
        this._spawnTimer = this.scene!.time.addEvent({
            delay: spawnDelay,
            callback: this.spawnWaveEnemy,
            callbackScope: this,
            loop: true,
        });
    }

    private completeRegularWave(): void {
        this._waveTransitioning = true;
        this._spawnTimer?.remove(false);
        this.getSound()?.playWaveClear();
        this._onWarpCallback?.(true);

        if (!this._tookHitThisWave) {
            AchievementManager.unlock(this.scene!, 'untouchable');
        }

        this.game!.events.emit(GameConstants.Events.BANNER_EVENT, {
            title: `WAVE ${this._currentWave} CLEAR!`,
            subtitle: 'WARP JUMPING...',
            color: '#80ed99',
        });

        this.scene!.time.delayedCall(2000, () => {
            this._onWarpCallback?.(false);
            if (!this._player?.active) return;

            if (this._mode === 'roguelite' && this._currentWave % 2 === 0) {
                this.offerRogueliteCards(() => this.startNextWave());
            } else {
                this.startNextWave();
            }
        });
    }

    private offerRogueliteCards(onDone: () => void): void {
        const shuffled = Phaser.Utils.Array.Shuffle([...ROGUELITE_CARDS]);
        const offered: RogueliteCard[] = shuffled.slice(0, 3);

        this.game!.events.once(GameConstants.Events.ROGUELITE_CARD_CHOSEN, (cardId: RogueliteCardId) => {
            this._player.applyRogueliteCard(cardId);
            this.getSound()?.playPowerUp();
            this.getVfx()?.spawnFloatingText(this._player.x, this._player.y - 60, 'UPGRADE APPLIED!', '#ffd166', 34);
            onDone();
        });

        this.game!.events.emit(GameConstants.Events.ROGUELITE_OFFER_CARDS, offered);
    }

    private triggerDashNova(x: number, y: number): void {
        const vfx = this.getVfx();
        vfx?.spawnExplosion(x, y, 0x4cc9f0, 1.35);

        const radiusSq = 210 * 210;
        for (const obj of this._enemyBullets.getChildren()) {
            const bullet = obj as Bullet;
            if (!bullet.active) continue;
            const dx = bullet.x - x;
            const dy = bullet.y - y;
            if (dx * dx + dy * dy <= radiusSq) {
                vfx?.spawnHitSpark(bullet.x, bullet.y, 0x4cc9f0);
                bullet.disable();
            }
        }
    }

    private startBossWave(): void {
        this.clearActiveBosses();
        this._bossActive = true;
        this.getSound()?.setMusicMode('boss');
        const bossCycleIndex = Math.floor(this._currentWave / 6) - 1;
        const bossData = this._bossCatalog[bossCycleIndex % this._bossCatalog.length];
        const loopTier = Math.floor(bossCycleIndex / this._bossCatalog.length);
        const hpMultiplier = 1 + loopTier * 0.45;
        const expectedWave = this._currentWave;

        this.getSound()?.playWarning();
        this.game!.events.emit(GameConstants.Events.BANNER_EVENT, {
            title: 'WARNING — BOSS INCOMING',
            subtitle: `${bossData.name} · ${bossData.subtitle}`,
            color: '#ff4d6d',
        });

        this._bossSpawnTimer = this.scene!.time.delayedCall(1800, () => {
            if (!this._player?.active || this._currentWave !== expectedWave) return;

            this.clearActiveBosses();
            this._bossActive = true;
            const boss = new Boss(
                this.scene!,
                this.scene!.cameras.main.centerX,
                -180,
                GameConstants.TextureKeys.SPRITES,
                GameConstants.SpriteFrames.ENEMY_UFO
            );
            boss.initBoss(
                this._enemyBullets,
                this._player,
                bossData,
                hpMultiplier,
                this._difficulty,
                () => this.triggerAmbushSquad()
            );
            this._bossGroup.add(boss);
            this._activeBoss = boss;
        });
    }

    private clearActiveBosses(): void {
        this._bossSpawnTimer?.remove(false);
        this._bossSpawnTimer = undefined;
        this._bossGroup?.clear(true, true);
        this._activeBoss = null;
        this._bossActive = false;
        this.game!.events.emit(GameConstants.Events.BOSS_DEFEATED_EVENT);
    }

    private pickArchetypeForWave(): string {
        const w = this._currentWave;
        const pool: string[] = ['scout', 'sinusoidal'];

        if (w >= 2) pool.push('kamikaze', 'sinusoidal', 'splitter');
        if (w >= 3) pool.push('tank', 'sniper', 'minelayer');
        if (w >= 4) pool.push('orbital', 'kamikaze', 'aegis');
        if (w >= 5) pool.push('tank', 'sniper', 'orbital', 'splitter', 'minelayer', 'aegis');
        if (Math.random() < 0.08) return 'cargo';

        return pool[Phaser.Math.Between(0, pool.length - 1)];
    }

    private spawnWaveEnemy(): void {
        if (this._bossActive || this._waveTransitioning || this._tutorialActive || !this._player?.active) return;

        const maxActive = Math.max(3, Math.min(22, 4 + Math.floor(this._currentWave * 0.65) + this._difficulty.maxActiveBonus));
        if (this._enemies.countActive(true) >= maxActive) return;

        // Higher difficulties can spawn multiple enemies per tick!
        const extraSpawnChance = this._difficulty.id === 'cauchemar' ? 0.38 : this._difficulty.id === 'difficile' ? 0.25 : 0;
        const batchCount = Math.random() < extraSpawnChance ? 2 : 1;

        for (let b = 0; b < batchCount; b++) {
            if (this._enemies.countActive(true) >= maxActive) break;

            const id = this.pickArchetypeForWave();
            const archetype = this._enemiesCatalog[id] ?? this._enemiesCatalog['scout'];
            if (!archetype) return;

            const enemy = this._enemies.get() as ArcadeEnemy | null;
            if (!enemy) return;

            const hpScale = (1 + Math.max(0, this._currentWave - 6) * 0.08) * this._difficulty.enemyHpMult;
            const x = Phaser.Math.Between(EntityManager.SPAWN_MARGIN_X, this.scene!.cameras.main.width - EntityManager.SPAWN_MARGIN_X);
            enemy.enableWithArchetype(x, 0, archetype, hpScale, this._difficulty);
            this.game!.events.emit(GameConstants.Events.ENEMY_SPAWNED_EVENT, enemy);
        }
    }

    private tryTriggerRandomEvent(): void {
        if (this._bossActive || this._waveTransitioning || this._tutorialActive || !this._player?.active) return;

        const roll = Phaser.Math.Between(0, 6);
        switch (roll) {
            case 0:
                this.triggerMeteorShower();
                break;
            case 1:
                this.triggerGoldRush();
                break;
            case 2:
                this.triggerOverdriveStorm();
                break;
            case 3:
                this.triggerAmbushSquad();
                break;
            case 4:
                this.triggerSolarEclipse();
                break;
            case 5:
                this.triggerMiniBlackHole();
                break;
            default:
                this.triggerBountyHunter();
                break;
        }
    }

    private triggerSolarEclipse(): void {
        this.getSound()?.playWarning();
        this.game!.events.emit(GameConstants.Events.BANNER_EVENT, {
            title: 'EVENT: ECLIPSE SOLAIRE!',
            subtitle: 'VISIBILITE REDUITE PENDANT 8 SECONDES',
            color: '#9aa5ce',
        });

        const cam = this.scene!.cameras.main;
        this._eclipseOverlay?.destroy();
        this._eclipseHalo?.destroy();

        this._eclipseOverlay = this.scene!.add.rectangle(cam.centerX, cam.centerY, cam.width, cam.height, 0x020108, 0.74)
            .setDepth(13);
        this._eclipseHalo = this.scene!.add.circle(this._player.x, this._player.y, 190, 0x4cc9f0, 0.14)
            .setStrokeStyle(3, 0x4cc9f0, 0.5)
            .setDepth(14);

        this.scene!.time.delayedCall(8000, () => {
            this._eclipseOverlay?.destroy();
            this._eclipseOverlay = undefined;
            this._eclipseHalo?.destroy();
            this._eclipseHalo = undefined;
        });
    }

    private triggerMiniBlackHole(): void {
        this.getSound()?.playWarning();
        this.game!.events.emit(GameConstants.Events.BANNER_EVENT, {
            title: 'EVENT: MINI TROU NOIR!',
            subtitle: 'LE VORTEX DEVIENT LES PROJECTILES !',
            color: '#c77dff',
        });

        const cam = this.scene!.cameras.main;
        const bx = cam.centerX + Phaser.Math.Between(-160, 160);
        const by = cam.centerY - 120;
        this._blackHolePos = {x: bx, y: by};

        this._blackHoleVisual?.destroy();
        this._blackHoleVisual = this.scene!.add.circle(bx, by, 54, 0x10002b, 0.92)
            .setStrokeStyle(8, 0xc77dff, 0.95)
            .setDepth(15);

        this.scene!.tweens.add({
            targets: this._blackHoleVisual,
            scale: {from: 0.2, to: 1.15},
            duration: 450,
            ease: 'Back.easeOut',
        });

        this.scene!.time.delayedCall(8000, () => {
            this._blackHoleVisual?.destroy();
            this._blackHoleVisual = undefined;
            this._blackHolePos = undefined;
        });
    }

    private triggerBountyHunter(): void {
        this.getSound()?.playPowerUp();
        this.game!.events.emit(GameConstants.Events.BANNER_EVENT, {
            title: 'EVENT: CHASSE A LA PRIME!',
            subtitle: 'DETRUISEZ LA CIBLE DOREE EN 8s (+2000 & +1 EMP)',
            color: '#ffd166',
        });

        const tank = this._enemiesCatalog['tank'] ?? this._enemiesCatalog['scout'];
        if (!tank) return;
        const target = this._enemies.get() as ArcadeEnemy | null;
        if (!target) return;

        target.enableWithArchetype(this.scene!.cameras.main.centerX, 0, tank, this._difficulty.enemyHpMult, this._difficulty);
        target.markAsBounty();

        this.scene!.time.delayedCall(8000, () => {
            if (target.active && target.isBounty) {
                target.isBounty = false;
                target.clearBountyVisuals();
            }
        });
    }

    private triggerMeteorShower(): void {
        this.getSound()?.playWarning();
        this.game!.events.emit(GameConstants.Events.BANNER_EVENT, {
            title: 'EVENT: PLUIE DE METEORITES!',
            subtitle: 'ESQUIVEZ LES COULOIRS ROUGES OU DETRUISEZ-LES',
            color: '#ff9f1c',
        });

        const camW = this.scene!.cameras.main.width;
        const camH = this.scene!.cameras.main.height;
        for (let i = 0; i < 8; i++) {
            this.scene!.time.delayedCall(550 + i * 480, () => {
                if (!this._player?.active) return;
                const x = Phaser.Math.Between(120, camW - 120);

                // Clear vertical warning lane + icon so player immediately understands the meteor path
                const lane = this.scene!.add.rectangle(x, camH / 2, 110, camH, 0xff9f1c, 0.14)
                    .setStrokeStyle(3, 0xff9f1c, 0.65)
                    .setDepth(12);
                const marker = this.scene!.add.text(x, 140, '! METEOR !', {
                    fontFamily: 'future',
                    fontSize: '26px',
                    color: '#ff9f1c',
                    stroke: '#000',
                    strokeThickness: 6,
                }).setOrigin(0.5).setDepth(65);

                this.scene!.tweens.add({
                    targets: [lane, marker],
                    alpha: 0,
                    duration: 320,
                    yoyo: true,
                    onComplete: () => {
                        lane.destroy();
                        marker.destroy();
                    },
                });

                this.scene!.time.delayedCall(620, () => {
                    const meteor = this._meteors.get() as Meteor | null;
                    if (!meteor) return;
                    const vx = Phaser.Math.FloatBetween(-0.04, 0.04);
                    const vy = Phaser.Math.FloatBetween(0.42, 0.62);
                    meteor.enable(x, -90, vx, vy, Phaser.Math.FloatBetween(0.16, 0.24));
                });
            });
        }
    }

    private triggerGoldRush(): void {
        this.getSound()?.playPowerUp();
        this.game!.events.emit(GameConstants.Events.BANNER_EVENT, {
            title: 'EVENT: GOLD RUSH!',
            subtitle: 'DETRUISEZ LES CARGOS DORES POUR DES BONUS !',
            color: '#ffd166',
        });

        const cargo = this._enemiesCatalog['cargo'];
        if (!cargo) return;

        for (let i = 0; i < 3; i++) {
            this.scene!.time.delayedCall(i * 950, () => {
                const enemy = this._enemies.get() as ArcadeEnemy | null;
                if (enemy && this._player?.active) {
                    enemy.enableWithArchetype(0, 0, cargo, 1, this._difficulty);
                }
            });
        }
    }

    private triggerOverdriveStorm(): void {
        this.getSound()?.playPowerUp();
        this.game!.events.emit(GameConstants.Events.BANNER_EVENT, {
            title: 'EVENT: TEMPETE OVERDRIVE!',
            subtitle: 'CADENCE DE TIR x1.5 PENDANT 8 SECONDES !',
            color: '#4cc9f0',
        });

        this._player.setEventFireMultiplier(1.5);
        this.scene!.time.delayedCall(8000, () => {
            if (this._player?.active) {
                this._player.setEventFireMultiplier(1);
            }
        });
    }

    private triggerAmbushSquad(): void {
        this.getSound()?.playWarning();
        this.game!.events.emit(GameConstants.Events.BANNER_EVENT, {
            title: 'EVENT: EMBUSCADE!',
            subtitle: 'ESCADRILLE KAMIKAZE EN FORMATION V',
            color: '#f72585',
        });

        const striker = this._enemiesCatalog['kamikaze'] ?? this._enemiesCatalog['scout'];
        if (!striker) return;

        const centerX = this.scene!.cameras.main.centerX;
        const offsets = [-260, -130, 0, 130, 260];
        offsets.forEach((dx, idx) => {
            const x = centerX + dx;
            const warn = this.scene!.add.text(x, 120, '!', {
                fontFamily: 'future',
                fontSize: '42px',
                color: '#f72585',
                stroke: '#000',
                strokeThickness: 6,
            }).setOrigin(0.5).setDepth(65);
            this.scene!.tweens.add({
                targets: warn,
                alpha: 0,
                duration: 450,
                onComplete: () => warn.destroy(),
            });

            const delay = 350 + Math.abs(idx - 2) * 180;
            this.scene!.time.delayedCall(delay, () => {
                const enemy = this._enemies.get() as ArcadeEnemy | null;
                if (enemy && this._player?.active) {
                    enemy.enableWithArchetype(x, 0, striker, this._difficulty.enemyHpMult, this._difficulty);
                }
            });
        });
    }

    private spawnRandomPowerUp(x: number, y: number, forcedKind?: PowerUpKind): void {
        if (this._noPowerUps && !forcedKind) return;
        const powerUp = this._powerUps.get() as PowerUp | null;
        if (!powerUp) return;

        const kinds: PowerUpKind[] = ['weapon', 'weapon', 'rapidFire', 'shield', 'heal', 'bomb', 'drone', 'homing', 'beam'];
        const kind = forcedKind ?? kinds[Phaser.Math.Between(0, kinds.length - 1)];
        powerUp.enable(x, y, kind);
    }

    private collectPowerUp(powerUp: PowerUp): void {
        const kind = powerUp.kind;
        const visual = POWERUP_CATALOG[kind];
        const vfx = this.getVfx();
        const sound = this.getSound();

        let label = visual.label;
        switch (kind) {
            case 'weapon':
                if (!this._player.upgradeWeapon()) {
                    this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE, 500);
                    label = 'MAX WEAPON +500';
                }
                break;
            case 'rapidFire':
                this._player.activateRapidFire(5500);
                break;
            case 'homing':
                this._player.activateHoming(5000);
                break;
            case 'beam':
                this._player.activateLaserBeam(4000);
                break;
            case 'shield':
                if (this._player.hasShield) {
                    this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE, 400);
                    label = 'SHIELD +400';
                } else {
                    this._player.setShield(true);
                }
                break;
            case 'heal':
                if (!this._player.healOne()) {
                    this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE, 500);
                    label = 'FULL HP +500';
                }
                break;
            case 'bomb':
                if (!this._player.addBomb(1)) {
                    this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE, 500);
                    label = 'MAX EMP +500';
                }
                break;
            case 'drone':
                if (!this._player.addDrone()) {
                    this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE, 600);
                    label = 'MAX DRONES +600';
                }
                break;
        }

        vfx?.spawnFloatingText(powerUp.x, powerUp.y - 20, label, `#${visual.color.toString(16).padStart(6, '0')}`, 32);
        vfx?.spawnHitSpark(powerUp.x, powerUp.y, visual.color);
        sound?.playPowerUp();
        powerUp.disable();
    }

    private triggerEmpNova(): void {
        const vfx = this.getVfx();
        const sound = this.getSound();

        vfx?.spawnEmpWave(this._player.x, this._player.y);
        vfx?.spawnFloatingText(this._player.x, this._player.y - 70, 'EMP NOVA!', '#4cc9f0', 44);
        sound?.playEmp();

        this.clearAllEnemyBullets();

        // Damage all active enemies
        for (const obj of this._enemies.getChildren()) {
            const enemy = obj as ArcadeEnemy;
            if (enemy.active) {
                this.damageArcadeEnemy(enemy, EntityManager.EMP_ENEMY_DAMAGE);
            }
        }

        // Destroy active meteors
        for (const obj of this._meteors.getChildren()) {
            const meteor = obj as Meteor;
            if (meteor.active) {
                this.damageMeteor(meteor, EntityManager.EMP_ENEMY_DAMAGE);
            }
        }

        // Heavy damage to active boss
        if (this._activeBoss && this._activeBoss.isVulnerable) {
            this.damageBoss(this._activeBoss, EntityManager.EMP_BOSS_DAMAGE);
        }
    }

    private clearAllEnemyBullets(): void {
        const vfx = this.getVfx();
        for (const obj of this._enemyBullets.getChildren()) {
            const bullet = obj as Bullet;
            if (bullet.active) {
                vfx?.spawnHitSpark(bullet.x, bullet.y, 0x4cc9f0);
                bullet.disable();
            }
        }
    }

    private incrementCombo(): void {
        this._comboCount++;
        if (this._comboCount > this._maxCombo) {
            this._maxCombo = this._comboCount;
            this.scene!.registry.set(RegistryConstants.Keys.MAX_COMBO, this._maxCombo);
        }

        if (this._comboCount >= 25) {
            this._comboMultiplier = 8;
            AchievementManager.unlock(this.scene!, 'combo_8x');
        } else if (this._comboCount >= 15) this._comboMultiplier = 6;
        else if (this._comboCount >= 10) this._comboMultiplier = 4;
        else if (this._comboCount >= 6) this._comboMultiplier = 3;
        else if (this._comboCount >= 3) this._comboMultiplier = 2;
        else this._comboMultiplier = 1;

        this._comboDecayTimer?.remove(false);
        this._comboDecayTimer = this.scene!.time.delayedCall(EntityManager.COMBO_DURATION_MS, () => {
            this.resetCombo();
        });

        this.emitComboState();
    }

    private resetCombo(): void {
        this._tookHitThisWave = true;
        this._comboCount = 0;
        this._comboMultiplier = 1;
        this._comboDecayTimer?.remove(false);
        this.emitComboState();
    }

    public updateRuntime(deltaTime: number): void {
        if (!this._player?.active) return;

        // Eclipse halo follows player
        if (this._eclipseHalo) {
            this._eclipseHalo.setPosition(this._player.x, this._player.y);
        }

        // Grazing detection & Black Hole pull on enemy bullets
        const grazeRadiusSq = 68 * 68;
        const vfx = this.getVfx();
        for (const obj of this._enemyBullets.getChildren()) {
            const bullet = obj as Bullet;
            if (!bullet.active) continue;

            if (this._blackHolePos) {
                bullet.applyGravityPull(this._blackHolePos.x, this._blackHolePos.y, 260, deltaTime);
            }

            if (!bullet.grazed && !this._player.isInvincible) {
                const dx = bullet.x - this._player.x;
                const dy = bullet.y - this._player.y;
                if (dx * dx + dy * dy <= grazeRadiusSq) {
                    bullet.grazed = true;
                    this._grazeCount++;
                    this._player.addOverdriveCharge(9);
                    this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE, 50);
                    vfx?.spawnHitSpark(this._player.x + dx * 0.5, this._player.y + dy * 0.5, 0x00f5d4);
                    vfx?.spawnFloatingText(this._player.x, this._player.y - 50, '+50 GRAZE', '#00f5d4', 20);
                    if (this._grazeCount >= 20) {
                        AchievementManager.unlock(this.scene!, 'graze_master');
                    }
                }
            }
        }

        // Homing missiles steering toward Boss or nearest enemy
        for (const obj of this._playerBullets.getChildren()) {
            const bullet = obj as Bullet;
            if (!bullet.active || !bullet.isHoming) continue;
            const target = this.findNearestHostile(bullet.x, bullet.y);
            if (target) {
                bullet.steerToward(target.x, target.y, 0.14);
            }
        }

        // Aegis Guardian shield tether visual
        if (this._aegisGraphics) {
            this._aegisGraphics.clear();
            const activeEnemies = (this._enemies.getChildren() as ArcadeEnemy[]).filter(e => e.active);
            const aegises = activeEnemies.filter(e => e.isAegis);
            if (aegises.length > 0) {
                this._aegisGraphics.lineStyle(3, 0x4895ef, 0.75);
                for (const aegis of aegises) {
                    for (const ally of activeEnemies) {
                        if (ally === aegis || ally.isAegis) continue;
                        this._aegisGraphics.lineBetween(aegis.x, aegis.y, ally.x, ally.y);
                    }
                }
            }
        }
    }

    private findNearestHostile(x: number, y: number): {x: number; y: number} | null {
        if (this._activeBoss && this._activeBoss.isVulnerable) {
            return {x: this._activeBoss.x, y: this._activeBoss.y};
        }

        let best: {x: number; y: number} | null = null;
        let bestDistSq = Infinity;
        for (const obj of this._enemies.getChildren()) {
            const enemy = obj as ArcadeEnemy;
            if (!enemy.active) continue;
            const dx = enemy.x - x;
            const dy = enemy.y - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestDistSq) {
                bestDistSq = d2;
                best = {x: enemy.x, y: enemy.y};
            }
        }
        return best;
    }

    private hasActiveAegis(): boolean {
        for (const obj of this._enemies.getChildren()) {
            const e = obj as ArcadeEnemy;
            if (e.active && e.isAegis) return true;
        }
        return false;
    }

    private handlePlayerBeamTick(beamX: number, playerY: number): void {
        const halfW = 36;
        for (const obj of this._enemies.getChildren()) {
            const enemy = obj as ArcadeEnemy;
            if (enemy.active && enemy.y < playerY && Math.abs(enemy.x - beamX) <= halfW + enemy.displayWidth * 0.4) {
                this.damageArcadeEnemy(enemy, 1.2);
            }
        }
        for (const obj of this._meteors.getChildren()) {
            const meteor = obj as Meteor;
            if (meteor.active && meteor.y < playerY && Math.abs(meteor.x - beamX) <= halfW + meteor.displayWidth * 0.4) {
                this.damageMeteor(meteor, 1.5);
            }
        }
        if (this._activeBoss && this._activeBoss.isVulnerable && Math.abs(this._activeBoss.x - beamX) <= halfW + this._activeBoss.displayWidth * 0.4) {
            this.damageBoss(this._activeBoss, 1.2);
        }
    }

    private startInteractiveTutorial(): void {
        this._tutorialActive = true;
        this._tutorialStep = 0;
        this._tutorialAdvancing = false;
        this._tutorialDummies = [];

        this.emitTutorialPrompt(false);
        this._player.setTutorialActionCallback((action) => {
            if (!this._tutorialActive || this._tutorialAdvancing) return;
            if (this._tutorialStep === 0 && action === 'move') {
                this.advanceTutorialStep();
            } else if (this._tutorialStep === 1 && action === 'dash') {
                this.advanceTutorialStep();
            } else if (this._tutorialStep === 3 && action === 'emp') {
                this._player.addBomb(1);
                this.advanceTutorialStep();
            }
        });
    }

    private advanceTutorialStep(): void {
        this._tutorialAdvancing = true;
        this.getSound()?.playPowerUp();
        this.emitTutorialPrompt(true);

        this.scene!.time.delayedCall(1050, () => {
            if (!this._player?.active) return;
            this._tutorialStep++;
            this._tutorialAdvancing = false;

            if (this._tutorialStep > 3) {
                this.finishTutorial();
                return;
            }

            // Step 2 (Shoot): spawn the single immobile target ONLY now!
            if (this._tutorialStep === 2) {
                this.spawnTutorialDummy(this.scene!.cameras.main.centerX, 460);
            }

            // Step 3 (EMP Bomb): spawn 4 immobile enemies so the player can blast them all!
            if (this._tutorialStep === 3) {
                const cx = this.scene!.cameras.main.centerX;
                const positions = [
                    {x: cx - 260, y: 470},
                    {x: cx - 95, y: 410},
                    {x: cx + 95, y: 410},
                    {x: cx + 260, y: 470},
                ];
                for (const pos of positions) {
                    this.spawnTutorialDummy(pos.x, pos.y);
                }
            }

            this.emitTutorialPrompt(false);
        });
    }

    private spawnTutorialDummy(x: number, y: number): void {
        const dummy = this._enemies.get() as ArcadeEnemy | null;
        const scout = this._enemiesCatalog['scout'];
        if (dummy && scout) {
            dummy.setAsTutorialDummy(x, y, scout);
            this._tutorialDummies.push(dummy);
            this.getVfx()?.spawnHitSpark(x, y, 0x4cc9f0);
        }
    }

    private emitTutorialPrompt(validated: boolean): void {
        const prompts = [
            'ETAPE 1 / 4\nDEPLACEZ-VOUS AVEC FLECHES / WASD / ZQSD',
            'ETAPE 2 / 4\nFAITES UN DASH INVINCIBLE AVEC [SHIFT]',
            'ETAPE 3 / 4\nDETRUISEZ LA CIBLE IMMOBILE AVEC [ESPACE]',
            'ETAPE 4 / 4\nVAPORISEZ LES ENNEMIS AVEC LA BOMBE EMP [E / X]',
        ];
        this.game!.events.emit(GameConstants.Events.TUTORIAL_PROMPT, {
            text: prompts[this._tutorialStep] ?? '',
            validated,
        });
    }

    private finishTutorial(): void {
        this._tutorialActive = false;
        this._tutorialAdvancing = false;
        this._player.setTutorialActionCallback(undefined);
        for (const d of this._tutorialDummies) {
            if (d.active) d.disable();
        }
        this._tutorialDummies = [];
        this.game!.events.emit(GameConstants.Events.TUTORIAL_PROMPT, {text: '', validated: false});
        this.getSound()?.playWaveClear();
        this.game!.events.emit(GameConstants.Events.BANNER_EVENT, {
            title: 'TUTORIEL TERMINE !',
            subtitle: 'PREPAREZ-VOUS POUR LA VAGUE 1 !',
            color: '#80ed99',
        });
        this.scene!.time.delayedCall(2200, () => {
            if (this._player?.active) {
                this.startNextWave();
            }
        });
    }

    private emitComboState(): void {
        this.game!.events.emit(GameConstants.Events.COMBO_CHANGED, {
            count: this._comboCount,
            multiplier: this._comboMultiplier,
        });
    }

    private handleCheatAction(action: string): void {
        if (!this._player?.active) return;

        switch (action) {
            case 'god_mode': {
                const enabled = this._player.toggleGodMode();
                this.getVfx()?.spawnFloatingText(this._player.x, this._player.y - 60, enabled ? 'GOD MODE: ON' : 'GOD MODE: OFF', '#ffe066', 32);
                break;
            }
            case 'next_wave':
                this.cheatJumpToWave(this._currentWave + 1);
                break;
            case 'next_boss': {
                const nextBossWave = Math.ceil((this._currentWave + 1) / 6) * 6;
                this.cheatJumpToWave(nextBossWave);
                break;
            }
            case 'final_boss':
                this.cheatJumpToWave(CAMPAIGN_FINAL_WAVE);
                break;
            case 'weapon_max':
                this._player.setWeaponMax();
                break;
            case 'full_heal':
                this._player.fullHeal();
                break;
            case 'add_bombs':
                this._player.addBomb(3);
                break;
            case 'overdrive_100':
                this._player.fillOverdrive();
                break;
            case 'drones_shield':
                this._player.addDrone();
                this._player.addDrone();
                this._player.setShield(true);
                break;
            case 'all_buffs':
                this._player.activateHoming(10000);
                this._player.activateLaserBeam(8000);
                this._player.activateRapidFire(10000);
                break;
            case 'kill_all':
                this.clearAllEnemyBullets();
                for (const obj of this._enemies.getChildren()) {
                    const e = obj as ArcadeEnemy;
                    if (e.active) this.damageArcadeEnemy(e, 9999);
                }
                for (const obj of this._meteors.getChildren()) {
                    const m = obj as Meteor;
                    if (m.active) this.damageMeteor(m, 9999);
                }
                if (this._activeBoss && this._activeBoss.isVulnerable) {
                    this.damageBoss(this._activeBoss, 9999);
                }
                break;
            case 'add_score':
                this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE, 10000);
                break;
        }
    }

    private cheatJumpToWave(targetWave: number): void {
        if (this._tutorialActive) {
            this._tutorialActive = false;
            this._player.setTutorialActionCallback(undefined);
            this.game!.events.emit(GameConstants.Events.TUTORIAL_PROMPT, {text: '', validated: false});
        }
        this.clearAllEnemyBullets();
        for (const obj of this._enemies.getChildren()) {
            const e = obj as ArcadeEnemy;
            if (e.active) e.disable();
        }
        this.clearActiveBosses();
        this._currentWave = Math.max(0, targetWave - 1);
        this.startNextWave();
    }

    destroy(): void {
        this.game?.events.off(GameConstants.Events.CHEAT_ACTION, this.handleCheatAction, this);
        this._spawnTimer?.remove(false);
        this._bossSpawnTimer?.remove(false);
        this._randomEventTimer?.remove(false);
        this._comboDecayTimer?.remove(false);
        super.destroy();
    }
}
