import type {JsonBulletData} from "./SinusoidalEnemyData.ts";
import type {SpreadShotData} from "./SpreadShotData.ts";

export type EnemyMovementKind = 'linear' | 'sinusoidal' | 'kamikaze' | 'sniper' | 'orbital' | 'cargo' | 'minelayer';
export type EnemyAttackKind = 'none' | 'single' | 'spread' | 'aimed' | 'spiral' | 'mine';

export type EnemyArchetypeData = {
    id: string;
    name: string;
    health: number;
    scoreValue: number;
    tint: string | number;
    scale: number;
    dropChance: number;
    guaranteedDrop?: boolean;
    splitsOnDeath?: boolean;
    protectsAllies?: boolean;
    movementKind: EnemyMovementKind;
    speed: number;
    amplitude?: number;
    frequency?: number;
    stopY?: number;
    attackKind: EnemyAttackKind;
    shootDelayMin: number;
    shootDelayMax: number;
    spreadShot?: SpreadShotData;
    bullet?: JsonBulletData;
};

export type EnemiesCatalogData = {
    [id: string]: EnemyArchetypeData;
};
