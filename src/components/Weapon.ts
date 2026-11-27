import {Physics} from 'phaser';
import type {BulletData} from "../gameData/BulletData.ts";
import type {SpreadShotData} from "../gameData/SpreadShotData.ts";
import Bullet from "../entities/Bullet.ts";
import Entity from "../entities/Entity.ts";
import IComponent from "./IComponent.ts";

export default class Weapon implements IComponent {
    private static readonly FULL_CIRCLE_DEGREES: number = 360;

    public enabled: boolean = true;

    private readonly _bullets: Physics.Arcade.Group;
    private readonly _bulletData: BulletData;
    private readonly _spreadData?: SpreadShotData;

    constructor(bullets: Physics.Arcade.Group, bulletData: BulletData, spreadData?: SpreadShotData) {
        if (!bullets) {
            console.error("Weapon 'bullets' group cannot be null or undefined");
        }

        this._bullets = bullets;
        this._bulletData = bulletData;
        this._spreadData = spreadData;
    }

    public shoot(source: Entity): void {
        if (!this.enabled || !this._bullets) {
            return;
        }

        const shotAngles = this.computeShotAngles(source.rotation);
        for (const angleRad of shotAngles) {
            this.spawnBullet(source.x, source.y, source.arcadeBody.radius, angleRad, this._bulletData);
        }
    }

    public shootAtAngle(
        x: number,
        y: number,
        radius: number,
        angleRad: number,
        bulletOverride?: BulletData
    ): void {
        if (!this.enabled || !this._bullets) {
            return;
        }

        this.spawnBullet(x, y, radius, angleRad, bulletOverride ?? this._bulletData);
    }

    public shootCustomSpread(
        x: number,
        y: number,
        radius: number,
        baseRotation: number,
        bulletCount: number,
        spreadAngleDeg: number,
        bulletOverride?: BulletData
    ): void {
        if (!this.enabled || !this._bullets) {
            return;
        }

        const angles = Weapon.calculateSpreadAngles(baseRotation, bulletCount, spreadAngleDeg);
        const data = bulletOverride ?? this._bulletData;
        for (const angleRad of angles) {
            this.spawnBullet(x, y, radius, angleRad, data);
        }
    }

    private spawnBullet(x: number, y: number, radius: number, angleRad: number, data: BulletData): void {
        const bullet = this._bullets.get() as Bullet | null;
        if (!bullet) {
            return;
        }

        const direction = new Phaser.Math.Vector2(1, 0).rotate(angleRad);
        const velocity = direction.clone().scale(data.speed);
        bullet.enable(
            x + direction.x * radius,
            y + direction.y * radius,
            velocity.x,
            velocity.y,
            data
        );
    }

    private computeShotAngles(baseRotation: number): number[] {
        if (!this._spreadData || this._spreadData.bulletCount <= 1) {
            return [baseRotation];
        }

        return Weapon.calculateSpreadAngles(
            baseRotation,
            this._spreadData.bulletCount,
            this._spreadData.spreadAngle
        );
    }

    public static calculateSpreadAngles(baseRotation: number, bulletCount: number, spreadAngleDeg: number): number[] {
        if (bulletCount <= 1) {
            return [baseRotation];
        }

        const count = Math.floor(bulletCount);
        const spreadDeg = Math.max(0, spreadAngleDeg);
        const angles: number[] = [];

        if (spreadDeg >= Weapon.FULL_CIRCLE_DEGREES) {
            const stepRad = Phaser.Math.DegToRad(Weapon.FULL_CIRCLE_DEGREES / count);
            for (let i = 0; i < count; i++) {
                angles.push(baseRotation + i * stepRad);
            }
            return angles;
        }

        const halfSpreadRad = Phaser.Math.DegToRad(spreadDeg / 2);
        const stepRad = Phaser.Math.DegToRad(spreadDeg / (count - 1));
        for (let i = 0; i < count; i++) {
            angles.push(baseRotation - halfSpreadRad + i * stepRad);
        }

        return angles;
    }
}