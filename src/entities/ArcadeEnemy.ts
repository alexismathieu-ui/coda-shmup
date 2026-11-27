import {GameObjects} from "phaser";
import Health from "../components/Health.ts";
import Weapon from "../components/Weapon.ts";
import GameConstants from "../GameConstants.ts";
import type {BulletData} from "../gameData/BulletData.ts";
import type {DifficultyConfig} from "../gameData/DifficultyData.ts";
import type {EnemyArchetypeData} from "../gameData/EnemyArchetypeData.ts";
import {parseHexColor} from "../gameData/SinusoidalEnemyData.ts";
import VfxManager from "../managers/VfxManager.ts";
import Entity from "./Entity.ts";
import Player from "./Player.ts";

export default class ArcadeEnemy extends Entity {
    private static readonly FACING_DOWN_ANGLE_DEG: number = 90;
    private static readonly HIT_FLASH_DURATION_MS: number = 55;
    private static readonly HIT_SLOWDOWN_FACTOR: number = 0.5;
    private static readonly SHOOT_ANIM_FRAME_RATE: number = 5;

    private _archetype!: EnemyArchetypeData;
    private _difficulty?: DifficultyConfig;
    private _bulletData?: BulletData;
    private _baseTint: number = 0xffffff;
    private _targetPlayer?: Player;

    private _originX: number = 0;
    private _elapsedMs: number = 0;
    private _cargoDir: number = 1;
    private _spiralAngleRad: number = Math.PI / 2;

    // Kamikaze state
    private _kamikazeLocked: boolean = false;
    private _kamikazeVx: number = 0;
    private _kamikazeVy: number = 0;

    // Sniper laser telegraph
    private _aimLine?: GameObjects.Line;
    private _aimTimer?: Phaser.Time.TimerEvent;

    private _shootTimer!: Phaser.Time.TimerEvent;
    private _hitFlashTimer?: Phaser.Time.TimerEvent;
    private _isHitFlashing: boolean = false;
    private _lastSmokeMs: number = 0;

    // Special modes: Tutorial dummy & Bounty target
    public isDummy: boolean = false;
    public isBounty: boolean = false;
    private _bountyRing?: GameObjects.Arc;
    private _bountyLabel?: GameObjects.Text;

    public get archetype(): EnemyArchetypeData {
        return this._archetype;
    }

    public get baseTint(): number {
        return this._baseTint;
    }

    public get isAegis(): boolean {
        return Boolean(this._archetype?.protectsAllies);
    }

    public init(bulletsGroup: Phaser.Physics.Arcade.Group, player: Player): void {
        this._targetPlayer = player;
        this.setDepth(16);

        const defaultBullet: BulletData = {
            width: 12,
            height: 12,
            color: 0xf25f5c,
            speed: 500,
            damage: 1,
        };

        this.addComponent(new Health(1, this));
        this.addComponent(new Weapon(bulletsGroup, defaultBullet));

        this._shootTimer = this.scene.time.addEvent({
            delay: 2000,
            callback: this.onShootTick,
            callbackScope: this,
            loop: true,
            paused: true,
        });

        this._aimLine = this.scene.add.line(0, 0, 0, 0, 0, 100, 0xff4d6d, 0.75)
            .setOrigin(0, 0)
            .setLineWidth(3)
            .setDepth(14)
            .setVisible(false);

        if (!this.scene.anims.exists(GameConstants.AnimKeys.UFO_SHOOT)) {
            this.scene.anims.create({
                key: GameConstants.AnimKeys.UFO_SHOOT,
                frames: [
                    {key: GameConstants.TextureKeys.SPRITES, frame: GameConstants.SpriteFrames.ENEMY_UFO},
                    {key: GameConstants.TextureKeys.SPRITES, frame: GameConstants.SpriteFrames.ENEMY_UFO_SHOOT_0},
                    {key: GameConstants.TextureKeys.SPRITES, frame: GameConstants.SpriteFrames.ENEMY_UFO_SHOOT_1},
                ],
                frameRate: ArcadeEnemy.SHOOT_ANIM_FRAME_RATE,
            });
        }

        this.arcadeBody.setCircle(this.width / 2);
    }

    public enableWithArchetype(
        x: number,
        y: number,
        archetype: EnemyArchetypeData,
        hpScale: number = 1,
        difficulty?: DifficultyConfig
    ): void {
        this._archetype = archetype;
        this._difficulty = difficulty;
        this._baseTint = parseHexColor(archetype.tint, 0xffffff);
        const speedMult = difficulty?.enemyBulletSpeedMult ?? 1;
        this._bulletData = archetype.bullet
            ? {
                width: archetype.bullet.width,
                height: archetype.bullet.height,
                color: parseHexColor(archetype.bullet.color, 0xf25f5c),
                speed: Math.round(archetype.bullet.speed * speedMult),
                damage: archetype.bullet.damage,
            }
            : undefined;

        const camWidth = this.scene.cameras.main.width;
        let spawnX = x;
        let spawnY = y - this.displayHeight;

        if (archetype.movementKind === 'sinusoidal') {
            const amp = archetype.amplitude ?? 150;
            const margin = Math.min(this.displayWidth / 2 + amp, camWidth / 2);
            spawnX = Phaser.Math.Clamp(x, margin, camWidth - margin);
        } else if (archetype.movementKind === 'cargo') {
            this._cargoDir = Math.random() < 0.5 ? 1 : -1;
            spawnX = this._cargoDir === 1 ? -60 : camWidth + 60;
            spawnY = Phaser.Math.Between(180, 420);
        }

        this._originX = spawnX;
        this._elapsedMs = 0;
        this._lastSmokeMs = 0;
        this.isDummy = false;
        this.isBounty = false;
        this.clearBountyVisuals();
        this._kamikazeLocked = false;
        this._kamikazeVx = 0;
        this._kamikazeVy = archetype.speed;
        this._spiralAngleRad = Math.PI / 2;

        this.enableBody(true, spawnX, spawnY, true, true);
        this.setTexture(GameConstants.TextureKeys.SPRITES, GameConstants.SpriteFrames.ENEMY_UFO);
        this.setScale(archetype.scale);
        this.angle = ArcadeEnemy.FACING_DOWN_ANGLE_DEG;

        if (this._baseTint === 0xffffff) {
            this.clearTint();
        } else {
            this.setTint(this._baseTint);
        }

        this._hitFlashTimer?.remove(false);
        this._aimTimer?.remove(false);
        this._aimLine?.setVisible(false);
        this._isHitFlashing = false;

        // Replace Health component with scaled HP for this archetype
        const existingHealth = this.getComponent(Health);
        if (existingHealth) {
            this.removeComponent(existingHealth);
        }
        const scaledHp = Math.max(1, Math.round(archetype.health * hpScale));
        const health = new Health(scaledHp, this);
        this.addComponent(health);

        health.on(Health.CHANGE_EVENT, () => {
            this._isHitFlashing = true;
            this.setTintFill(GameConstants.Colors.HIT_FLASH);
            this._hitFlashTimer?.remove(false);
            this._hitFlashTimer = this.scene.time.delayedCall(ArcadeEnemy.HIT_FLASH_DURATION_MS, () => {
                this._isHitFlashing = false;
                if (this.active) {
                    if (this._baseTint === 0xffffff) {
                        this.clearTint();
                    } else {
                        this.setTint(this._baseTint);
                    }
                }
            });
        });

        if (archetype.attackKind !== 'none' && this._bulletData) {
            const fireRateMult = difficulty?.enemyFireRateMult ?? 1;
            const minDelay = Math.max(260, Math.round(archetype.shootDelayMin * fireRateMult));
            const maxDelay = Math.max(minDelay + 120, Math.round(archetype.shootDelayMax * fireRateMult));
            this._shootTimer.reset({
                delay: Phaser.Math.Between(minDelay, maxDelay),
                callback: this.onShootTick,
                callbackScope: this,
                loop: true,
                paused: false,
            });
        } else {
            this._shootTimer.paused = true;
        }
    }

    public setAsTutorialDummy(x: number, y: number, archetype: EnemyArchetypeData): void {
        this.enableWithArchetype(x, y + this.displayHeight, archetype, 1);
        this.setPosition(x, y);
        this.isDummy = true;
        this._shootTimer.paused = true;
        const h = this.getComponent(Health);
        if (h) {
            this.removeComponent(h);
        }
        this.addComponent(new Health(3, this));
        this.setBountyVisual('CIBLE', 0x4cc9f0);
    }

    public markAsBounty(): void {
        this.isBounty = true;
        this.setBountyVisual('BOUNTY +2000', 0xffd166);
    }

    private setBountyVisual(label: string, color: number): void {
        this.clearBountyVisuals();
        this._bountyRing = this.scene.add.circle(this.x, this.y, 64, color, 0.1)
            .setStrokeStyle(4, color, 0.95)
            .setDepth(26);
        this._bountyLabel = this.scene.add.text(this.x, this.y - 76, label, {
            fontFamily: 'future',
            fontSize: '20px',
            color: `#${color.toString(16).padStart(6, '0')}`,
            stroke: '#000000',
            strokeThickness: 5,
        }).setOrigin(0.5).setDepth(27);
    }

    public clearBountyVisuals(): void {
        this._bountyRing?.destroy();
        this._bountyRing = undefined;
        this._bountyLabel?.destroy();
        this._bountyLabel = undefined;
    }

    public disable(): void {
        this.stop();
        this.removeAllListeners(Phaser.Animations.Events.ANIMATION_COMPLETE);
        this._hitFlashTimer?.remove(false);
        this._aimTimer?.remove(false);
        this._aimLine?.setVisible(false);
        this.clearBountyVisuals();
        this.isDummy = false;
        this.isBounty = false;
        this._isHitFlashing = false;
        this.disableBody(true, true);
        this._shootTimer.paused = true;
    }

    private onShootTick(): void {
        if (!this.active || !this._archetype || !this._bulletData) return;

        const weapon = this.getComponent(Weapon);
        if (!weapon) return;

        const isNightmare = this._difficulty?.id === 'cauchemar';
        const extraBullets = this._difficulty?.extraSpreadBullets ?? 0;

        if (this._archetype.attackKind === 'mine') {
            this.dropFloatingMine(weapon);
            return;
        }

        if (this._archetype.attackKind === 'spiral') {
            const arms = isNightmare ? 4 : 2;
            for (let arm = 0; arm < arms; arm++) {
                weapon.shootAtAngle(this.x, this.y, this.arcadeBody.radius, this._spiralAngleRad + (arm * Math.PI * 2) / arms, this._bulletData);
            }
            this._spiralAngleRad += Phaser.Math.DegToRad(24);
            return;
        }

        if (this._archetype.attackKind === 'aimed' && this._targetPlayer?.active) {
            const aimAngle = Phaser.Math.Angle.Between(this.x, this.y, this._targetPlayer.x, this._targetPlayer.y);
            this.showAimTelegraph(aimAngle, () => {
                if (!this.active || !this._bulletData) return;
                if (isNightmare) {
                    weapon.shootCustomSpread(this.x, this.y, this.arcadeBody.radius, aimAngle, 3, 18, this._bulletData);
                } else {
                    weapon.shootAtAngle(this.x, this.y, this.arcadeBody.radius, aimAngle, this._bulletData);
                }
                this.scene.sound.play(GameConstants.SoundKeys.ENEMY_LASER, {volume: 0.45});
            });
            return;
        }

        this.play(GameConstants.AnimKeys.UFO_SHOOT);
        this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            if (!this.active || !this._bulletData) return;

            this.setTexture(GameConstants.TextureKeys.SPRITES, GameConstants.SpriteFrames.ENEMY_UFO);
            if (!this._isHitFlashing) {
                if (this._baseTint === 0xffffff) {
                    this.clearTint();
                } else {
                    this.setTint(this._baseTint);
                }
            }

            if (this._archetype.attackKind === 'spread' && this._archetype.spreadShot) {
                const bulletCount = this._archetype.spreadShot.bulletCount + Math.floor(extraBullets / 2);
                const spreadAngle = Math.min(140, this._archetype.spreadShot.spreadAngle + extraBullets * 4);
                weapon.shootCustomSpread(
                    this.x,
                    this.y,
                    this.arcadeBody.radius,
                    Phaser.Math.DegToRad(ArcadeEnemy.FACING_DOWN_ANGLE_DEG),
                    bulletCount,
                    spreadAngle,
                    this._bulletData
                );
            } else if (isNightmare) {
                weapon.shootCustomSpread(
                    this.x,
                    this.y,
                    this.arcadeBody.radius,
                    Phaser.Math.DegToRad(ArcadeEnemy.FACING_DOWN_ANGLE_DEG),
                    3,
                    26,
                    this._bulletData
                );
            } else {
                weapon.shootAtAngle(
                    this.x,
                    this.y,
                    this.arcadeBody.radius,
                    Phaser.Math.DegToRad(ArcadeEnemy.FACING_DOWN_ANGLE_DEG),
                    this._bulletData
                );
            }
            this.scene.sound.play(GameConstants.SoundKeys.ENEMY_LASER, {volume: 0.4});
        });
    }

    private dropFloatingMine(weapon: Weapon): void {
        if (!this._bulletData) return;

        const mx = this.x;
        const my = this.y;
        const mineBullet = this._bulletData;

        const mine = this.scene.add.circle(mx, my, 16, 0xffb703, 0.9)
            .setStrokeStyle(4, 0xffffff, 0.95)
            .setDepth(25);

        this.scene.tweens.add({
            targets: mine,
            scale: 1.45,
            alpha: 0.35,
            duration: 180,
            yoyo: true,
            repeat: 4,
            onComplete: () => {
                mine.destroy();
                if (!this.scene || !this.scene.sys.isActive()) return;
                const vfx = (this.scene as unknown as {vfxManager?: VfxManager}).vfxManager;
                vfx?.spawnExplosion(mx, my, 0xffb703, 0.85);
                weapon.shootCustomSpread(mx, my, 8, 0, 8, 360, mineBullet);
            },
        });
    }

    private showAimTelegraph(angleRad: number, onFire: () => void): void {
        if (!this._aimLine) {
            onFire();
            return;
        }

        const length = 1400;
        this._aimLine.setPosition(this.x, this.y)
            .setTo(0, 0, Math.cos(angleRad) * length, Math.sin(angleRad) * length)
            .setVisible(true);

        this._aimTimer?.remove(false);
        this._aimTimer = this.scene.time.delayedCall(550, () => {
            this._aimLine?.setVisible(false);
            onFire();
        });
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number): void {
        super.preUpdate(timeSinceLaunch, deltaTime);

        if (!this.active || !this._archetype || this.scene.time.paused) {
            return;
        }

        if (this._bountyRing) {
            this._bountyRing.setPosition(this.x, this.y).setScale(1 + Math.sin(timeSinceLaunch * 0.012) * 0.12);
            this._bountyLabel?.setPosition(this.x, this.y - 76);
        }

        if (this.isDummy) {
            return;
        }

        // Low-HP damage sparks on heavy enemies (< 40% HP)
        const health = this.getComponent(Health);
        if (health && health.max >= 4 && health.current > 0 && health.current <= health.max * 0.4 && timeSinceLaunch - this._lastSmokeMs > 220) {
            this._lastSmokeMs = timeSinceLaunch;
            const vfx = (this.scene as unknown as {vfxManager?: VfxManager}).vfxManager;
            vfx?.spawnHitSpark(this.x + Phaser.Math.Between(-24, 24), this.y + Phaser.Math.Between(-24, 24), 0xff9f1c);
        }

        const cam = this.scene.cameras.main;
        const dt = this._isHitFlashing ? deltaTime * ArcadeEnemy.HIT_SLOWDOWN_FACTOR : deltaTime;
        this._elapsedMs += dt;

        switch (this._archetype.movementKind) {
            case 'linear':
                this.y += this._archetype.speed * dt;
                break;

            case 'minelayer':
                this.x = Phaser.Math.Clamp(this._originX + Math.sin(this._elapsedMs * 0.0022) * 190, 70, cam.width - 70);
                this.y += this._archetype.speed * dt;
                break;

            case 'sinusoidal': {
                const amp = this._archetype.amplitude ?? 160;
                const freq = this._archetype.frequency ?? 0.5;
                const phase = Math.PI * 2 * freq * (this._elapsedMs / 1000);
                this.x = this._originX + amp * Math.sin(phase);
                this.y += this._archetype.speed * dt;
                break;
            }

            case 'kamikaze': {
                if (!this._kamikazeLocked && this.y > 220 && this._targetPlayer?.active) {
                    this._kamikazeLocked = true;
                    const angle = Phaser.Math.Angle.Between(this.x, this.y, this._targetPlayer.x, this._targetPlayer.y);
                    const diveSpeed = this._archetype.speed * 1.45;
                    this._kamikazeVx = Math.cos(angle) * diveSpeed;
                    this._kamikazeVy = Math.max(0.28, Math.sin(angle) * diveSpeed);
                }
                this.x += this._kamikazeVx * dt;
                this.y += this._kamikazeVy * dt;
                this.angle += 0.35 * dt;
                break;
            }

            case 'sniper': {
                const targetY = this._archetype.stopY ?? 340;
                if (this.y < targetY) {
                    this.y += this._archetype.speed * dt;
                } else {
                    // Gentle hover + leave screen after 10s so waves never stall
                    this.x = this._originX + Math.sin(this._elapsedMs * 0.0025) * 45;
                    if (this._elapsedMs > 10000) {
                        this.y += this._archetype.speed * 1.2 * dt;
                    }
                }
                break;
            }

            case 'orbital':
                this.y += this._archetype.speed * dt;
                this.angle += 0.22 * dt;
                break;

            case 'cargo':
                this.x += this._cargoDir * this._archetype.speed * dt;
                this.y += Math.sin(this._elapsedMs * 0.005) * 0.08 * dt;
                if (this.x < -140 || this.x > cam.width + 140) {
                    this.disable();
                    return;
                }
                break;
        }

        if (this.y > cam.height + this.displayHeight + 40) {
            this.disable();
        }
    }
}
