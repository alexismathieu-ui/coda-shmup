import {BulletData} from "../gameData/BulletData.ts";

export default class Bullet extends Phaser.GameObjects.Rectangle {
    private _arcadeBody!: Phaser.Physics.Arcade.Body;
    private _damage: number = 0;
    public grazed: boolean = false;
    public isHoming: boolean = false;
    private _speed: number = 0;

    public get damage(): number {
        return this._damage;
    }

    public get speed(): number {
        return this._speed;
    }

    public init(): void {
        this.scene.physics.add.existing(this);

        this._arcadeBody = this.body as Phaser.Physics.Arcade.Body;
        this._arcadeBody.allowGravity = false;
        this._arcadeBody.setFriction(0, 0);
        this.setDepth(32);
    }

    public enable(
        x: number,
        y: number,
        velocityX: number,
        velocityY: number,
        data: BulletData,
        homing: boolean = false
    ): void {
        this.grazed = false;
        this.isHoming = homing;
        this._speed = data.speed;

        this.setPosition(x, y);
        this.setSize(data.width, data.height);
        this.setOrigin(0.5);
        this.setFillStyle(data.color, 1);

        const isEnemyShot = data.height >= 10 && !homing;
        if (isEnemyShot) {
            this.setStrokeStyle(3, 0xffffff, 0.95);
            this.setScale(1.15);
            this.setDepth(36);
        } else {
            this.setStrokeStyle(1.5, 0xffffff, 0.8);
            this.setScale(1);
            this.setDepth(30);
        }

        this.scene.physics.world.add(this._arcadeBody);
        this.setActive(true);
        this.setVisible(true);

        this._arcadeBody.setVelocity(velocityX, velocityY);
        this._damage = data.damage;

        this.setRotation(this._arcadeBody.velocity.angle());

        const cos: number = Math.abs(Math.cos(this.rotation));
        const sin: number = Math.abs(Math.sin(this.rotation));
        this._arcadeBody.setSize(data.width * cos + data.height * sin, data.width * sin + data.height * cos);
    }

    public steerToward(targetX: number, targetY: number, turnRate: number = 0.14): void {
        if (!this.active || !this._arcadeBody) return;

        const currentAngle = this._arcadeBody.velocity.angle();
        const desiredAngle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
        const nextAngle = Phaser.Math.Angle.RotateTo(currentAngle, desiredAngle, turnRate);
        this._arcadeBody.setVelocity(
            Math.cos(nextAngle) * this._speed,
            Math.sin(nextAngle) * this._speed
        );
        this.setRotation(nextAngle);
    }

    public applyGravityPull(centerX: number, centerY: number, strength: number, deltaTime: number): void {
        if (!this.active || !this._arcadeBody) return;
        const dx = centerX - this.x;
        const dy = centerY - this.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 1600 || distSq > 420 * 420) return;

        const dist = Math.sqrt(distSq);
        const factor = (strength * deltaTime) / dist;
        this._arcadeBody.velocity.x += (dx / dist) * factor;
        this._arcadeBody.velocity.y += (dy / dist) * factor;
    }

    public disable(): void {
        this.grazed = false;
        this.isHoming = false;
        this.scene.physics.world.disableBody(this._arcadeBody);
        this.setActive(false);
        this.setVisible(false);
    }

    update(timeSinceLaunch: number, deltaTime: number): void {
        super.update(timeSinceLaunch, deltaTime);

        const camera = this.scene.cameras.main;
        if (this.x < -this.displayWidth || this.x > camera.width + this.displayWidth
            || this.y < -this.displayHeight || this.y > camera.height + this.displayHeight) {
            this.disable();
        }
    }
}
