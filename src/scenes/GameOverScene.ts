import GameConstants from "../GameConstants.ts";
import {getDifficultyConfig, type GameModeId} from "../gameData/DifficultyData.ts";
import SaveManager from "../managers/SaveManager.ts";
import RegistryConstants from "../RegistryConstants.ts";
import SaveConstants from "../SaveConstants.ts";

export default class GameOverScene extends Phaser.Scene {
    private saveManager!: SaveManager;

    constructor() {
        super(GameConstants.SceneKeys.GAME_OVER);
    }

    create(): void {
        this.scene.stop(GameConstants.SceneKeys.MAIN_UI);

        const cx: number = this.scale.width / 2;
        const h: number = this.scale.height;
        const isVictory = Boolean(this.registry.get(RegistryConstants.Keys.VICTORY));

        this.add.tileSprite(cx, h / 2, this.scale.width + 256, h + 256, 'bg').setTileScale(2).setAlpha(0.65);

        const score = Number(this.registry.get(RegistryConstants.Keys.PLAYER_SCORE) ?? 0);
        const bestScore = Math.max(score, Number(this.saveManager?.getData(SaveConstants.Keys.PLAYER_BEST_SCORE) ?? 0));
        const wave = Number(this.registry.get(RegistryConstants.Keys.CURRENT_WAVE) ?? 1);
        const maxCombo = Number(this.registry.get(RegistryConstants.Keys.MAX_COMBO) ?? 0);
        const diff = getDifficultyConfig(this.registry.get(RegistryConstants.Keys.SELECTED_DIFFICULTY));
        const mode = (this.registry.get(RegistryConstants.Keys.SELECTED_MODE) as GameModeId) ?? 'campaign';

        const rank = this.computeRank(score);

        this.add.text(cx, 300, isVictory ? 'VICTORY!' : 'GAME OVER', {
            fontSize: '96px',
            color: isVictory ? '#ffd166' : '#ff4d6d',
            fontFamily: 'future',
            stroke: '#000000',
            strokeThickness: 8,
        }).setOrigin(0.5);

        if (isVictory) {
            this.add.text(cx, 395, 'CAMPAGNE TERMINEE — OMEGA EMPEROR VAINCU !', {
                fontSize: '26px',
                color: '#80ed99',
                fontFamily: 'future',
            }).setOrigin(0.5);
        }

        this.add.text(cx, 530, `RANK ${rank.letter}`, {
            fontSize: '76px',
            color: rank.color,
            fontFamily: 'future',
            stroke: '#000000',
            strokeThickness: 8,
        }).setOrigin(0.5);

        const statsBoxY = 920;
        this.add.rectangle(cx, statsBoxY, 760, 480, 0x161229, 0.84)
            .setStrokeStyle(3, isVictory ? 0xffd166 : 0x4cc9f0, 0.8);

        const modeLabel = mode === 'campaign' ? 'CAMPAGNE' : 'INFINI ROGUELITE';
        const lines = [
            `MODE        :  ${modeLabel}`,
            `DIFFICULTE  :  ${diff.label}`,
            `SCORE       :  ${score}`,
            `BEST SCORE  :  ${bestScore}`,
            `WAVE        :  ${wave}`,
            `MAX COMBO   :  ${maxCombo} HITS`,
        ].join('\n');

        this.add.text(cx, statsBoxY, lines, {
            fontSize: '30px',
            color: '#ffffff',
            fontFamily: 'future',
            lineSpacing: 24,
            align: 'center',
        }).setOrigin(0.5);

        const replayText = this.add.text(cx, h - 280, 'PRESS SPACE TO RETURN TO MENU', {
            fontSize: '34px',
            color: '#ffe066',
            fontFamily: 'future',
        }).setOrigin(0.5);

        this.tweens.add({
            targets: replayText,
            alpha: 0.35,
            duration: 650,
            yoyo: true,
            repeat: -1,
        });

        this.input.keyboard?.on('keydown-SPACE', (event: KeyboardEvent) => {
            if (event.repeat) return;
            this.scene.start(GameConstants.SceneKeys.HOME);
        });
    }

    private computeRank(score: number): {letter: string; color: string} {
        if (score >= 45000) return {letter: 'S', color: '#ffd166'};
        if (score >= 22000) return {letter: 'A', color: '#4cc9f0'};
        if (score >= 10000) return {letter: 'B', color: '#80ed99'};
        if (score >= 4000) return {letter: 'C', color: '#ff9f1c'};
        return {letter: 'D', color: '#aaaaaa'};
    }
}
