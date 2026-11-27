export type RunModifierId = 'glass_cannon' | 'turbo' | 'no_powerups';

export type RunModifierDef = {
    id: RunModifierId;
    label: string;
    shortDesc: string;
    scoreMult: number;
    accentHex: number;
    accentColor: string;
};

export const RUN_MODIFIERS: readonly RunModifierDef[] = [
    {
        id: 'glass_cannon',
        label: 'GLASS CANNON',
        shortDesc: '1 PV · DEGATS x2.5 · SCORE x1.6',
        scoreMult: 1.6,
        accentHex: 0xff4d6d,
        accentColor: '#ff4d6d',
    },
    {
        id: 'turbo',
        label: 'TURBO',
        shortDesc: 'VITESSE x1.35 · SCORE x1.35',
        scoreMult: 1.35,
        accentHex: 0xffe066,
        accentColor: '#ffe066',
    },
    {
        id: 'no_powerups',
        label: 'NO BONUS',
        shortDesc: 'ZERO DROP · SCORE x1.5',
        scoreMult: 1.5,
        accentHex: 0xc77dff,
        accentColor: '#c77dff',
    },
];

export function computeModifierScoreMultiplier(activeIds: RunModifierId[]): number {
    return activeIds.reduce((acc, id) => {
        const mod = RUN_MODIFIERS.find(m => m.id === id);
        return acc * (mod?.scoreMult ?? 1);
    }, 1);
}
