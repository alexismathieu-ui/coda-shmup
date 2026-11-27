import type {SpreadShotData} from "./SpreadShotData.ts";

export type SinusoidalMovementData = {
    verticalSpeed: number;
    amplitude: number;
    frequency: number;
};

export type JsonBulletData = {
    width: number;
    height: number;
    color: string | number;
    speed: number;
    damage: number;
};

export type SinusoidalEnemyData = {
    spawnRate: number;
    maxActive: number;
    poolSize: number;
    health: number;
    tint: string | number;
    scale: number;
    shootDelayMin: number;
    shootDelayMax: number;
    movement: SinusoidalMovementData;
    spreadShot: SpreadShotData;
    bullet: JsonBulletData;
};

export function parseHexColor(color: string | number, fallback: number = 0xffffff): number {
    if (typeof color === 'number') {
        return color;
    }

    const normalized = color.trim().replace(/^#/, '0x');
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? fallback : parsed;
}
