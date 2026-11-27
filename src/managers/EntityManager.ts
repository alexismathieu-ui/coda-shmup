import {GameObjects, Plugins, Physics, Scene} from "phaser";
import Health from "../components/Health.ts";
import Bullet from "../entities/Bullet.ts";
import Enemy from "../entities/Enemy.ts";
import Entity from "../entities/Entity.ts";
import Player from "../entities/Player.ts";
import SinusoidalEnemy from "../entities/SinusoidalEnemy.ts";
import type {SinusoidalEnemyData} from "../gameData/SinusoidalEnemyData.ts";
import GroupUtils from "../utils/GroupUtils.ts";
import GameConstants from "../GameConstants.ts";
import RegistryConstants from "../RegistryConstants.ts";

export default class EntityManager extends Plugins.ScenePlugin {
    public static readonly PLUGIN_KEY: string = 'EntityManager';
    public static readonly MAPPING_NAME: string = 'entityManager';

    private static readonly SPAWN_HORIZONTAL_MARGIN: number = 64;

    // noinspection JSUnusedGlobalSymbols
    private readonly bulletGroupConfig = {
        classType: Bullet,
        maxSize: GameConstants.Pools.PLAYER_BULLETS_MAX_SIZE,
        runChildUpdate: true,
        createCallback: (bullet: GameObjects.GameObject) => {
            (bullet as Bullet).init();
        }
    }

    private readonly enemyBulletGroupConfig = {
        classType: Bullet,
        maxSize: GameConstants.Pools.ENEMY_BULLETS_MAX_SIZE,
        runChildUpdate: true,
        createCallback: (bullet: GameObjects.GameObject) => {
            (bullet as Bullet).init();
        }
    }

    private _player: Player;
    private _playerBullets: Physics.Arcade.Group;
    private _enemies: Physics.Arcade.Group;
    private _sinusoidalEnemies: Physics.Arcade.Group;
    private _enemyBullets: Physics.Arcade.Group;
    private _sinusoidalEnemyConfig: SinusoidalEnemyData;

    constructor(scene: Scene, pluginManager: Plugins.PluginManager) {
        super(scene, pluginManager, EntityManager.PLUGIN_KEY);

        console.log("[EntityManager] Initialized");
    }

    destroy() {
        super.destroy();

        console.log("[EntityManager] Destroyed");
    }

    public initAndSpawnPlayer(): Player {
        this._playerBullets = this.scene!.physics.add.group(this.bulletGroupConfig);
        GroupUtils.populate(GameConstants.Pools.PLAYER_BULLETS_INITIAL_SIZE, this._playerBullets);

        this._player = new Player(this.scene!, this.scene!.cameras.main.centerX, this.scene!.cameras.main.height - 128);
        this._player.init(this._playerBullets);

        console.log("[EntityManager] Player spawned");

        this.game!.events.emit(GameConstants.Events.PLAYER_SPAWNED_EVENT, this._player);

        return this._player;
    }

    public initEnemies(): Physics.Arcade.Group {
        this._enemyBullets = this.scene!.physics.add.group(this.enemyBulletGroupConfig);
        GroupUtils.populate(GameConstants.Pools.ENEMY_BULLETS_MAX_SIZE, this._enemyBullets);

        this._enemies = this.scene!.physics.add.group({
            classType: Enemy,
            defaultKey: GameConstants.TextureKeys.SPRITES,
            defaultFrame: GameConstants.SpriteFrames.ENEMY_UFO,
            createCallback: (enemy) => {
                (enemy as Enemy).init(this._enemyBullets);
            }
        });

        // Spawn enemies indefinitely
        this.scene!.time.addEvent({
            delay: 1500,
            callback: this.spawnEnemy,
            callbackScope: this,
            loop: true
        });

        this.initSinusoidalEnemies();

        console.log("[EntityManager] Enemies initialized");

        return this._enemies;
    }

    public initGroupCollisions() {
        this.registerEnemyCollisions(this._enemies);
        this.registerEnemyCollisions(this._sinusoidalEnemies);

        this.scene!.physics.add.overlap(this._player, this._enemyBullets, (player, bullet) => {
            (bullet as Bullet).disable();
            (player as Player).getComponent(Health)?.damage((bullet as Bullet).damage);

            this.scene?.cameras.main.shake(100, 0.01);
        });

        console.log("[EntityManager] Group collisions initialized");
    }

    private initSinusoidalEnemies(): void {
        this._sinusoidalEnemyConfig = this.scene!.cache.json.get(
            GameConstants.CacheKeys.SINUSOIDAL_ENEMY
        ) as SinusoidalEnemyData;

        this._sinusoidalEnemies = this.scene!.physics.add.group({
            classType: SinusoidalEnemy,
            maxSize: this._sinusoidalEnemyConfig.poolSize,
            defaultKey: GameConstants.TextureKeys.SPRITES,
            defaultFrame: GameConstants.SpriteFrames.ENEMY_UFO,
            createCallback: (enemy) => {
                (enemy as SinusoidalEnemy).init(this._enemyBullets, this._sinusoidalEnemyConfig);
            }
        });

        GroupUtils.populate(this._sinusoidalEnemyConfig.poolSize, this._sinusoidalEnemies);

        this.scene!.time.addEvent({
            delay: this._sinusoidalEnemyConfig.spawnRate,
            callback: this.spawnSinusoidalEnemy,
            callbackScope: this,
            loop: true
        });
    }

    private registerEnemyCollisions(enemyGroup: Physics.Arcade.Group): void {
        this.scene!.physics.add.overlap(this._playerBullets, enemyGroup, (bullet, enemy) => {
            this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE);

            (bullet as Bullet).disable();
            (enemy as Entity).getComponent(Health)?.damage((bullet as Bullet).damage);
        });

        this.scene!.physics.add.overlap(this._player, enemyGroup, (player, enemy) => {
            this.scene!.registry.inc(RegistryConstants.Keys.PLAYER_SCORE);

            const enemyHealth = (enemy as Entity).getComponent(Health);
            enemyHealth?.damage(enemyHealth?.max);

            const playerHealth = (player as Player).getComponent(Health);
            playerHealth?.damage(1);

            this.scene?.cameras.main.shake(100, 0.03);
        });
    }

    private spawnEnemy() {
        if (this._enemies.countActive(true) >= 5) {
            return;
        }

        const enemy = this._enemies.get() as Enemy;
        if (!enemy) {
            return;
        }

        enemy.enable(
            Phaser.Math.Between(EntityManager.SPAWN_HORIZONTAL_MARGIN, this.scene!.cameras.main.width - EntityManager.SPAWN_HORIZONTAL_MARGIN),
            0
        );

        this.game!.events.emit(GameConstants.Events.ENEMY_SPAWNED_EVENT, enemy);

        console.log("[EntityManager] Enemy spawned");
    }

    private spawnSinusoidalEnemy(): void {
        if (this._sinusoidalEnemies.countActive(true) >= this._sinusoidalEnemyConfig.maxActive) {
            return;
        }

        const enemy = this._sinusoidalEnemies.get() as SinusoidalEnemy | null;
        if (!enemy) {
            return;
        }

        enemy.enable(
            Phaser.Math.Between(EntityManager.SPAWN_HORIZONTAL_MARGIN, this.scene!.cameras.main.width - EntityManager.SPAWN_HORIZONTAL_MARGIN),
            0
        );

        this.game!.events.emit(GameConstants.Events.ENEMY_SPAWNED_EVENT, enemy);
    }
}