export type PowerUpKind = 'weapon' | 'rapidFire' | 'shield' | 'heal' | 'bomb' | 'drone' | 'homing' | 'beam';

export type PowerUpVisual = {
    kind: PowerUpKind;
    label: string;
    shortTag: string;
    color: number;
};

export const POWERUP_CATALOG: Record<PowerUpKind, PowerUpVisual> = {
    weapon: {kind: 'weapon', label: 'WEAPON UP!', shortTag: 'W+', color: 0x4cc9f0},
    rapidFire: {kind: 'rapidFire', label: 'RAPID FIRE!', shortTag: 'RF', color: 0xffe066},
    shield: {kind: 'shield', label: 'SHIELD ON!', shortTag: 'SH', color: 0x4895ef},
    heal: {kind: 'heal', label: 'REPAIR +1', shortTag: '+HP', color: 0x52b788},
    bomb: {kind: 'bomb', label: 'EMP NOVA +1', shortTag: 'EMP', color: 0xf72585},
    drone: {kind: 'drone', label: 'WING DRONE!', shortTag: 'DRN', color: 0xff9f1c},
    homing: {kind: 'homing', label: 'HOMING 5s!', shortTag: 'HOM', color: 0x00f5d4},
    beam: {kind: 'beam', label: 'LASER BEAM!', shortTag: 'LSR', color: 0xff4d6d},
};
