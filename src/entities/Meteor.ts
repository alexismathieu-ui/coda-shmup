import Health from "../components/Health.ts";
import GameConstants from "../GameConstants.ts";
import VfxManager from "../managers/VfxManager.ts";
import Entity from "./Entity.ts";

export default class Meteor extends Entity {
    private static readonly HIT_FLASH_MS: number = 50;
    private static readonly BASE_TINT: number = 0xd97742;

    private _vx: number = 0;
    private _vy: number = 0;
    private _spinSpeed: number = 0;
    private _lastTrailMs: number = 0;
    private _hitTimer?: Phaser.Time.TimerEvent;

    public init(): void {
        this.addComponent(new Health(4, this));
        this.setDepth(24);
        this.setTexture('planet');
        this.arcadeBody.setCircle(this.width * 0.36, this.width * 0.14, this.height * 0.14);

        const health = this.getComponent(Health);
        health?.on(Health.CHANGE_EVENT, () => {
            this.setTintFill(GameConstants.Colors.HIT_FLASH);
            this._hitTimer?.remove(false);
            this._hitTimer = this.scene.time.delayedCall(Meteor.HIT_FLASH_MS, () => {
                if (this.active) {
                    this.setTint(Meteor.BASE_TINT);
                }
            });
        });
    }

    public enable(x: number, y: number, vx: number, vy: number, scale: number): void {
        this._vx = vx;
        this._vy = vy;
        this._spinSpeed = Phaser.Math.FloatBetween(-0.2, 0.2);
        this._lastTrailMs = 0;

        this.enableBody(true, x, y, true, true);
        this.setTexture('planet');
        this.setScale(scale);
        this.setTint(Meteor.BASE_TINT);

        const health = this.getComponent(Health);
        health?.heal(health.max, false);
    }

    public disable(): void {
        this._hitTimer?.remove(false);
        this.disableBody(true, true);
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number): void {
        super.preUpdate(timeSinceLaunch, deltaTime);

        if (!this.active || this.scene.time.paused) return;

        this.x += this._vx * deltaTime;
        this.y += this._vy * deltaTime;
        this.angle += this._spinSpeed * deltaTime;

        // Fiery meteor trail
        if (timeSinceLaunch - this._lastTrailMs > 95) {
            this._lastTrailMs = timeSinceLaunch;
            const vfx = (this.scene as unknown as {vfxManager?: VfxManager}).vfxManager;
            vfx?.spawnHitSpark(this.x, this.y - this.displayHeight * 0.35, 0xff9f1c);
        }

        const cam = this.scene.cameras.main;
        if (this.y > cam.height + 160 || this.x < -180 || this.x > cam.width + 180) {
            this.disable();
        }
    }
}
