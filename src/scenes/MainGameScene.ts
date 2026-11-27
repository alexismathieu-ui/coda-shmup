import {GameObjects, Input, Scene, Scenes} from 'phaser';
import Health from "../components/Health.ts";
import GameConstants from "../GameConstants.ts";
import {getDifficultyConfig} from "../gameData/DifficultyData.ts";
import EntityManager from "../managers/EntityManager.ts";
import SaveManager from "../managers/SaveManager.ts";
import SoundManager from "../managers/SoundManager.ts";
import VfxManager from "../managers/VfxManager.ts";
import RegistryConstants from "../RegistryConstants.ts";
import SaveConstants from "../SaveConstants.ts";

type StarDot = {
    sprite: GameObjects.Rectangle;
    speed: number;
};

export default class MainGameScene extends Scene {
    private bg!: GameObjects.TileSprite;
    private planet!: GameObjects.Image;
    private stars: StarDot[] = [];
    private warpSpeedMultiplier: number = 1;
    private isPausedOverlay: boolean = false;
    private isRogueliteModalOpen: boolean = false;

    private saveManager!: SaveManager;
    private entityManager!: EntityManager;
    private vfxManager!: VfxManager;
    private soundManager!: SoundManager;

    constructor() {
        super(GameConstants.SceneKeys.MAIN_GAME);
    }

    // noinspection JSUnusedGlobalSymbols
    create(): void {
        this.isPausedOverlay = false;
        this.isRogueliteModalOpen = false;
        this.warpSpeedMultiplier = 1;
        this.stars = [];

        this.saveManager?.load();

        const diff = getDifficultyConfig(this.registry.get(RegistryConstants.Keys.SELECTED_DIFFICULTY));
        const isNightmare = diff.id === 'cauchemar';

        const bgMargin = 512;
        this.bg = this.add.tileSprite(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width + bgMargin,
            this.cameras.main.height + bgMargin,
            'bg'
        ).setTileScale(2);

        if (isNightmare) {
            this.bg.setTint(0xff4466);
            this.add.rectangle(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                this.cameras.main.width,
                this.cameras.main.height,
                0x660011,
                0.22
            ).setDepth(0);
        }

        this.createParallaxStars();

        this.planet = this.add.image(
            Phaser.Math.Between(80, this.cameras.main.width - 280),
            -512,
            'planet'
        ).setOrigin(0).setAlpha(0.82).setDepth(2);
        if (isNightmare) {
            this.planet.setTint(0xff6677);
        }

        this.registry.set(RegistryConstants.Keys.PLAYER_SCORE, 0);
        this.registry.set(RegistryConstants.Keys.VICTORY, false);

        this.entityManager.setWarpCallback((active: boolean) => {
            this.tweens.add({
                targets: this,
                warpSpeedMultiplier: active ? 4.5 : 1,
                duration: 450,
                ease: 'Quad.easeInOut',
            });
        });
        this.entityManager.setVictoryCallback(() => this.triggerVictory());

        const onOfferCards = () => {
            this.isRogueliteModalOpen = true;
            this.physics.world.pause();
            this.time.paused = true;
        };
        const onCardChosen = () => {
            this.isRogueliteModalOpen = false;
            this.physics.world.resume();
            this.time.paused = false;
        };
        const onReturnToMenu = () => {
            this.isPausedOverlay = false;
            this.isRogueliteModalOpen = false;
            this.physics.world.resume();
            this.time.paused = false;
            this.tweens.resumeAll();
            this.soundManager?.stopMusic();
            this.scene.stop(GameConstants.SceneKeys.MAIN_UI);
            this.scene.start(GameConstants.SceneKeys.HOME);
        };

        this.game.events.on(GameConstants.Events.ROGUELITE_OFFER_CARDS, onOfferCards);
        this.game.events.on(GameConstants.Events.ROGUELITE_CARD_CHOSEN, onCardChosen);
        this.game.events.on(GameConstants.Events.RETURN_TO_MENU, onReturnToMenu);
        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.soundManager?.stopMusic();
            this.game.events.off(GameConstants.Events.ROGUELITE_OFFER_CARDS, onOfferCards);
            this.game.events.off(GameConstants.Events.ROGUELITE_CARD_CHOSEN, onCardChosen);
            this.game.events.off(GameConstants.Events.RETURN_TO_MENU, onReturnToMenu);
        });

        this.soundManager?.startMusic(isNightmare ? 'nightmare' : 'normal');

        const player = this.entityManager.initAndSpawnPlayer();
        player.getComponent(Health)?.once(Health.DEATH_EVENT, () => {
            player.disableBody(true, true);
            player.hideVisuals();
            this.vfxManager?.spawnExplosion(player.x, player.y, 0x4cc9f0, 2.0);
            this.soundManager?.playExplosion(true);
            this.cameras.main.shake(350, 0.025);
            this.time.delayedCall(1100, this.endGame, [], this);
        }, this);

        this.entityManager.initEnemies();
        this.entityManager.initGroupCollisions();

        if (this.input.keyboard) {
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.R).on('down', () => {
                if (!this.isPausedOverlay) {
                    this.scene.restart();
                }
            });
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.M).on('down', () => {
                this.soundManager?.toggleMute();
            });
            const togglePause = () => this.togglePause();
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.P).on('down', togglePause);
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.ESC).on('down', togglePause);
        }
    }

    private createParallaxStars(): void {
        const w = this.cameras.main.width;
        const h = this.cameras.main.height;

        for (let i = 0; i < 42; i++) {
            const layer = i % 3;
            const size = layer === 0 ? 1.5 : layer === 1 ? 2 : 2.5;
            const alpha = layer === 0 ? 0.14 : layer === 1 ? 0.22 : 0.30;
            const speed = layer === 0 ? 0.06 : layer === 1 ? 0.14 : 0.26;
            const color = i % 5 === 0 ? 0x6b7aa1 : 0x9aa5ce;

            const rect = this.add.rectangle(
                Phaser.Math.Between(0, w),
                Phaser.Math.Between(0, h),
                size,
                size,
                color,
                alpha
            ).setDepth(1);

            this.stars.push({sprite: rect, speed});
        }
    }

    public togglePause(): void {
        if (this.isRogueliteModalOpen) return;

        this.isPausedOverlay = !this.isPausedOverlay;
        this.game.events.emit(GameConstants.Events.PAUSE_TOGGLED, this.isPausedOverlay);

        if (this.isPausedOverlay) {
            this.physics.world.pause();
            this.time.paused = true;
            this.tweens.pauseAll();
        } else {
            this.physics.world.resume();
            this.time.paused = false;
            this.tweens.resumeAll();
        }
    }

    private triggerVictory(): void {
        this.registry.set(RegistryConstants.Keys.VICTORY, true);
        this.endGame();
    }

    private endGame(): void {
        const bestScore: number = Number(this.saveManager?.getData(SaveConstants.Keys.PLAYER_BEST_SCORE) ?? 0);
        const currentScore: number = Number(this.registry.get(RegistryConstants.Keys.PLAYER_SCORE) ?? 0);
        if (currentScore > bestScore) {
            this.saveManager?.setData(SaveConstants.Keys.PLAYER_BEST_SCORE, currentScore);
        }

        this.scene.start(GameConstants.SceneKeys.GAME_OVER);
    }

    update(_timeSinceLaunch: number, deltaTime: number): void {
        if (this.isPausedOverlay || this.isRogueliteModalOpen) return;

        this.entityManager.updateRuntime(deltaTime);

        const mult = this.warpSpeedMultiplier;
        this.bg.tilePositionY -= 0.12 * mult * deltaTime;
        this.planet.y += 0.25 * mult * deltaTime;

        const h = this.cameras.main.height;
        const w = this.cameras.main.width;
        if (this.planet.y > h + 512) {
            this.planet.y = -620;
            this.planet.x = Phaser.Math.Between(-100, w - 280);
        }

        for (const star of this.stars) {
            star.sprite.y += star.speed * mult * deltaTime;
            star.sprite.scaleY = mult > 1.5 ? 4 : 1;
            if (star.sprite.y > h + 20) {
                star.sprite.y = -20;
                star.sprite.x = Phaser.Math.Between(0, w);
            }
        }
    }
}
