export type RogueliteCardId =
    | 'fire_rate'
    | 'damage_up'
    | 'crit_chance'
    | 'dash_nova'
    | 'vampirism'
    | 'shield_wave'
    | 'weapon_plus'
    | 'wing_drone';

export type RogueliteCard = {
    id: RogueliteCardId;
    title: string;
    description: string;
    accentColor: string;
    accentHex: number;
};

export const ROGUELITE_CARDS: readonly RogueliteCard[] = [
    {
        id: 'fire_rate',
        title: 'OVERCLOCK',
        description: '+20% CADENCE DE TIR\nPERMANENTE',
        accentColor: '#ffe066',
        accentHex: 0xffe066,
    },
    {
        id: 'damage_up',
        title: 'PLASMA CORE',
        description: '+1 DEGAT SUR TOUS\nVOS PROJECTILES',
        accentColor: '#ff9f1c',
        accentHex: 0xff9f1c,
    },
    {
        id: 'crit_chance',
        title: 'PRECISION',
        description: '+20% CHANCE DE COUP\nCRITIQUE (x2 DEGATS)',
        accentColor: '#f72585',
        accentHex: 0xf72585,
    },
    {
        id: 'dash_nova',
        title: 'DASH EXPLOSIF',
        description: 'VOTRE DASH DETRUIT\nLES BALLES PROCHES',
        accentColor: '#4cc9f0',
        accentHex: 0x4cc9f0,
    },
    {
        id: 'vampirism',
        title: 'NANOBOTS',
        description: '+1 PV TOUS LES 25\nENNEMIS DETRUITS',
        accentColor: '#80ed99',
        accentHex: 0x80ed99,
    },
    {
        id: 'shield_wave',
        title: 'AEGIS CORE',
        description: 'BOUCLIER AUTO AU DEBUT\nDE CHAQUE VAGUE',
        accentColor: '#4895ef',
        accentHex: 0x4895ef,
    },
    {
        id: 'weapon_plus',
        title: 'MULTI-CANON',
        description: '+1 NIVEAU D\'ARME\n(+1 EMP SI MAX)',
        accentColor: '#c77dff',
        accentHex: 0xc77dff,
    },
    {
        id: 'wing_drone',
        title: 'DRONE AILIER',
        description: '+1 DRONE DE SUPPORT\n(+1 PV & +1 EMP SI MAX)',
        accentColor: '#ffd166',
        accentHex: 0xffd166,
    },
];
