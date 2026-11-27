export type DifficultyId =
  | "gros_bebe"
  | "facile"
  | "normal"
  | "difficile"
  | "cauchemar";
export type GameModeId = "campaign" | "roguelite";

export type DifficultyConfig = {
  id: DifficultyId;
  label: string;
  shortDesc: string;
  accentColor: string;
  accentHex: number;
  enemyHpMult: number;
  bossHpMult: number;
  enemyFireRateMult: number; // < 1 means faster enemy firing
  enemyBulletSpeedMult: number;
  enemySpawnDelayMult: number; // < 1 means faster spawns
  maxActiveBonus: number;
  extraSpreadBullets: number; // Extra bullets added to spread/ring attacks (Bullet Hell!)
  playerBonusHp: number;
  scoreMultiplier: number;
  dropChanceMult: number;
};

export const DIFFICULTIES: readonly DifficultyConfig[] = [
  {
    id: "gros_bebe",
    label: "GROS BEBE",
    shortDesc: "POUR LES GROS BEBE QUI ONT PEUR",
    accentColor: "#ff99cc",
    accentHex: 0xff99cc,
    enemyHpMult: 0.5,
    bossHpMult: 0.5,
    enemyFireRateMult: 1.5,
    enemyBulletSpeedMult: 0.7,
    enemySpawnDelayMult: 1.4,
    maxActiveBonus: -1,
    extraSpreadBullets: 0,
    playerBonusHp: 3,
    scoreMultiplier: 0.5,
    dropChanceMult: 1.5,
  },
  {
    id: "facile",
    label: "FACILE",
    shortDesc: "+1 PV · TIRS PLUS LENTS",
    accentColor: "#80ed99",
    accentHex: 0x80ed99,
    enemyHpMult: 0.85,
    bossHpMult: 0.8,
    enemyFireRateMult: 1.22,
    enemyBulletSpeedMult: 0.84,
    enemySpawnDelayMult: 1.18,
    maxActiveBonus: -1,
    extraSpreadBullets: 0,
    playerBonusHp: 1,
    scoreMultiplier: 0.85,
    dropChanceMult: 1.25,
  },
  {
    id: "normal",
    label: "NORMAL",
    shortDesc: "EXPERIENCE ARCADE STANDARD",
    accentColor: "#4cc9f0",
    accentHex: 0x4cc9f0,
    enemyHpMult: 1.0,
    bossHpMult: 1.0,
    enemyFireRateMult: 1.0,
    enemyBulletSpeedMult: 1.0,
    enemySpawnDelayMult: 1.0,
    maxActiveBonus: 0,
    extraSpreadBullets: 0,
    playerBonusHp: 0,
    scoreMultiplier: 1.0,
    dropChanceMult: 1.0,
  },
  {
    id: "difficile",
    label: "DIFFICILE",
    shortDesc: "ENNEMIS NERVEUX · SCORE x1.35",
    accentColor: "#ff9f1c",
    accentHex: 0xff9f1c,
    enemyHpMult: 1.25,
    bossHpMult: 1.3,
    enemyFireRateMult: 0.78,
    enemyBulletSpeedMult: 1.16,
    enemySpawnDelayMult: 0.72,
    maxActiveBonus: 4,
    extraSpreadBullets: 2,
    playerBonusHp: 0,
    scoreMultiplier: 1.35,
    dropChanceMult: 1.05,
  },
  {
    id: "cauchemar",
    label: "CAUCHEMAR",
    shortDesc: "BULLET HELL INTENSE · SCORE x2",
    accentColor: "#ff1e42",
    accentHex: 0xff1e42,
    enemyHpMult: 1.32,
    bossHpMult: 1.38,
    enemyFireRateMult: 0.68,
    enemyBulletSpeedMult: 1.14,
    enemySpawnDelayMult: 0.64,
    maxActiveBonus: 6,
    extraSpreadBullets: 4,
    playerBonusHp: 0,
    scoreMultiplier: 2.0,
    dropChanceMult: 1.25,
  },
] as const;

export function getDifficultyConfig(id?: string): DifficultyConfig {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[2];
}

export const CAMPAIGN_FINAL_WAVE: number = 30;
