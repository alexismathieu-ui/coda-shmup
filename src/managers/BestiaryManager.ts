import SaveConstants from "../SaveConstants.ts";
import SaveManager from "./SaveManager.ts";

export type BestiaryEntry = {
    id: string;
    name: string;
    category: 'ENNEMI' | 'BOSS' | 'BOSS FINAL';
    tint: number;
    scale: number;
    statsText: string;
    abilitiesText: string;
};

export const BESTIARY_ENTRIES: readonly BestiaryEntry[] = [
    {
        id: 'scout',
        name: 'RED SCOUT',
        category: 'ENNEMI',
        tint: 0xffffff,
        scale: 1.0,
        statsText: 'PV : 1  ·  SCORE : 100  ·  VITESSE : MOYENNE',
        abilitiesText: 'Chasseur standard en ligne droite.\nTir simple droit devant (eventail en Cauchemar).',
    },
    {
        id: 'sinusoidal',
        name: 'WAVE WEAVER',
        category: 'ENNEMI',
        tint: 0x44ffcc,
        scale: 1.05,
        statsText: 'PV : 2  ·  SCORE : 180  ·  VITESSE : MOYENNE',
        abilitiesText: 'Deplacement sinusoidal fluide.\nAttaque en Spread Shot (eventail de 3 projectiles).',
    },
    {
        id: 'kamikaze',
        name: 'SOLAR STRIKER',
        category: 'ENNEMI',
        tint: 0xff9f1c,
        scale: 0.85,
        statsText: 'PV : 1  ·  SCORE : 150  ·  VITESSE : TRES RAPIDE',
        abilitiesText: 'Verrouille votre position en descente\npuis fonce droit sur votre vaisseau !',
    },
    {
        id: 'tank',
        name: 'HEAVY DREADNOUGHT',
        category: 'ENNEMI',
        tint: 0xc77dff,
        scale: 1.25,
        statsText: 'PV : 7  ·  SCORE : 400  ·  VITESSE : LENTE',
        abilitiesText: 'Blindage lourd et salves en eventail de 5 balles.\nForte chance de lacher un Power-Up.',
    },
    {
        id: 'sniper',
        name: 'PULSE SNIPER',
        category: 'ENNEMI',
        tint: 0xff4d6d,
        scale: 0.95,
        statsText: 'PV : 2  ·  SCORE : 260  ·  VITESSE : MOYENNE',
        abilitiesText: 'S\'arrete en haut de l\'arene, trace un laser rouge\nde pre-visee puis tire un projectile ultra-rapide.',
    },
    {
        id: 'orbital',
        name: 'VORTEX SPINNER',
        category: 'ENNEMI',
        tint: 0x80ed99,
        scale: 1.1,
        statsText: 'PV : 3  ·  SCORE : 300  ·  VITESSE : LENTE',
        abilitiesText: 'Tourne sur lui-meme en descendant et genere\nune spirale rotative de projectiles.',
    },
    {
        id: 'cargo',
        name: 'GOLDEN CARGO',
        category: 'ENNEMI',
        tint: 0xffd166,
        scale: 1.1,
        statsText: 'PV : 4  ·  SCORE : 600  ·  VITESSE : RAPIDE',
        abilitiesText: 'Traverse horizontalement sans attaquer.\nDrop de Power-Up 100% garanti a sa destruction !',
    },
    {
        id: 'splitter',
        name: 'ACID SPLITTER',
        category: 'ENNEMI',
        tint: 0xb5e48c,
        scale: 1.12,
        statsText: 'PV : 3  ·  SCORE : 260  ·  VITESSE : MOYENNE',
        abilitiesText: 'A sa mort, eclate instantanement en 3 mini\nchasseurs rapides qui foncent sur vous !',
    },
    {
        id: 'minelayer',
        name: 'MINE LAYER',
        category: 'ENNEMI',
        tint: 0xffb703,
        scale: 1.05,
        statsText: 'PV : 3  ·  SCORE : 280  ·  VITESSE : MOYENNE',
        abilitiesText: 'Depose des mines flottantes clignotantes qui\nexplosent en etoile de 8 projectiles.',
    },
    {
        id: 'aegis',
        name: 'AEGIS GUARDIAN',
        category: 'ENNEMI',
        tint: 0x4895ef,
        scale: 1.12,
        statsText: 'PV : 4  ·  SCORE : 340  ·  VITESSE : LENTE',
        abilitiesText: 'Relie un rayon bleu protecteur a ses allies :\nreduit leurs degats recus de 50% tant qu\'il vit !',
    },
    {
        id: 'leviathan',
        name: 'CYBER LEVIATHAN',
        category: 'BOSS',
        tint: 0x4cc9f0,
        scale: 1.35,
        statsText: 'VAGUE 6  ·  PV : 85  ·  SCORE : 3000',
        abilitiesText: '2 Phases : Eventails, salves visees et doubles\nanneaux 360° decales en Phase Enragee.',
    },
    {
        id: 'vortex_lord',
        name: 'VORTEX OVERLORD',
        category: 'BOSS',
        tint: 0x80ed99,
        scale: 1.4,
        statsText: 'VAGUE 12  ·  PV : 120  ·  SCORE : 4500',
        abilitiesText: '2 Phases : Maitre des spirales rotatives rapides\net des barrages circulaires croises.',
    },
    {
        id: 'solar_titan',
        name: 'SOLAR TITAN',
        category: 'BOSS',
        tint: 0xff9f1c,
        scale: 1.45,
        statsText: 'VAGUE 18  ·  PV : 155  ·  SCORE : 6000',
        abilitiesText: '2 Phases : Forteresse orbitale armee d\'un\nRayon Laser Geant telegraphie + eventails lourds.',
    },
    {
        id: 'phantom_architect',
        name: 'PHANTOM ARCHITECT',
        category: 'BOSS',
        tint: 0xc77dff,
        scale: 1.4,
        statsText: 'VAGUE 24  ·  PV : 190  ·  SCORE : 8000',
        abilitiesText: '2 Phases : Se teleporte sur l\'arene, combine\nRayon Laser Geant, salves visees et spirales.',
    },
    {
        id: 'omega_emperor',
        name: 'OMEGA EMPEROR',
        category: 'BOSS FINAL',
        tint: 0xffd166,
        scale: 1.55,
        statsText: 'VAGUE 30  ·  PV : 280  ·  SCORE : 15000',
        abilitiesText: '3 PHASES ULTIMES : Aura energetique, teleportations,\nLaser Geant, anneaux 360° et invocation de renforts !',
    },
];

export default class BestiaryManager {
    public static discover(scene: Phaser.Scene, id: string): void {
        const save = (scene as unknown as {saveManager?: SaveManager}).saveManager;
        const stored = (save?.getData(SaveConstants.Keys.DISCOVERED_ENEMIES) as string[] | undefined) ?? [];
        if (stored.includes(id)) return;
        save?.setData(SaveConstants.Keys.DISCOVERED_ENEMIES, [...stored, id]);
    }

    public static getDiscovered(scene: Phaser.Scene): string[] {
        const save = (scene as unknown as {saveManager?: SaveManager}).saveManager;
        return (save?.getData(SaveConstants.Keys.DISCOVERED_ENEMIES) as string[] | undefined) ?? [];
    }
}
