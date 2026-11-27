import type {JsonBulletData} from "./SinusoidalEnemyData.ts";

export type BossPatternKind = 'spread' | 'ring' | 'crossRing' | 'spiral' | 'aimedBurst' | 'laserSweep';

export type BossPhaseData = {
    patterns: BossPatternKind[];
    fireIntervalMs: number;
    moveSpeed: number;
    spreadCount: number;
    spreadAngle: number;
    ringCount: number;
};

export type BossData = {
    id: string;
    name: string;
    subtitle: string;
    health: number;
    scoreValue: number;
    tint: string | number;
    enragedTint: string | number;
    phase3Tint?: string | number;
    scale: number;
    teleports?: boolean;
    isFinalBoss?: boolean;
    bullet: JsonBulletData;
    phase1: BossPhaseData;
    phase2: BossPhaseData;
    phase3?: BossPhaseData;
};
