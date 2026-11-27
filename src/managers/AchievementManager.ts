import GameConstants from "../GameConstants.ts";
import SaveConstants from "../SaveConstants.ts";
import SaveManager from "./SaveManager.ts";

export type AchievementId =
    | 'first_blood'
    | 'untouchable'
    | 'combo_8x'
    | 'boss_slayer'
    | 'emperor_slayer'
    | 'nightmare_boss'
    | 'graze_master'
    | 'overdrive_hero'
    | 'bounty_hunter'
    | 'gros_bebe';

export type AchievementDef = {
    id: AchievementId;
    title: string;
    description: string;
};

export const ACHIEVEMENTS: Record<AchievementId, AchievementDef> = {
    first_blood: {id: 'first_blood', title: 'PREMIER SANG', description: 'Detruire votre premier ennemi'},
    untouchable: {id: 'untouchable', title: 'INTOUCHABLE', description: 'Finir une vague sans prendre de degats'},
    combo_8x: {id: 'combo_8x', title: 'COMBO MASTER x8', description: 'Atteindre le multiplicateur x8'},
    boss_slayer: {id: 'boss_slayer', title: 'CHASSEUR DE BOSS', description: 'Vaincre votre premier Boss'},
    emperor_slayer: {id: 'emperor_slayer', title: 'SAUVEUR GALACTIQUE', description: 'Vaincre Omega Emperor en Campagne'},
    nightmare_boss: {id: 'nightmare_boss', title: 'SURVIVANT DU CAUCHEMAR', description: 'Vaincre un Boss en difficulte Cauchemar'},
    graze_master: {id: 'graze_master', title: 'DANSEUR DE BALLES', description: 'Froler 20 balles ennemies en une partie'},
    overdrive_hero: {id: 'overdrive_hero', title: 'HYPER OVERDRIVE', description: 'Activer le mode Hyper Overdrive'},
    bounty_hunter: {id: 'bounty_hunter', title: 'CHASSEUR DE PRIME', description: 'Abattre une cible Bounty a temps'},
    gros_bebe: {id: 'gros_bebe', title: 'GROS BEBE DEMASQUE', description: 'Oser lancer la difficulte Gros Bebe'},
};

export default class AchievementManager {
    public static unlock(scene: Phaser.Scene, id: AchievementId): void {
        const save = (scene as unknown as {saveManager?: SaveManager}).saveManager;
        const stored = (save?.getData(SaveConstants.Keys.UNLOCKED_ACHIEVEMENTS) as string[] | undefined) ?? [];
        if (stored.includes(id)) {
            return;
        }

        const updated = [...stored, id];
        save?.setData(SaveConstants.Keys.UNLOCKED_ACHIEVEMENTS, updated);

        const def = ACHIEVEMENTS[id];
        if (def) {
            scene.game.events.emit(GameConstants.Events.ACHIEVEMENT_UNLOCKED, def);
        }
    }
}
