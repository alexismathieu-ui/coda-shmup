import {GameObjects} from "phaser";
import Health from "../components/Health.ts";
import Weapon from "../components/Weapon.ts";
import GameConstants from "../GameConstants.ts";
import type {BossData, BossPhaseData} from "../gameData/BossData.ts";
import type {BulletData} from "../gameData/BulletData.ts";
import type {DifficultyConfig} from "../gameData/DifficultyData.ts";
import {parseHexColor} from "../gameData/SinusoidalEnemyData.ts";
import SoundManager from "../managers/SoundManager.ts";
import VfxManager from "../managers/VfxManager.ts";
import Entity from "./Entity.ts";
import Player from "./Player.ts";

export default class Boss extends Entity {
    private static readonly REST_Y: number = 270;
    private static readonly ENTRY_SPEED: number = 0.28;
    private static readonly HIT_FLASH_MS: number = 45;
    private static readonly LASER_WIDTH: number = 150;

    private _bossData!: BossData;
    private _difficulty?: DifficultyConfig;
    private _bulletData!: BulletData;
    private _baseTint: number = 0x4cc9f0;
    private _enragedTint: number = 0xff4d6d;
    private _phase3Tint: number = 0xff1e42;
    private _targetPlayer?: Player;
    private _onSummonMinions?: () => void;

    private _isEntering: boolean = true;
    private _phaseNumber: 1 | 2 | 3 = 1;
    private _isDying: boolean = false;
    private _moveDir: number = 1;
    private _elapsedMs: number = 0;
    private _patternIndex: number = 0;
    private _spiralAngle: number = 0;
    private _lastTeleportMs: number = 0;
    private _lastDamageSparkMs: number = 0;

    private _auraRing?: GameObjects.Arc;
    private _attackTimer?: Phaser.Time.TimerEvent;
    private _hitFlashTimer?: Phaser.Time.TimerEvent;
    private _laserTimers: Phaser.Time.TimerEvent[] = [];
    private _laserVisuals: GameObjects.GameObject[] = [];

    public get bossData(): BossData {
        return this._bossData;
    }

    public get currentTint(): number {
        if (this._phaseNumber === 3) return this._phase3Tint;
        if (this._phaseNumber === 2) return this._enragedTint;
        return this._baseTint;
    }

    public get isVulnerable(): boolean {
        return this.active && !this._isEntering && !this._isDying;
    }

    public initBoss(
        bulletsGroup: Phaser.Physics.Arcade.Group,
        player: Player,
        data: BossData,
        hpMultiplier: number = 1,
        difficulty?: DifficultyConfig,
        onSummonMinions?: () => void
    ): void {
        this._bossData = data;
        this._difficulty = difficulty;
        this._targetPlayer = player;
        this._onSummonMinions = onSummonMinions;
        this._baseTint = parseHexColor(data.tint, 0x4cc9f0);
        this._enragedTint = parseHexColor(data.enragedTint, 0xff4d6d);
        this._phase3Tint = parseHexColor(data.phase3Tint ?? data.enragedTint, 0xff1e42);

        const speedMult = difficulty?.enemyBulletSpeedMult ?? 1;
        this._bulletData = {
            width: data.bullet.width,
            height: data.bullet.height,
            color: parseHexColor(data.bullet.color, 0xff3b5c),
            speed: Math.round(data.bullet.speed * speedMult),
            damage: data.bullet.damage,
        };

        const totalHp = Math.round(data.health * hpMultiplier * (difficulty?.bossHpMult ?? 1));
        const health = new Health(totalHp, this);
        this.addComponent(health);
        this.addComponent(new Weapon(bulletsGroup, this._bulletData));

        this.setTexture(GameConstants.TextureKeys.SPRITES, GameConstants.SpriteFrames.ENEMY_UFO);
        this.setScale(data.scale);
        this.setTint(this._baseTint);
        this.setDepth(22);
        this.angle = 90;
        this.arcadeBody.setCircle(this.width * 0.45);

        if (data.isFinalBoss) {
            this._auraRing = this.scene.add.circle(this.x, this.y, 165, this._baseTint, 0.08)
                .setStrokeStyle(6, this._baseTint, 0.7)
                .setDepth(21);
        }

        this._isEntering = true;
        this._phaseNumber = 1;
        this._isDying = false;
        this._moveDir = 1;
        this._elapsedMs = 0;
        this._patternIndex = 0;
        this._lastTeleportMs = 0;

        health.on(Health.CHANGE_EVENT, (current: number) => {
            this.scene.game.events.emit(GameConstants.Events.BOSS_HEALTH_CHANGED, {
                name: this._bossData.name,
                current,
                max: health.max,
                phase2: this._phaseNumber >= 2,
            });

            this.setTintFill(GameConstants.Colors.HIT_FLASH);
            this._hitFlashTimer?.remove(false);
            this._hitFlashTimer = this.scene.time.delayedCall(Boss.HIT_FLASH_MS, () => {
                if (this.active && !this._isDying) {
                    this.setTint(this.currentTint);
                }
            });

            const hasPhase3 = Boolean(this._bossData.phase3);
            const p2Threshold = hasPhase3 ? 0.66 : 0.5;
            if (this._phaseNumber === 1 && current > 0 && current <= health.max * p2Threshold) {
                this.enterPhase2();
            } else if (hasPhase3 && this._phaseNumber === 2 && current > 0 && current <= health.max * 0.33) {
                this.enterPhase3();
            }
        });

        this.scene.game.events.emit(GameConstants.Events.BOSS_SPAWNED_EVENT, {
            name: this._bossData.name,
            subtitle: this._bossData.subtitle,
            current: totalHp,
            max: totalHp,
        });
    }

    public markDying(): void {
        this._isDying = true;
        this._attackTimer?.remove(false);
        this.cleanupLasers();
        this._auraRing?.destroy();
        this.disableBody(true, false);
    }

    private enterPhase2(): void {
        this._phaseNumber = 2;
        this.setTint(this._enragedTint);
        this._auraRing?.setStrokeStyle(7, this._enragedTint, 0.85);
        this._bulletData = {
            ...this._bulletData,
            color: this._enragedTint,
            speed: Math.round(this._bulletData.speed * 1.12),
        };

        this.scene.cameras.main.shake(320, 0.016);
        this.scene.game.events.emit(GameConstants.Events.BANNER_EVENT, {
            title: 'PHASE 2 — ENRAGED!',
            subtitle: this._bossData.name,
            color: '#ff4d6d',
        });

        const sound = (this.scene as unknown as {soundManager?: SoundManager}).soundManager;
        sound?.playWarning();
        this.restartAttackTimer();
    }

    private enterPhase3(): void {
        this._phaseNumber = 3;
        this.setTint(this._phase3Tint);
        this._auraRing?.setStrokeStyle(9, this._phase3Tint, 1);
        this._bulletData = {
            ...this._bulletData,
            color: this._phase3Tint,
            speed: Math.round(this._bulletData.speed * 1.14),
        };

        this.scene.cameras.main.shake(480, 0.022);
        this.scene.cameras.main.flash(260, 255, 30, 66, true);
        this.scene.game.events.emit(GameConstants.Events.BANNER_EVENT, {
            title: 'FINAL PHASE — APOCALYPSE!',
            subtitle: `${this._bossData.name} · RENFORTS INCOMING`,
            color: '#ff1e42',
        });

        const sound = (this.scene as unknown as {soundManager?: SoundManager}).soundManager;
        sound?.playWarning();
        this._onSummonMinions?.();
        this.restartAttackTimer();
    }

    private getActivePhase(): BossPhaseData {
        if (this._phaseNumber === 3 && this._bossData.phase3) {
            return this._bossData.phase3;
        }
        return this._phaseNumber >= 2 ? this._bossData.phase2 : this._bossData.phase1;
    }

    private restartAttackTimer(): void {
        this._attackTimer?.remove(false);
        const phase = this.getActivePhase();
        const fireMult = this._difficulty?.enemyFireRateMult ?? 1;
        this._attackTimer = this.scene.time.addEvent({
            delay: Math.max(290, Math.round(phase.fireIntervalMs * fireMult)),
            callback: this.fireNextPattern,
            callbackScope: this,
            loop: true,
        });
    }

    private fireNextPattern(): void {
        if (!this.active || this._isEntering || this._isDying) return;

        const weapon = this.getComponent(Weapon);
        if (!weapon) return;

        const phase = this.getActivePhase();
        const extra = this._difficulty?.extraSpreadBullets ?? 0;
        const pattern = phase.patterns[this._patternIndex % phase.patterns.length];
        this._patternIndex++;

        const radius = this.arcadeBody.radius;
        const downRad = Phaser.Math.DegToRad(90);

        switch (pattern) {
            case 'spread':
                weapon.shootCustomSpread(this.x, this.y, radius, downRad, phase.spreadCount + Math.floor(extra / 2), Math.min(155, phase.spreadAngle + extra * 3), this._bulletData);
                break;

            case 'ring':
                weapon.shootCustomSpread(this.x, this.y, radius, this._spiralAngle, phase.ringCount + extra, 360, this._bulletData);
                this._spiralAngle += Phaser.Math.DegToRad(15);
                break;

            case 'crossRing': {
                const count = phase.ringCount + extra;
                weapon.shootCustomSpread(this.x, this.y, radius, this._spiralAngle, count, 360, this._bulletData);
                this._spiralAngle += Phaser.Math.DegToRad(180 / Math.max(1, count));
                this.scene.time.delayedCall(220, () => {
                    if (!this.active || this._isDying) return;
                    weapon.shootCustomSpread(this.x, this.y, radius, this._spiralAngle, count, 360, this._bulletData);
                });
                break;
            }

            case 'spiral': {
                const arms = this._difficulty?.id === 'cauchemar' ? 6 : 4;
                for (let arm = 0; arm < arms; arm++) {
                    weapon.shootAtAngle(this.x, this.y, radius, this._spiralAngle + (arm * Math.PI * 2) / arms, this._bulletData);
                }
                this._spiralAngle += Phaser.Math.DegToRad(20);
                break;
            }

            case 'aimedBurst': {
                const aim = this._targetPlayer?.active
                    ? Phaser.Math.Angle.Between(this.x, this.y, this._targetPlayer.x, this._targetPlayer.y)
                    : downRad;
                const count = this._difficulty?.id === 'cauchemar' ? 5 : 3;
                weapon.shootCustomSpread(this.x, this.y, radius, aim, count, 28, this._bulletData);
                break;
            }

            case 'laserSweep':
                this.fireTelegraphedLaser();
                return;
        }

        this.scene.sound.play(GameConstants.SoundKeys.ENEMY_LASER, {volume: 0.42});
    }

    private fireTelegraphedLaser(): void {
        const camH = this.scene.cameras.main.height;
        const beamX = this._targetPlayer?.active
            ? Phaser.Math.Clamp(this._targetPlayer.x, 120, this.scene.cameras.main.width - 120)
            : this.x;
        const beamTop = this.y + 40;
        const beamH = camH - beamTop;

        const sound = (this.scene as unknown as {soundManager?: SoundManager}).soundManager;
        sound?.playWarning();

        const telegraph = this.scene.add.rectangle(beamX, beamTop + beamH / 2, Boss.LASER_WIDTH, beamH, 0xff1e42, 0.22)
            .setStrokeStyle(4, 0xff1e42, 0.9)
            .setDepth(28);
        this._laserVisuals.push(telegraph);

        this.scene.tweens.add({
            targets: telegraph,
            alpha: 0.55,
            duration: 150,
            yoyo: true,
            repeat: 3,
        });

        const fireTimer = this.scene.time.delayedCall(920, () => {
            telegraph.destroy();
            if (!this.active || this._isDying) return;

            const beam = this.scene.add.rectangle(beamX, beamTop + beamH / 2, Boss.LASER_WIDTH, beamH, 0xffffff, 0.95)
                .setStrokeStyle(14, this.currentTint, 0.95)
                .setDepth(38);
            this._laserVisuals.push(beam);

            this.scene.cameras.main.shake(320, 0.015);
            sound?.playEmp();

            // Check player hit while beam is active
            const checkHit = () => {
                if (this._targetPlayer?.active && Math.abs(this._targetPlayer.x - beamX) < Boss.LASER_WIDTH * 0.48 && this._targetPlayer.y > beamTop) {
                    this._targetPlayer.takeHit(1);
                }
            };
            checkHit();
            const tick1 = this.scene.time.delayedCall(140, checkHit);
            const tick2 = this.scene.time.delayedCall(280, checkHit);
            this._laserTimers.push(tick1, tick2);

            this.scene.tweens.add({
                targets: beam,
                scaleX: 0.05,
                alpha: 0,
                delay: 340,
                duration: 240,
                onComplete: () => beam.destroy(),
            });
        });
        this._laserTimers.push(fireTimer);
    }

    private cleanupLasers(): void {
        for (const t of this._laserTimers) {
            t.remove(false);
        }
        this._laserTimers = [];
        for (const v of this._laserVisuals) {
            if (v && v.scene) {
                v.destroy();
            }
        }
        this._laserVisuals = [];
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number): void {
        super.preUpdate(timeSinceLaunch, deltaTime);

        if (!this.active || this._isDying || this.scene.time.paused) return;

        if (this._isEntering) {
            this.y += Boss.ENTRY_SPEED * deltaTime;
            this._auraRing?.setPosition(this.x, this.y);
            if (this.y >= Boss.REST_Y) {
                this.y = Boss.REST_Y;
                this._isEntering = false;
                this.restartAttackTimer();
            }
            return;
        }

        const phase = this.getActivePhase();
        this._elapsedMs += deltaTime;

        const cam = this.scene.cameras.main;
        const margin = this.displayWidth * 0.55;

        // Teleport mechanic for Phantom Architect & Omega Emperor
        if (this._bossData.teleports && this._elapsedMs - this._lastTeleportMs > (this._phaseNumber >= 2 ? 4200 : 6200)) {
            this._lastTeleportMs = this._elapsedMs;
            const vfx = (this.scene as unknown as {vfxManager?: VfxManager}).vfxManager;
            vfx?.spawnHitSpark(this.x, this.y, this.currentTint);
            this.x = Phaser.Math.Between(Math.round(margin), Math.round(cam.width - margin));
            vfx?.spawnExplosion(this.x, this.y, this.currentTint, 0.9);
        } else {
            this.x += this._moveDir * phase.moveSpeed * deltaTime;
            if (this.x <= margin) {
                this.x = margin;
                this._moveDir = 1;
            } else if (this.x >= cam.width - margin) {
                this.x = cam.width - margin;
                this._moveDir = -1;
            }
        }

        this.y = Boss.REST_Y + Math.sin(this._elapsedMs * 0.0026) * 60;

        if (this._auraRing) {
            this._auraRing.setPosition(this.x, this.y);
            this._auraRing.setScale(1 + Math.sin(timeSinceLaunch * 0.009) * 0.08);
        }

        // Visible damage sparks/smoke under 40% HP
        const health = this.getComponent(Health);
        if (health && health.current > 0 && health.current <= health.max * 0.4 && timeSinceLaunch - this._lastDamageSparkMs > 180) {
            this._lastDamageSparkMs = timeSinceLaunch;
            const vfx = (this.scene as unknown as {vfxManager?: VfxManager}).vfxManager;
            vfx?.spawnHitSpark(this.x + Phaser.Math.Between(-75, 75), this.y + Phaser.Math.Between(-50, 50), 0xff9f1c);
        }
    }

    destroy(fromScene?: boolean): void {
        this._attackTimer?.remove(false);
        this._hitFlashTimer?.remove(false);
        this.cleanupLasers();
        this._auraRing?.destroy();
        super.destroy(fromScene);
    }
}
