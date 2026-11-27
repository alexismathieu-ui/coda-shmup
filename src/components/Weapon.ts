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
            const bullet = this._bullets.get() as Bullet | null;
            if (!bullet) {
                break;
            }

            const direction = new Phaser.Math.Vector2(1, 0).rotate(angleRad);
            const velocity = direction.clone().scale(this._bulletData.speed);
            bullet.enable(
                source.x + direction.x * source.arcadeBody.radius,
                source.y + direction.y * source.arcadeBody.radius,
                velocity.x,
                velocity.y,
                this._bulletData
            );
        }
    }

    private computeShotAngles(baseRotation: number): number[] {
        if (!this._spreadData || this._spreadData.bulletCount <= 1) {
            return [baseRotation];
        }

        const count = Math.floor(this._spreadData.bulletCount);
        const spreadDeg = Math.max(0, this._spreadData.spreadAngle);
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