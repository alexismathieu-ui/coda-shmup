import {GameObjects, Input, Scene} from "phaser";
import Health from "../components/Health.ts";
import Movement from "../components/Movement.ts";
import Weapon from "../components/Weapon.ts";
import GameConstants from "../GameConstants.ts";
import type {BulletData} from "../gameData/BulletData.ts";
import {getDifficultyConfig} from "../gameData/DifficultyData.ts";
import type {PlayerShipData, PlayerShipsData} from "../gameData/PlayerShipsData.ts";
import type {RogueliteCardId} from "../gameData/RogueliteCardData.ts";
import type {RunModifierId} from "../gameData/RunModifiersData.ts";
import AchievementManager from "../managers/AchievementManager.ts";
import SoundManager from "../managers/SoundManager.ts";
import VfxManager from "../managers/VfxManager.ts";
import RegistryConstants from "../RegistryConstants.ts";
import Bullet from "./Bullet.ts";
import Entity from "./Entity.ts";

type ShipProfile = {
    maxHealth: number;
    fireRateSec: number;
    bulletDamage: number;
    bulletColor: number;
    bulletWidth: number;
    bulletHeight: number;
    startingWeaponLevel: number;
    dashCooldownMs: number;
    startingBombs: number;
};

const SHIP_PROFILES: Record<number, ShipProfile> = {
    1: {
        maxHealth: 3,
        fireRateSec: 0.21,
        bulletDamage: 1.0,
        bulletColor: 0xffe066,
        bulletWidth: 14,
        bulletHeight: 5,
        startingWeaponLevel: 1,
        dashCooldownMs: 1350,
        startingBombs: 1,
    },
    2: {
        maxHealth: 3,
        fireRateSec: 0.13,
        bulletDamage: 0.6,
        bulletColor: 0x4cc9f0,
        bulletWidth: 11,
        bulletHeight: 4,
        startingWeaponLevel: 2,
        dashCooldownMs: 950,
        startingBombs: 1,
    },
    3: {
        maxHealth: 4,
        fireRateSec: 0.32,
        bulletDamage: 2.5,
        bulletColor: 0xff9f1c,
        bulletWidth: 20,
        bulletHeight: 8,
        startingWeaponLevel: 1,
        dashCooldownMs: 1650,
        startingBombs: 2,
    },
};

export default class Player extends Entity {
    private static readonly BASE_ANGLE_DEG: number = -90;
    private static readonly MAX_BANK_ANGLE_DEG: number = 12;
    private static readonly MAX_WEAPON_LEVEL: number = 5;
    private static readonly MAX_DRONES: number = 2;
    private static readonly MAX_BOMBS: number = 3;
    private static readonly DASH_DURATION_MS: number = 200;
    private static readonly DASH_COOLDOWN_MS: number = 1400;
    private static readonly DASH_SPEED_MULT: number = 2.9;
    private static readonly INVINCIBLE_DURATION_MS: number = 950;
    private static readonly MIN_Y_RATIO: number = 0.22;

    private _bulletData: BulletData = {
        width: 14,
        height: 5,
        color: 0xffe066,
        speed: 1120,
        damage: 1,
    };

    private _cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
    private _wasdKeys!: {
        up: Input.Keyboard.Key;
        upAlt: Input.Keyboard.Key;
        down: Input.Keyboard.Key;
        left: Input.Keyboard.Key;
        leftAlt: Input.Keyboard.Key;
        right: Input.Keyboard.Key;
        emp: Input.Keyboard.Key;
        empAlt: Input.Keyboard.Key;
        overdrive: Input.Keyboard.Key;
    };

    private _playerShipData!: PlayerShipData;
    private _bulletsGroup!: Phaser.Physics.Arcade.Group;
    private _baseFireRateSec: number = 0.22;
    private _lastShotTime: number = 0;

    private _weaponLevel: number = 1;
    private _rapidFireUntil: number = 0;
    private _homingUntil: number = 0;
    private _beamUntil: number = 0;
    private _lastBeamTickMs: number = 0;
    private _beamRect?: GameObjects.Rectangle;
    private _onBeamTickCallback?: (x: number, y: number) => void;

    private _overdriveCharge: number = 0;
    private _overdriveUntil: number = 0;
    private _overdriveAura?: GameObjects.Arc;
    private _onOverdriveCallback?: (active: boolean) => void;

    private _thrusterFlame?: GameObjects.Triangle;
    private _glassCannon: boolean = false;
    private _turboSpeedMult: number = 1;
    private _godMode: boolean = false;

    private _onTutorialAction?: (action: 'move' | 'dash' | 'shoot' | 'emp') => void;

    private _eventFireMultiplier: number = 1;
    private _rogueliteFireMultiplier: number = 1;
    private _bonusDamage: number = 0;
    private _critChance: number = 0;
    private _hasDashNova: boolean = false;
    private _hasVampirism: boolean = false;
    private _shieldEachWave: boolean = false;
    private _onDashNovaCallback?: (x: number, y: number) => void;

    private _hasShield: boolean = false;
    private _shieldRing?: GameObjects.Arc;

    private _bombCount: number = 1;
    private _onEmpCallback?: () => void;

    private _drones: GameObjects.Image[] = [];
    private _droneOrbitAngle: number = 0;
    private _shotCounter: number = 0;

    private _isDashing: boolean = false;
    private _dashEndTime: number = 0;
    private _dashCooldownEnd: number = 0;
    private _dashCooldownMs: number = Player.DASH_COOLDOWN_MS;
    private _dashDirX: number = 0;
    private _dashDirY: number = 0;
    private _lastGhostTime: number = 0;

    private _invincibleUntil: number = 0;

    public get hasShield(): boolean {
        return this._hasShield;
    }

    public get weaponLevel(): number {
        return this._weaponLevel;
    }

    public get bombCount(): number {
        return this._bombCount;
    }

    public get isInvincible(): boolean {
        return this._godMode || this._isDashing || this.scene.time.now < this._invincibleUntil;
    }

    public get godMode(): boolean {
        return this._godMode;
    }

    public toggleGodMode(): boolean {
        this._godMode = !this._godMode;
        return this._godMode;
    }

    public setWeaponMax(): void {
        this._weaponLevel = Player.MAX_WEAPON_LEVEL;
        this.scene.game.events.emit(GameConstants.Events.PLAYER_WEAPON_LEVEL_CHANGED, this._weaponLevel);
    }

    public fullHeal(): void {
        const h = this.getComponent(Health);
        if (h) {
            h.heal(h.max, true);
        }
    }

    public fillOverdrive(): void {
        this._overdriveCharge = 100;
        this.scene.game.events.emit(GameConstants.Events.OVERDRIVE_CHANGED, {
            charge: 100,
            active: this.isOverdriveActive,
        });
    }

    public get hasVampirism(): boolean {
        return this._hasVampirism;
    }

    public get shieldEachWave(): boolean {
        return this._shieldEachWave;
    }

    public get critChance(): number {
        return this._critChance;
    }

    public get isOverdriveActive(): boolean {
        return this.scene.time.now < this._overdriveUntil;
    }

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, GameConstants.TextureKeys.SPRITES);
        this.setDepth(20);

        if (this.scene.input.keyboard) {
            this._cursorKeys = this.scene.input.keyboard.createCursorKeys();
            this._wasdKeys = {
                up: this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.W),
                upAlt: this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.Z),
                down: this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.S),
                left: this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.A),
                leftAlt: this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.Q),
                right: this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.D),
                emp: this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.E),
                empAlt: this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.X),
                overdrive: this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.F),
            };

            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.ONE).on('down', () => this.selectPlayerShip(1));
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.TWO).on('down', () => this.selectPlayerShip(2));
            this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes.THREE).on('down', () => this.selectPlayerShip(3));

            this._cursorKeys.shift.on('down', () => this.tryDash());
            this._wasdKeys.emp.on('down', () => this.tryUseEmp());
            this._wasdKeys.empAlt.on('down', () => this.tryUseEmp());
            this._wasdKeys.overdrive.on('down', () => this.tryActivateOverdrive());
        }
    }

    public init(
        bulletsGroup: Phaser.Physics.Arcade.Group,
        onEmp?: () => void,
        onDashNova?: (x: number, y: number) => void,
        onBeamTick?: (x: number, y: number) => void,
        onOverdrive?: (active: boolean) => void
    ): void {
        this._bulletsGroup = bulletsGroup;
        this._onEmpCallback = onEmp;
        this._onDashNovaCallback = onDashNova;
        this._onBeamTickCallback = onBeamTick;
        this._onOverdriveCallback = onOverdrive;

        const savedShip = Number(this.scene.registry.get(RegistryConstants.Keys.SELECTED_SHIP) ?? 1);
        const profile = SHIP_PROFILES[savedShip] ?? SHIP_PROFILES[1];
        const diff = getDifficultyConfig(this.scene.registry.get(RegistryConstants.Keys.SELECTED_DIFFICULTY));
        const modifiers = (this.scene.registry.get(RegistryConstants.Keys.RUN_MODIFIERS) as RunModifierId[] | undefined) ?? [];

        this._glassCannon = modifiers.includes('glass_cannon');
        this._turboSpeedMult = modifiers.includes('turbo') ? 1.35 : 1;

        const initialHp = this._glassCannon ? 1 : profile.maxHealth + diff.playerBonusHp;
        this.addComponent(new Health(initialHp, this));
        this.addComponent(new Movement());
        this.addComponent(new Weapon(bulletsGroup, this._bulletData));

        this.angle = Player.BASE_ANGLE_DEG;
        this.selectPlayerShip(savedShip, true);

        this._shieldRing = this.scene.add.circle(this.x, this.y, 64, 0x4895ef, 0.14)
            .setStrokeStyle(4, 0x4cc9f0, 0.9)
            .setDepth(22)
            .setVisible(false);

        this._overdriveAura = this.scene.add.circle(this.x, this.y, 74, 0xffd166, 0.16)
            .setStrokeStyle(5, 0xffd166, 0.95)
            .setDepth(21)
            .setVisible(false);

        this._thrusterFlame = this.scene.add.triangle(this.x, this.y + 44, 0, 26, 12, 0, 24, 26, 0x4cc9f0, 0.9)
            .setOrigin(0.5, 0)
            .setDepth(18);

        this._beamRect = this.scene.add.rectangle(this.x, this.y / 2, 34, this.y, 0xff4d6d, 0.85)
            .setStrokeStyle(8, 0xffffff, 0.95)
            .setDepth(34)
            .setVisible(false);

        this.emitHudState();
    }

    public setTutorialActionCallback(cb?: (action: 'move' | 'dash' | 'shoot' | 'emp') => void): void {
        this._onTutorialAction = cb;
    }

    public selectPlayerShip(playerShipDataId: number, applyStartingLevel: boolean = false): void {
        const playerShipsData = this.scene.cache.json.get(GameConstants.CacheKeys.PLAYER_SHIPS) as PlayerShipsData;
        if (!playerShipsData || !playerShipsData[playerShipDataId]) {
            return;
        }

        this._playerShipData = playerShipsData[playerShipDataId];
        this.scene.registry.set(RegistryConstants.Keys.SELECTED_SHIP, playerShipDataId);

        const profile = SHIP_PROFILES[playerShipDataId] ?? SHIP_PROFILES[1];
        this._baseFireRateSec = profile.fireRateSec;
        this._dashCooldownMs = profile.dashCooldownMs;
        this._bulletData = {
            width: profile.bulletWidth,
            height: profile.bulletHeight,
            color: profile.bulletColor,
            speed: 1120,
            damage: profile.bulletDamage,
        };
        if (applyStartingLevel) {
            this._weaponLevel = profile.startingWeaponLevel;
            this._bombCount = profile.startingBombs;
        }

        this.setTexture(GameConstants.TextureKeys.SPRITES, this._playerShipData.texture);
        const bodyData = this._playerShipData.body;
        this.arcadeBody.setCircle(bodyData.radius, bodyData.offsetX, bodyData.offsetY);
        this.getComponent(Movement)?.setSpeed(this._playerShipData.movementSpeed);
    }

    public takeHit(damage: number): boolean {
        if (!this.active || this.isInvincible) {
            return false;
        }

        const vfx = (this.scene as unknown as {vfxManager?: VfxManager}).vfxManager;
        const sound = (this.scene as unknown as {soundManager?: SoundManager}).soundManager;

        if (this._hasShield) {
            this.setShield(false);
            this._invincibleUntil = this.scene.time.now + 700;
            vfx?.spawnExplosion(this.x, this.y, 0x4cc9f0, 1.1);
            vfx?.spawnFloatingText(this.x, this.y - 50, 'SHIELD BLOCK!', '#4cc9f0', 30);
            sound?.playShieldBreak();
            this.scene.cameras.main.shake(110, 0.012);
            return false;
        }

        this._invincibleUntil = this.scene.time.now + Player.INVINCIBLE_DURATION_MS;
        this.getComponent(Health)?.damage(damage);

        // Classic arcade shmup penalty: losing 1 weapon level on hit keeps the challenge tense
        if (this._weaponLevel > 1) {
            this._weaponLevel--;
            this.scene.game.events.emit(GameConstants.Events.PLAYER_WEAPON_LEVEL_CHANGED, this._weaponLevel);
            vfx?.spawnFloatingText(this.x, this.y - 54, 'WEAPON DOWN', '#ff9f1c', 26);
        }

        vfx?.spawnHitSpark(this.x, this.y, 0xff4d6d);
        sound?.playHit();
        return true;
    }

    public upgradeWeapon(): boolean {
        if (this._weaponLevel >= Player.MAX_WEAPON_LEVEL) {
            return false;
        }
        this._weaponLevel++;
        this.scene.game.events.emit(GameConstants.Events.PLAYER_WEAPON_LEVEL_CHANGED, this._weaponLevel);
        return true;
    }

    public activateRapidFire(durationMs: number = 5500): void {
        this._rapidFireUntil = Math.max(this._rapidFireUntil, this.scene.time.now) + durationMs;
    }

    public activateHoming(durationMs: number = 5000): void {
        this._homingUntil = Math.max(this._homingUntil, this.scene.time.now) + durationMs;
    }

    public activateLaserBeam(durationMs: number = 4000): void {
        this._beamUntil = Math.max(this._beamUntil, this.scene.time.now) + durationMs;
    }

    public addOverdriveCharge(amount: number): void {
        if (this.isOverdriveActive) return;
        this._overdriveCharge = Phaser.Math.Clamp(this._overdriveCharge + amount, 0, 100);
        this.scene.game.events.emit(GameConstants.Events.OVERDRIVE_CHANGED, {
            charge: this._overdriveCharge,
            active: false,
        });
    }

    private tryActivateOverdrive(): void {
        if (!this.active || this.scene.time.paused || this.scene.scene.isPaused() || this._overdriveCharge < 100 || this.isOverdriveActive) {
            return;
        }

        this._overdriveCharge = 0;
        this._overdriveUntil = this.scene.time.now + 6000;
        this._overdriveAura?.setVisible(true);
        this._onOverdriveCallback?.(true);
        AchievementManager.unlock(this.scene, 'overdrive_hero');

        const vfx = (this.scene as unknown as {vfxManager?: VfxManager}).vfxManager;
        const sound = (this.scene as unknown as {soundManager?: SoundManager}).soundManager;
        vfx?.spawnFloatingText(this.x, this.y - 75, 'HYPER OVERDRIVE!', '#ffd166', 40);
        this.scene.cameras.main.flash(200, 255, 209, 102, true);
        sound?.playPowerUp();

        this.scene.game.events.emit(GameConstants.Events.OVERDRIVE_CHANGED, {
            charge: 100,
            active: true,
        });

        this.scene.time.delayedCall(6000, () => {
            this._overdriveAura?.setVisible(false);
            this._onOverdriveCallback?.(false);
            this.scene.game.events.emit(GameConstants.Events.OVERDRIVE_CHANGED, {
                charge: 0,
                active: false,
            });
        });
    }

    public setEventFireMultiplier(multiplier: number): void {
        this._eventFireMultiplier = multiplier;
    }

    public setShield(active: boolean): void {
        this._hasShield = active;
        this._shieldRing?.setVisible(active);
        this.scene.game.events.emit(GameConstants.Events.PLAYER_SHIELD_CHANGED, active);
    }

    public addBomb(amount: number = 1): boolean {
        if (this._bombCount >= Player.MAX_BOMBS) {
            return false;
        }
        this._bombCount = Math.min(Player.MAX_BOMBS, this._bombCount + amount);
        this.scene.game.events.emit(GameConstants.Events.PLAYER_BOMB_CHANGED, this._bombCount);
        return true;
    }

    public addDrone(): boolean {
        if (this._drones.length >= Player.MAX_DRONES) {
            return false;
        }
        const drone = this.scene.add.image(this.x, this.y, GameConstants.TextureKeys.SPRITES, GameConstants.SpriteFrames.PLAYER_LIFE)
            .setScale(1.1)
            .setTint(0xff9f1c)
            .setDepth(19);
        this._drones.push(drone);
        return true;
    }

    public healOne(): boolean {
        const health = this.getComponent(Health);
        if (!health || health.current >= health.max) {
            return false;
        }
        health.heal(1, true);
        return true;
    }

    public applyRogueliteCard(cardId: RogueliteCardId): void {
        switch (cardId) {
            case 'fire_rate':
                this._rogueliteFireMultiplier *= 1.2;
                break;
            case 'damage_up':
                this._bonusDamage += 1;
                break;
            case 'crit_chance':
                this._critChance = Math.min(0.8, this._critChance + 0.2);
                break;
            case 'dash_nova':
                this._hasDashNova = true;
                break;
            case 'vampirism':
                this._hasVampirism = true;
                break;
            case 'shield_wave':
                this._shieldEachWave = true;
                this.setShield(true);
                break;
            case 'weapon_plus':
                if (!this.upgradeWeapon()) {
                    this.addBomb(1);
                }
                break;
            case 'wing_drone':
                if (!this.addDrone()) {
                    this.healOne();
                    this.addBomb(1);
                }
                break;
        }
    }

    public hideVisuals(): void {
        this._shieldRing?.setVisible(false);
        this._overdriveAura?.setVisible(false);
        this._thrusterFlame?.setVisible(false);
        this._beamRect?.setVisible(false);
        for (const drone of this._drones) {
            drone.setVisible(false);
        }
    }

    private emitHudState(): void {
        this.scene.game.events.emit(GameConstants.Events.PLAYER_SHIELD_CHANGED, this._hasShield);
        this.scene.game.events.emit(GameConstants.Events.PLAYER_BOMB_CHANGED, this._bombCount);
        this.scene.game.events.emit(GameConstants.Events.PLAYER_WEAPON_LEVEL_CHANGED, this._weaponLevel);
        this.scene.game.events.emit(GameConstants.Events.PLAYER_DASH_COOLDOWN, 1);
    }

    private getMoveInput(): {x: number; y: number} {
        let moveX = 0;
        let moveY = 0;

        if (this._cursorKeys?.left.isDown || this._wasdKeys?.left.isDown || this._wasdKeys?.leftAlt.isDown) {
            moveX -= 1;
        }
        if (this._cursorKeys?.right.isDown || this._wasdKeys?.right.isDown) {
            moveX += 1;
        }
        if (this._cursorKeys?.up.isDown || this._wasdKeys?.up.isDown || this._wasdKeys?.upAlt.isDown) {
            moveY -= 1;
        }
        if (this._cursorKeys?.down.isDown || this._wasdKeys?.down.isDown) {
            moveY += 1;
        }

        if (moveX !== 0 && moveY !== 0) {
            const invSqrt2 = Math.SQRT1_2;
            moveX *= invSqrt2;
            moveY *= invSqrt2;
        }

        return {x: moveX, y: moveY};
    }

    private tryDash(): void {
        if (!this.active || this.scene.time.paused || this.scene.scene.isPaused()) return;

        const now = this.scene.time.now;
        if (this._isDashing || now < this._dashCooldownEnd) {
            return;
        }

        const input = this.getMoveInput();
        this._dashDirX = input.x;
        this._dashDirY = input.y;
        if (this._dashDirX === 0 && this._dashDirY === 0) {
            this._dashDirY = -1;
        }

        this._isDashing = true;
        this._dashEndTime = now + Player.DASH_DURATION_MS;
        this._dashCooldownEnd = now + this._dashCooldownMs;

        const sound = (this.scene as unknown as {soundManager?: SoundManager}).soundManager;
        sound?.playDash();
        this._onTutorialAction?.('dash');
    }

    private tryUseEmp(): void {
        if (!this.active || this.scene.time.paused || this.scene.scene.isPaused() || this._bombCount <= 0) {
            return;
        }

        this._bombCount--;
        this.scene.game.events.emit(GameConstants.Events.PLAYER_BOMB_CHANGED, this._bombCount);
        this._onEmpCallback?.();
        this._onTutorialAction?.('emp');
    }

    private fireWeapon(): void {
        const weapon = this.getComponent(Weapon);
        if (!weapon) return;

        this._onTutorialAction?.('shoot');

        const baseRot = Phaser.Math.DegToRad(Player.BASE_ANGLE_DEG);
        const radius = this.arcadeBody.radius;
        const dmgMult = (this._glassCannon ? 2.5 : 1) * (this.isOverdriveActive ? 1.5 : 1);
        const shotBullet: BulletData = {
            ...this._bulletData,
            damage: (this._bulletData.damage + this._bonusDamage) * dmgMult,
            color: this.isOverdriveActive ? 0xffd166 : this._bulletData.color,
        };

        switch (this._weaponLevel) {
            case 1:
                weapon.shootAtAngle(this.x, this.y, radius, baseRot, shotBullet);
                break;
            case 2:
                weapon.shootAtAngle(this.x - 18, this.y, radius, baseRot, shotBullet);
                weapon.shootAtAngle(this.x + 18, this.y, radius, baseRot, shotBullet);
                break;
            case 3:
                weapon.shootCustomSpread(this.x, this.y, radius, baseRot, 3, 20, shotBullet);
                break;
            case 4:
                weapon.shootCustomSpread(this.x, this.y, radius, baseRot, 4, 30, shotBullet);
                break;
            default:
                weapon.shootCustomSpread(this.x, this.y, radius, baseRot, 5, 42, shotBullet);
                break;
        }

        // Temporary 5s Homing Missiles bonus!
        if (this.scene.time.now < this._homingUntil && this._bulletsGroup) {
            for (const side of [-1, 1]) {
                const missile = this._bulletsGroup.get() as Bullet | null;
                if (!missile) break;
                const ang = baseRot + side * 0.42;
                const speed = 780;
                missile.enable(
                    this.x + side * 26,
                    this.y - 10,
                    Math.cos(ang) * speed,
                    Math.sin(ang) * speed,
                    {width: 14, height: 8, color: 0x00f5d4, speed, damage: 1.4},
                    true
                );
            }
        }

        // Wing drones fire support shots every 2nd volley
        this._shotCounter++;
        if (this._shotCounter % 2 === 0) {
            for (const drone of this._drones) {
                weapon.shootAtAngle(drone.x, drone.y - 14, 8, baseRot, {
                    width: 10,
                    height: 4,
                    color: 0xff9f1c,
                    speed: 1050,
                    damage: 1,
                });
            }
        }

        const vfx = (this.scene as unknown as {vfxManager?: VfxManager}).vfxManager;
        vfx?.spawnMuzzleFlash(this.x, this.y - this.displayHeight * 0.45, this._bulletData.color);
        this.scene.sound.play(GameConstants.SoundKeys.PLAYER_LASER, {volume: 0.45});
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number): void {
        super.preUpdate(timeSinceLaunch, deltaTime);

        if (!this.active || this.scene.time.paused) {
            return;
        }

        const now = this.scene.time.now;
        const speed = (this._playerShipData?.movementSpeed ?? 0.6) * this._turboSpeedMult;
        const input = this.getMoveInput();
        if (input.x !== 0 || input.y !== 0) {
            this._onTutorialAction?.('move');
        }

        if (this._isDashing) {
            this.x += this._dashDirX * speed * Player.DASH_SPEED_MULT * deltaTime;
            this.y += this._dashDirY * speed * Player.DASH_SPEED_MULT * deltaTime;

            if (now - this._lastGhostTime > 36) {
                const vfx = (this.scene as unknown as {vfxManager?: VfxManager}).vfxManager;
                vfx?.spawnDashGhost(this.x, this.y, this._playerShipData.texture, this.angle);
                this._lastGhostTime = now;
            }

            if (now >= this._dashEndTime) {
                this._isDashing = false;
                if (this._hasDashNova) {
                    this._onDashNovaCallback?.(this.x, this.y);
                }
            }
        } else {
            this.x += input.x * speed * deltaTime;
            this.y += input.y * speed * deltaTime;
        }

        // Smooth visual banking when moving horizontally
        const targetAngle = Player.BASE_ANGLE_DEG + input.x * Player.MAX_BANK_ANGLE_DEG;
        this.angle = Phaser.Math.Linear(this.angle, targetAngle, 0.22);

        // Clamp within playable screen bounds
        const cam = this.scene.cameras.main;
        const halfW = this.displayWidth / 2;
        const halfH = this.displayHeight / 2;
        this.x = Phaser.Math.Clamp(this.x, halfW, cam.width - halfW);
        this.y = Phaser.Math.Clamp(this.y, cam.height * Player.MIN_Y_RATIO, cam.height - halfH - 24);

        // Update shield & overdrive aura + animated thruster flame
        if (this._shieldRing && this._hasShield) {
            this._shieldRing.setPosition(this.x, this.y);
            this._shieldRing.setScale(1 + Math.sin(timeSinceLaunch * 0.008) * 0.05);
        }
        if (this._overdriveAura && this.isOverdriveActive) {
            this._overdriveAura.setPosition(this.x, this.y);
            this._overdriveAura.setScale(1 + Math.sin(timeSinceLaunch * 0.014) * 0.09);
        }
        if (this._thrusterFlame) {
            const flicker = 0.8 + Math.sin(timeSinceLaunch * 0.045) * 0.28;
            this._thrusterFlame.setPosition(this.x, this.y + 42);
            this._thrusterFlame.setScale(this._isDashing ? 1.4 : 1, (this._isDashing ? 2.4 : 1.1) * flicker);
            this._thrusterFlame.setFillStyle(this._isDashing ? 0x00f5d4 : this.isOverdriveActive ? 0xffd166 : 0x4cc9f0, 0.9);
        }

        // Continuous Laser Beam bonus
        const beamActive = now < this._beamUntil && this._cursorKeys?.space.isDown;
        if (this._beamRect) {
            this._beamRect.setVisible(beamActive);
            if (beamActive) {
                const beamH = Math.max(40, this.y - 40);
                this._beamRect.setPosition(this.x, beamH / 2).setSize(34 + Math.sin(timeSinceLaunch * 0.05) * 6, beamH);
                if (now - this._lastBeamTickMs >= 90) {
                    this._lastBeamTickMs = now;
                    this._onBeamTickCallback?.(this.x, this.y);
                }
            }
        }

        // Update wing drones positions
        this._droneOrbitAngle += deltaTime * 0.004;
        for (let i = 0; i < this._drones.length; i++) {
            const side = i === 0 ? -1 : 1;
            const targetX = this.x + side * 78;
            const targetY = this.y + 18 + Math.sin(this._droneOrbitAngle + i * Math.PI) * 12;
            this._drones[i].setPosition(
                Phaser.Math.Linear(this._drones[i].x, targetX, 0.2),
                Phaser.Math.Linear(this._drones[i].y, targetY, 0.2)
            );
        }

        // Invincibility blink feedback
        if (now < this._invincibleUntil && !this._isDashing) {
            this.setAlpha(Math.floor(now / 70) % 2 === 0 ? 0.35 : 1);
        } else {
            this.setAlpha(1);
        }

        // Emit dash readiness ratio (0..1) to HUD
        const dashReady = now >= this._dashCooldownEnd
            ? 1
            : 1 - (this._dashCooldownEnd - now) / this._dashCooldownMs;
        this.scene.game.events.emit(GameConstants.Events.PLAYER_DASH_COOLDOWN, Phaser.Math.Clamp(dashReady, 0, 1));

        // Shooting (suppressed while continuous Laser Beam is firing)
        const rapidMult = (now < this._rapidFireUntil ? 1.35 : 1) * (this.isOverdriveActive ? 1.7 : 1);
        const effectiveFireDelayMs = (this._baseFireRateSec * 1000) / (rapidMult * this._eventFireMultiplier * this._rogueliteFireMultiplier);
        if (!beamActive && this._cursorKeys?.space.isDown && timeSinceLaunch - this._lastShotTime >= effectiveFireDelayMs) {
            this.fireWeapon();
            this._lastShotTime = timeSinceLaunch;
        }
    }
}
