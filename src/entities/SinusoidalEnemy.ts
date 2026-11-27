import Health from "../components/Health.ts";
import SinusoidalMovement from "../components/SinusoidalMovement.ts";
import Weapon from "../components/Weapon.ts";
import GameConstants from "../GameConstants.ts";
import type {BulletData} from "../gameData/BulletData.ts";
import {parseHexColor, type SinusoidalEnemyData} from "../gameData/SinusoidalEnemyData.ts";
import Entity from "./Entity.ts";

export default class SinusoidalEnemy extends Entity {
    private static readonly FACING_DOWN_ANGLE_DEG: number = 90;
    private static readonly HIT_FLASH_DURATION_MS: number = 50;
    private static readonly HIT_SLOWDOWN_FACTOR: number = 0.5;
    private static readonly SHOOT_ANIM_FRAME_RATE: number = 4;

    private _config!: SinusoidalEnemyData;
    private _baseTint: number = 0xffffff;
    private _shootTimerConfig!: Phaser.Types.Time.TimerEventConfig;
    private _shootTimer!: Phaser.Time.TimerEvent;
    private _hitFlashTimer?: Phaser.Time.TimerEvent;
    private _isHitFlashing: boolean = false;

    public init(bulletsGroup: Phaser.Physics.Arcade.Group, config: SinusoidalEnemyData): void {
        this._config = config;
        this._baseTint = parseHexColor(config.tint);

        const bulletData: BulletData = {
            width: config.bullet.width,
            height: config.bullet.height,
            color: parseHexColor(config.bullet.color),
            speed: config.bullet.speed,
            damage: config.bullet.damage,
        };

        this.addComponent(new Health(config.health, this));
        this.addComponent(new SinusoidalMovement(config.movement));
        this.addComponent(new Weapon(bulletsGroup, bulletData, config.spreadShot));

        this.setScale(config.scale);
        this.setTint(this._baseTint);
        this.angle = SinusoidalEnemy.FACING_DOWN_ANGLE_DEG;

        const health = this.getComponent(Health);
        health?.on(Health.CHANGE_EVENT, () => {
            this._isHitFlashing = true;
            this.setTintFill(GameConstants.Colors.HIT_FLASH);

            if (health.current === 0) {
                this.disableBody();
            }

            this._hitFlashTimer?.remove(false);
            this._hitFlashTimer = this.scene.time.delayedCall(SinusoidalEnemy.HIT_FLASH_DURATION_MS, () => {
                this._isHitFlashing = false;
                this.setTint(this._baseTint);

                if (health.current === 0) {
                    this.disable();
                }
            });
        });

        this._shootTimerConfig = {
            delay: Phaser.Math.Between(config.shootDelayMin, config.shootDelayMax),
            callback: this.shoot,
            callbackScope: this,
            loop: true,
            paused: true,
        };
        this._shootTimer = this.scene.time.addEvent(this._shootTimerConfig);

        if (!this.scene.anims.exists(GameConstants.AnimKeys.UFO_SHOOT)) {
            this.scene.anims.create({
                key: GameConstants.AnimKeys.UFO_SHOOT,
                frames: [
                    {key: GameConstants.TextureKeys.SPRITES, frame: GameConstants.SpriteFrames.ENEMY_UFO},
                    {key: GameConstants.TextureKeys.SPRITES, frame: GameConstants.SpriteFrames.ENEMY_UFO_SHOOT_0},
                    {key: GameConstants.TextureKeys.SPRITES, frame: GameConstants.SpriteFrames.ENEMY_UFO_SHOOT_1},
                ],
                frameRate: SinusoidalEnemy.SHOOT_ANIM_FRAME_RATE,
            });
        }

        this.arcadeBody.setCircle(this.width / 2);
    }

    public enable(x: number, y: number): void {
        const cameraWidth = this.scene.cameras.main.width;
        const margin = Math.min(this.displayWidth / 2 + this._config.movement.amplitude, cameraWidth / 2);
        const clampedOriginX = Phaser.Math.Clamp(x, margin, cameraWidth - margin);

        this.enableBody(true, clampedOriginX, y - this.displayHeight, true, true);
        this.setTexture(GameConstants.TextureKeys.SPRITES, GameConstants.SpriteFrames.ENEMY_UFO);
        this.setTint(this._baseTint);

        this._hitFlashTimer?.remove(false);
        this._isHitFlashing = false;

        this.getComponent(SinusoidalMovement)?.reset(clampedOriginX);

        this._shootTimerConfig.delay = Phaser.Math.Between(
            this._config.shootDelayMin,
            this._config.shootDelayMax
        );
        this._shootTimerConfig.paused = false;
        this._shootTimer.reset(this._shootTimerConfig);

        // Restore health when reused from the pool without triggering hit events
        const health = this.getComponent(Health);
        if (health) {
            health.heal(health.max, false);
        }
    }

    public disable(): void {
        this.stop();
        this.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE);

        this._hitFlashTimer?.remove(false);
        this._isHitFlashing = false;

        this.disableBody(true, true);
        this._shootTimer.paused = true;
    }

    private shoot(): void {
        this.play(GameConstants.AnimKeys.UFO_SHOOT);
        this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            this.setTexture(GameConstants.TextureKeys.SPRITES, GameConstants.SpriteFrames.ENEMY_UFO);
            if (!this._isHitFlashing) {
                this.setTint(this._baseTint);
            }

            this.getComponent(Weapon)?.shoot(this);
            this.scene.sound.play(GameConstants.SoundKeys.ENEMY_LASER);
        });
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number): void {
        super.preUpdate(timeSinceLaunch, deltaTime);

        if (!this.active) {
            return;
        }

        if (this.y > this.scene.cameras.main.height + this.displayHeight) {
            this.disable();
            return;
        }

        const effectiveDelta = this._isHitFlashing
            ? deltaTime * SinusoidalEnemy.HIT_SLOWDOWN_FACTOR
            : deltaTime;
        this.getComponent(SinusoidalMovement)?.move(this, effectiveDelta);
    }
}
