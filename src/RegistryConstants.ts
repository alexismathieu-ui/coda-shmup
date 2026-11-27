import {Data} from 'phaser';

export default class RegistryConstants {
    public static readonly Keys = Object.freeze({
        PLAYER_SCORE: 'playerScore',
        SELECTED_SHIP: 'selectedShip',
        SELECTED_DIFFICULTY: 'selectedDifficulty',
        SELECTED_MODE: 'selectedMode',
        RUN_MODIFIERS: 'runModifiers',
        TUTORIAL_ENABLED: 'tutorialEnabled',
        CURRENT_WAVE: 'currentWave',
        MAX_COMBO: 'maxCombo',
        VICTORY: 'victory',
    } as const);

    public static readonly Events = Object.freeze({
        PLAYER_SCORE_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.PLAYER_SCORE,
        CURRENT_WAVE_CHANGE: Data.Events.CHANGE_DATA_KEY + RegistryConstants.Keys.CURRENT_WAVE,
    } as const);
}