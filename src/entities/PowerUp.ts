import {GameObjects, Physics, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";
import {POWERUP_CATALOG, type PowerUpKind} from "../gameData/PowerUpData.ts";
import Player from "./Player.ts";

export default class PowerUp extends Physics.Arcade.Sprite {
    private static readonly FALL_SPEED: number = 0.19;
    private static readonly MAGNET_RADIUS: number = 240;
    private static readonly MAGNET_PULL_SPEED: number = 0.65;

    private _arcadeBody!: Physics.Arcade.Body;
    private _kind: PowerUpKind = 'weapon';
    private _labelText?: GameObjects.Text;
    private _glowRing?: GameObjects.Arc;
    private _targetPlayer?: Player;

    public get kind(): PowerUpKind {
        return this._kind;
    }

    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, GameConstants.TextureKeys.SPRITES, GameConstants.SpriteFrames.STAR_2);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this._arcadeBody = this.body as Physics.Arcade.Body;
        this._arcadeBody.allowGravity = false;
        this._arcadeBody.setCircle(24, -12, -12);
        this.setDepth(25);
    }

    public init(player: Player): void {
        this._targetPlayer = player;
        this._glowRing = this.scene.add.circle(this.x, this.y, 28, 0xffffff, 0.14)
            .setStrokeStyle(3, 0xffffff, 0.9)
            .setDepth(24)
            .setVisible(false);

        this._labelText = this.scene.add.text(this.x, this.y, '', {
            fontFamily: 'future',
            fontSize: '18px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(26).setVisible(false);
    }

    public enable(x: number, y: number, kind: PowerUpKind): void {
        this._kind = kind;
        const visual = POWERUP_CATALOG[kind];

        this.enableBody(true, x, y, true, true);
        this.setScale(1.7);
        this.setTint(visual.color);

        this._glowRing?.setPosition(x, y)
            .setFillStyle(visual.color, 0.18)
            .setStrokeStyle(3, visual.color, 0.95)
            .setVisible(true);

        this._labelText?.setPosition(x, y)
            .setText(visual.shortTag)
            .setVisible(true);
    }

    public disable(): void {
        this.disableBody(true, true);
        this._glowRing?.setVisible(false);
        this._labelText?.setVisible(false);
    }

    preUpdate(timeSinceLaunch: number, deltaTime: number): void {
        super.preUpdate(timeSinceLaunch, deltaTime);

        if (!this.active || this.scene.time.paused) return;

        // Gentle downward drift + magnetic pull when close to player
        if (this._targetPlayer && this._targetPlayer.active) {
            const dx = this._targetPlayer.x - this.x;
            const dy = this._targetPlayer.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist < PowerUp.MAGNET_RADIUS && dist > 1) {
                const pull = PowerUp.MAGNET_PULL_SPEED * deltaTime;
                this.x += (dx / dist) * pull;
                this.y += (dy / dist) * pull;
            } else {
                this.y += PowerUp.FALL_SPEED * deltaTime;
            }
        } else {
            this.y += PowerUp.FALL_SPEED * deltaTime;
        }

        const pulse = 1 + Math.sin(timeSinceLaunch * 0.01) * 0.12;
        this._glowRing?.setPosition(this.x, this.y).setScale(pulse);
        this._labelText?.setPosition(this.x, this.y);

        if (this.y > this.scene.cameras.main.height + 64) {
            this.disable();
        }
    }
}
