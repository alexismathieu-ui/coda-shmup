import {GameObjects, Input, Scene, Scenes} from "phaser";
import Health from "../components/Health.ts";
import Player from "../entities/Player.ts";
import GameConstants from "../GameConstants.ts";
import {getDifficultyConfig, type GameModeId} from "../gameData/DifficultyData.ts";
import type {RogueliteCard, RogueliteCardId} from "../gameData/RogueliteCardData.ts";
import type {AchievementDef} from "../managers/AchievementManager.ts";
import SoundManager from "../managers/SoundManager.ts";
import RegistryConstants from "../RegistryConstants.ts";

type BannerPayload = {
    title: string;
    subtitle?: string;
    color?: string;
};

type BossHudPayload = {
    name: string;
    subtitle?: string;
    current: number;
    max: number;
    phase2?: boolean;
};

type ComboPayload = {
    count: number;
    multiplier: number;
};

export default class MainUIScene extends Scene {
    private _playerHealthText!: GameObjects.BitmapText;
    private _scoreText!: GameObjects.BitmapText;
    private _waveText!: GameObjects.Text;
    private _comboText!: GameObjects.Text;
    private _shieldText!: GameObjects.Text;
    private _weaponText!: GameObjects.Text;
    private _bombText!: GameObjects.Text;
    private _muteText!: GameObjects.Text;

    private _dashBarFill!: GameObjects.Rectangle;
    private _overdriveBarFill!: GameObjects.Rectangle;
    private _overdriveLabel!: GameObjects.Text;
    private _waveProgressFill!: GameObjects.Rectangle;
    private _tutorialContainer!: GameObjects.Container;
    private _tutorialBox!: GameObjects.Rectangle;
    private _tutorialText!: GameObjects.Text;
    private _tutorialStatusText!: GameObjects.Text;
    private _lowHpBorder!: GameObjects.Rectangle;
    private _isPaused: boolean = false;

    // Boss bar container
    private _bossBarContainer!: GameObjects.Container;
    private _bossNameText!: GameObjects.Text;
    private _bossBarFill!: GameObjects.Rectangle;

    // Event / Wave banner
    private _bannerTitle!: GameObjects.Text;
    private _bannerSubtitle!: GameObjects.Text;
    private _bannerTween?: Phaser.Tweens.Tween;

    // Pause overlay & Secret Cheat Menu
    private _pauseOverlay!: GameObjects.Container;
    private _pauseMusicVolText!: GameObjects.Text;
    private _cheatOverlay?: GameObjects.Container;
    private _cheatUnlocked: boolean = false;
    private _godModeToggleText?: GameObjects.Text;
    private _godModeActive: boolean = false;

    // Roguelite card picker overlay
    private _cardsOverlay?: GameObjects.Container;
    private _offeredCards: RogueliteCard[] = [];

    constructor() {
        super(GameConstants.SceneKeys.MAIN_UI);
    }

    // noinspection JSUnusedGlobalSymbols
    init(): void {
        this.game.events.on(GameConstants.Events.PLAYER_SPAWNED_EVENT, this.onPlayerSpawned, this);
        this.game.events.on(GameConstants.Events.WAVE_CHANGED, this.onWaveChanged, this);
        this.game.events.on(GameConstants.Events.COMBO_CHANGED, this.onComboChanged, this);
        this.game.events.on(GameConstants.Events.PLAYER_SHIELD_CHANGED, this.onShieldChanged, this);
        this.game.events.on(GameConstants.Events.PLAYER_WEAPON_LEVEL_CHANGED, this.onWeaponLevelChanged, this);
        this.game.events.on(GameConstants.Events.PLAYER_BOMB_CHANGED, this.onBombChanged, this);
        this.game.events.on(GameConstants.Events.PLAYER_DASH_COOLDOWN, this.onDashCooldown, this);
        this.game.events.on(GameConstants.Events.BOSS_SPAWNED_EVENT, this.onBossSpawned, this);
        this.game.events.on(GameConstants.Events.BOSS_HEALTH_CHANGED, this.onBossHealthChanged, this);
        this.game.events.on(GameConstants.Events.BOSS_DEFEATED_EVENT, this.onBossDefeated, this);
        this.game.events.on(GameConstants.Events.BANNER_EVENT, this.onBannerEvent, this);
        this.game.events.on(GameConstants.Events.PAUSE_TOGGLED, this.onPauseToggled, this);
        this.game.events.on(GameConstants.Events.MUTE_TOGGLED, this.onMuteToggled, this);
        this.game.events.on(GameConstants.Events.ROGUELITE_OFFER_CARDS, this.onOfferRogueliteCards, this);
        this.game.events.on(GameConstants.Events.OVERDRIVE_CHANGED, this.onOverdriveChanged, this);
        this.game.events.on(GameConstants.Events.WAVE_PROGRESS_CHANGED, this.onWaveProgressChanged, this);
        this.game.events.on(GameConstants.Events.TUTORIAL_PROMPT, this.onTutorialPrompt, this);
        this.game.events.on(GameConstants.Events.ACHIEVEMENT_UNLOCKED, this.onAchievementUnlocked, this);
        this.registry.events.on(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);

        this.events.once(Scenes.Events.SHUTDOWN, () => {
            this.game.events.off(GameConstants.Events.PLAYER_SPAWNED_EVENT, this.onPlayerSpawned, this);
            this.game.events.off(GameConstants.Events.WAVE_CHANGED, this.onWaveChanged, this);
            this.game.events.off(GameConstants.Events.COMBO_CHANGED, this.onComboChanged, this);
            this.game.events.off(GameConstants.Events.PLAYER_SHIELD_CHANGED, this.onShieldChanged, this);
            this.game.events.off(GameConstants.Events.PLAYER_WEAPON_LEVEL_CHANGED, this.onWeaponLevelChanged, this);
            this.game.events.off(GameConstants.Events.PLAYER_BOMB_CHANGED, this.onBombChanged, this);
            this.game.events.off(GameConstants.Events.PLAYER_DASH_COOLDOWN, this.onDashCooldown, this);
            this.game.events.off(GameConstants.Events.BOSS_SPAWNED_EVENT, this.onBossSpawned, this);
            this.game.events.off(GameConstants.Events.BOSS_HEALTH_CHANGED, this.onBossHealthChanged, this);
            this.game.events.off(GameConstants.Events.BOSS_DEFEATED_EVENT, this.onBossDefeated, this);
            this.game.events.off(GameConstants.Events.BANNER_EVENT, this.onBannerEvent, this);
            this.game.events.off(GameConstants.Events.PAUSE_TOGGLED, this.onPauseToggled, this);
            this.game.events.off(GameConstants.Events.MUTE_TOGGLED, this.onMuteToggled, this);
            this.game.events.off(GameConstants.Events.ROGUELITE_OFFER_CARDS, this.onOfferRogueliteCards, this);
            this.game.events.off(GameConstants.Events.OVERDRIVE_CHANGED, this.onOverdriveChanged, this);
            this.game.events.off(GameConstants.Events.WAVE_PROGRESS_CHANGED, this.onWaveProgressChanged, this);
            this.game.events.off(GameConstants.Events.TUTORIAL_PROMPT, this.onTutorialPrompt, this);
            this.game.events.off(GameConstants.Events.ACHIEVEMENT_UNLOCKED, this.onAchievementUnlocked, this);
            this.registry.events.off(RegistryConstants.Events.PLAYER_SCORE_CHANGE, this.onPlayerScoreChanged, this);
        }, this);
    }

    // noinspection JSUnusedGlobalSymbols
    create(): void {
        const w = this.scale.width;
        const h = this.scale.height;

        // Reset reusable scene instance state cleanly across restarts
        this._isPaused = false;
        this._cheatOverlay = undefined;
        this._cheatUnlocked = false;
        this._godModeActive = false;
        this._godModeToggleText = undefined;
        this._cardsOverlay = undefined;
        this._offeredCards = [];

        // Low-HP warning border
        this._lowHpBorder = this.add.rectangle(w / 2, h / 2, w - 12, h - 12, 0xff0033, 0)
            .setStrokeStyle(14, 0xff2244, 0.75)
            .setVisible(false);

        // Top-left: Lives + status badges
        const playerHealthIcon = this.add.image(44, 48, GameConstants.TextureKeys.SPRITES, GameConstants.SpriteFrames.PLAYER_LIFE)
            .setOrigin(0, 0).setScale(1.4);
        const healthTextX = playerHealthIcon.x + playerHealthIcon.displayWidth + 14;
        this._playerHealthText = this.add.bitmapText(healthTextX, 42, "future-bmp", "x3", 84);

        this._weaponText = this.add.text(44, 128, 'WPN LV.1', {
            fontFamily: 'future',
            fontSize: '22px',
            color: '#4cc9f0',
        });

        this._bombText = this.add.text(44, 160, 'EMP x1 [E]', {
            fontFamily: 'future',
            fontSize: '22px',
            color: '#f72585',
        });

        this._shieldText = this.add.text(44, 192, 'SHIELD ACTIVE', {
            fontFamily: 'future',
            fontSize: '20px',
            color: '#4895ef',
        }).setVisible(false);

        // Top-center: Wave + Difficulty/Mode badge
        this._waveText = this.add.text(w / 2, 46, 'WAVE 1', {
            fontFamily: 'future',
            fontSize: '30px',
            color: '#ffffff',
        }).setOrigin(0.5, 0);

        const diff = getDifficultyConfig(this.registry.get(RegistryConstants.Keys.SELECTED_DIFFICULTY));
        const mode = (this.registry.get(RegistryConstants.Keys.SELECTED_MODE) as GameModeId) ?? 'campaign';
        this.add.text(w / 2, 84, `${diff.label} · ${mode === 'roguelite' ? 'ROGUELITE' : 'CAMPAGNE'}`, {
            fontFamily: 'future',
            fontSize: '16px',
            color: diff.accentColor,
        }).setOrigin(0.5, 0);

        // Sleek wave progress bar
        this.add.rectangle(w / 2, 112, 220, 8, 0x22223b, 0.85).setOrigin(0.5, 0.5);
        this._waveProgressFill = this.add.rectangle(w / 2 - 110, 112, 0, 6, 0x4cc9f0, 1).setOrigin(0, 0.5);

        // Top-right: Score + Combo
        const initialScore = Number(this.registry.get(RegistryConstants.Keys.PLAYER_SCORE) ?? 0)
            .toString()
            .padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        this._scoreText = this.add.bitmapText(w - 44, 42, "future-bmp", initialScore, 84)
            .setOrigin(1, 0);

        this._comboText = this.add.text(w - 44, 128, '', {
            fontFamily: 'future',
            fontSize: '28px',
            color: '#ffd166',
            stroke: '#000000',
            strokeThickness: 5,
        }).setOrigin(1, 0);

        // Boss health bar (hidden by default)
        const barWidth = 620;
        const barBg = this.add.rectangle(0, 0, barWidth, 24, 0x1a1428, 0.9)
            .setStrokeStyle(3, 0xffffff, 0.8);
        this._bossBarFill = this.add.rectangle(-barWidth / 2, 0, barWidth, 18, 0x4cc9f0, 1)
            .setOrigin(0, 0.5);
        this._bossNameText = this.add.text(0, -28, 'BOSS', {
            fontFamily: 'future',
            fontSize: '24px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5);

        this._bossBarContainer = this.add.container(w / 2, 145, [barBg, this._bossBarFill, this._bossNameText])
            .setVisible(false);

        // Bottom-left: Dash readiness bar
        this.add.text(44, h - 78, 'DASH [SHIFT]', {
            fontFamily: 'future',
            fontSize: '18px',
            color: '#a8dadc',
        });
        this.add.rectangle(44, h - 46, 180, 14, 0x22223b, 0.85)
            .setOrigin(0, 0.5)
            .setStrokeStyle(2, 0x4cc9f0, 0.7);
        this._dashBarFill = this.add.rectangle(44, h - 46, 180, 10, 0x4cc9f0, 1)
            .setOrigin(0, 0.5);

        // Bottom-left-center: Hyper Overdrive bar
        this._overdriveLabel = this.add.text(260, h - 78, 'OVERDRIVE [F]', {
            fontFamily: 'future',
            fontSize: '18px',
            color: '#ffd166',
        });
        this.add.rectangle(260, h - 46, 200, 14, 0x22223b, 0.85)
            .setOrigin(0, 0.5)
            .setStrokeStyle(2, 0xffd166, 0.7);
        this._overdriveBarFill = this.add.rectangle(260, h - 46, 0, 10, 0xffd166, 1)
            .setOrigin(0, 0.5);

        // Large framed interactive tutorial box
        this._tutorialBox = this.add.rectangle(w / 2, 265, 920, 175, 0x141029, 0.94)
            .setStrokeStyle(6, 0x4cc9f0, 1);
        this._tutorialText = this.add.text(w / 2, 245, '', {
            fontFamily: 'future',
            fontSize: '30px',
            color: '#ffffff',
            align: 'center',
            lineSpacing: 14,
            wordWrap: {width: 860},
        }).setOrigin(0.5);
        this._tutorialStatusText = this.add.text(w / 2, 322, '', {
            fontFamily: 'future',
            fontSize: '26px',
            color: '#80ed99',
            stroke: '#000000',
            strokeThickness: 5,
        }).setOrigin(0.5);
        this._tutorialContainer = this.add.container(0, 0, [
            this._tutorialBox,
            this._tutorialText,
            this._tutorialStatusText,
        ]).setVisible(false).setDepth(150);

        // Bottom-right: Audio mute hint
        this._muteText = this.add.text(w - 44, h - 54, 'M: SFX ON', {
            fontFamily: 'future',
            fontSize: '18px',
            color: '#aaaaaa',
        }).setOrigin(1, 0.5);

        // Center animated banners
        this._bannerTitle = this.add.text(w / 2, h * 0.36, '', {
            fontFamily: 'future',
            fontSize: '54px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 8,
            align: 'center',
        }).setOrigin(0.5).setAlpha(0);

        this._bannerSubtitle = this.add.text(w / 2, h * 0.36 + 64, '', {
            fontFamily: 'future',
            fontSize: '26px',
            color: '#e0e6ff',
            stroke: '#000000',
            strokeThickness: 5,
            align: 'center',
        }).setOrigin(0.5).setAlpha(0);

        // Pause overlay with Resume + Music Volume + Return to Menu + Secret Cheat Menu
        const soundMgr = (this as unknown as {soundManager?: SoundManager}).soundManager;
        const pauseDim = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.72);
        const pauseTitle = this.add.text(w / 2, h / 2 - 220, 'PAUSE', {
            fontFamily: 'future',
            fontSize: '82px',
            color: '#ffffff',
            stroke: '#4cc9f0',
            strokeThickness: 6,
        }).setOrigin(0.5);

        // Music Volume Control inside Pause
        const volBox = this.add.rectangle(w / 2, h / 2 - 80, 460, 74, 0x161229, 0.95)
            .setStrokeStyle(3, 0xffd166, 0.9);
        this._pauseMusicVolText = this.add.text(
            w / 2,
            h / 2 - 80,
            `MUSIQUE : ${Math.round((soundMgr?.musicVolume ?? 0.3) * 100)}%`,
            {fontFamily: 'future', fontSize: '24px', color: '#ffd166'}
        ).setOrigin(0.5);
        const volMinus = this.add.text(w / 2 - 190, h / 2 - 80, '−', {
            fontFamily: 'future',
            fontSize: '42px',
            color: '#ffffff',
        }).setOrigin(0.5).setInteractive({useHandCursor: true});
        const volPlus = this.add.text(w / 2 + 190, h / 2 - 80, '+', {
            fontFamily: 'future',
            fontSize: '42px',
            color: '#ffffff',
        }).setOrigin(0.5).setInteractive({useHandCursor: true});
        volMinus.on('pointerdown', () => {
            const v = soundMgr?.adjustMusicVolume(-0.1) ?? 0.7;
            this._pauseMusicVolText.setText(`MUSIQUE : ${Math.round(v * 100)}%`);
        });
        volPlus.on('pointerdown', () => {
            const v = soundMgr?.adjustMusicVolume(0.1) ?? 0.7;
            this._pauseMusicVolText.setText(`MUSIQUE : ${Math.round(v * 100)}%`);
        });

        const resumeBox = this.add.rectangle(w / 2, h / 2 + 30, 460, 82, 0x1e2a4a, 0.95)
            .setStrokeStyle(4, 0x4cc9f0, 1)
            .setInteractive({useHandCursor: true});
        const resumeLabel = this.add.text(w / 2, h / 2 + 30, 'REPRENDRE  [TAB / P]', {
            fontFamily: 'future',
            fontSize: '26px',
            color: '#4cc9f0',
        }).setOrigin(0.5);
        resumeBox.on('pointerdown', () => {
            const mainScene = this.scene.get(GameConstants.SceneKeys.MAIN_GAME) as unknown as {togglePause?: () => void};
            mainScene?.togglePause?.();
        });

        const menuBox = this.add.rectangle(w / 2, h / 2 + 145, 460, 82, 0x3b172c, 0.95)
            .setStrokeStyle(4, 0xff4d6d, 1)
            .setInteractive({useHandCursor: true});
        const menuLabel = this.add.text(w / 2, h / 2 + 145, 'RETOUR AU MENU  [BACKSPACE]', {
            fontFamily: 'future',
            fontSize: '23px',
            color: '#ff4d6d',
        }).setOrigin(0.5);
        menuBox.on('pointerdown', () => {
            this.game.events.emit(GameConstants.Events.RETURN_TO_MENU);
        });

        this._pauseOverlay = this.add.container(0, 0, [
            pauseDim,
            pauseTitle,
            volBox,
            this._pauseMusicVolText,
            volMinus,
            volPlus,
            resumeBox,
            resumeLabel,
            menuBox,
            menuLabel,
        ]).setVisible(false).setDepth(180);

        if (this.input.keyboard) {
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.ONE).on('down', () => this.chooseOfferedCard(0));
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.TWO).on('down', () => this.chooseOfferedCard(1));
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.THREE).on('down', () => this.chooseOfferedCard(2));
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.BACKSPACE).on('down', () => {
                if (this._isPaused) {
                    this.game.events.emit(GameConstants.Events.RETURN_TO_MENU);
                }
            });

            // Single key to toggle Cheat Menu while Paused: [C]
            this.input.keyboard.addKey(Input.Keyboard.KeyCodes.C).on('down', () => {
                if (!this._isPaused) return;
                if (this._cheatOverlay?.visible) {
                    this._cheatOverlay.setVisible(false);
                } else {
                    this.openCheatMenu();
                }
            });
        }

        this.scene.bringToTop();
    }

    private onPlayerScoreChanged(_: unknown, value: number): void {
        const scoreStr = Math.floor(value).toString().padStart(GameConstants.MAX_SCORE_DIGITS, "0");
        this._scoreText?.setText(scoreStr);
    }

    private onPlayerSpawned(player: Player): void {
        const health = player.getComponent(Health);
        this.updateHealthDisplay(health?.current ?? 0);

        health?.on(Health.CHANGE_EVENT, (current: number) => {
            this.updateHealthDisplay(current);
        }, this);
    }

    private updateHealthDisplay(current: number): void {
        this._playerHealthText?.setText("x" + current);
        this._lowHpBorder?.setVisible(current === 1);
    }

    private onWaveChanged(wave: number): void {
        this._waveText?.setText(`WAVE ${wave}`);
    }

    private onComboChanged(payload: ComboPayload): void {
        if (!this._comboText) return;
        if (payload.multiplier <= 1) {
            this._comboText.setText(payload.count > 0 ? `${payload.count} HIT` : '');
            this._comboText.setColor('#cccccc');
        } else {
            this._comboText.setText(`x${payload.multiplier} COMBO (${payload.count})`);
            this._comboText.setColor(payload.multiplier >= 6 ? '#f72585' : '#ffd166');
        }
    }

    private onShieldChanged(active: boolean): void {
        this._shieldText?.setVisible(active);
    }

    private onWeaponLevelChanged(level: number): void {
        this._weaponText?.setText(level >= 5 ? 'WPN MAX!' : `WPN LV.${level}`);
    }

    private onBombChanged(count: number): void {
        this._bombText?.setText(`EMP x${count} [E]`);
    }

    private onDashCooldown(ratio: number): void {
        if (!this._dashBarFill) return;
        this._dashBarFill.width = 180 * ratio;
        this._dashBarFill.setFillStyle(ratio >= 1 ? 0x4cc9f0 : 0x556688, 1);
    }

    private onBossSpawned(payload: BossHudPayload): void {
        this._bossNameText?.setText(payload.name);
        this._bossBarFill?.setFillStyle(0x4cc9f0, 1);
        if (this._bossBarFill) {
            this._bossBarFill.width = 620;
        }
        this._bossBarContainer?.setVisible(true);
    }

    private onBossHealthChanged(payload: BossHudPayload): void {
        if (!this._bossBarFill) return;
        const ratio = Phaser.Math.Clamp(payload.current / Math.max(1, payload.max), 0, 1);
        this._bossBarFill.width = 620 * ratio;
        if (payload.phase2) {
            this._bossBarFill.setFillStyle(0xff4d6d, 1);
        }
    }

    private onBossDefeated(): void {
        this._bossBarContainer?.setVisible(false);
    }

    private onBannerEvent(payload: BannerPayload): void {
        if (!this._bannerTitle || !this._bannerSubtitle) return;

        this._bannerTween?.stop();
        this._bannerTitle.setText(payload.title)
            .setColor(payload.color ?? '#ffffff')
            .setAlpha(1)
            .setScale(0.85);
        this._bannerSubtitle.setText(payload.subtitle ?? '')
            .setAlpha(1);

        this._bannerTween = this.tweens.add({
            targets: [this._bannerTitle, this._bannerSubtitle],
            scale: 1,
            duration: 260,
            ease: 'Back.easeOut',
            onComplete: () => {
                this._bannerTween = this.tweens.add({
                    targets: [this._bannerTitle, this._bannerSubtitle],
                    alpha: 0,
                    delay: 3800,
                    duration: 600,
                    ease: 'Quad.easeIn',
                });
            },
        });
    }

    private onPauseToggled(paused: boolean): void {
        this._isPaused = paused;
        this._pauseOverlay?.setVisible(paused);
        if (!paused) {
            this._cheatOverlay?.setVisible(false);
        } else if (this._cheatUnlocked) {
            this._cheatOverlay?.setVisible(true);
        }
    }

    private openCheatMenu(): void {
        this._cheatUnlocked = true;
        if (this._cheatOverlay && this._cheatOverlay.scene) {
            this._cheatOverlay.setVisible(true);
            return;
        }

        const w = this.scale.width;
        const h = this.scale.height;
        const items: GameObjects.GameObject[] = [];

        const panelY = h / 2 + 430;
        const panel = this.add.rectangle(w / 2, panelY, 920, 440, 0x120a24, 0.96)
            .setStrokeStyle(5, 0xffe066, 1);
        const title = this.add.text(w / 2, panelY - 185, '⚡ CHEAT MENU SECRET ⚡', {
            fontFamily: 'future',
            fontSize: '30px',
            color: '#ffe066',
        }).setOrigin(0.5);
        items.push(panel, title);

        const cheats: {id: string; label: string; color: number}[] = [
            {id: 'god_mode', label: 'GOD MODE: OFF', color: 0xffe066},
            {id: 'next_wave', label: '+1 VAGUE (SKIP)', color: 0x4cc9f0},
            {id: 'next_boss', label: 'PROCHAIN BOSS', color: 0xff4d6d},
            {id: 'final_boss', label: 'BOSS FINAL (V30)', color: 0xff1e42},
            {id: 'weapon_max', label: 'ARME MAX (LV.5)', color: 0x4cc9f0},
            {id: 'full_heal', label: 'SOIN COMPLET', color: 0x80ed99},
            {id: 'add_bombs', label: '+3 BOMBES EMP', color: 0xf72585},
            {id: 'overdrive_100', label: 'OVERDRIVE 100%', color: 0xffd166},
            {id: 'drones_shield', label: '2 DRONES + SHIELD', color: 0x4895ef},
            {id: 'all_buffs', label: 'HOMING + LASER', color: 0x00f5d4},
            {id: 'kill_all', label: 'KILL ALL (CLEAR)', color: 0xff9f1c},
            {id: 'add_score', label: '+10 000 SCORE', color: 0xc77dff},
        ];

        cheats.forEach((c, idx) => {
            const col = idx % 3;
            const row = Math.floor(idx / 3);
            const bx = w / 2 + (col - 1) * 290;
            const by = panelY - 110 + row * 84;

            const btn = this.add.rectangle(bx, by, 270, 66, 0x22193d, 0.96)
                .setStrokeStyle(3, c.color, 1)
                .setInteractive({useHandCursor: true});
            const lbl = this.add.text(bx, by, c.label, {
                fontFamily: 'future',
                fontSize: '18px',
                color: '#ffffff',
            }).setOrigin(0.5);

            if (c.id === 'god_mode') {
                this._godModeToggleText = lbl;
            }

            btn.on('pointerdown', () => {
                if (c.id === 'god_mode') {
                    this._godModeActive = !this._godModeActive;
                    this._godModeToggleText?.setText(this._godModeActive ? 'GOD MODE: ON' : 'GOD MODE: OFF');
                    this._godModeToggleText?.setColor(this._godModeActive ? '#80ed99' : '#ffffff');
                }
                this.game.events.emit(GameConstants.Events.CHEAT_ACTION, c.id);
                btn.setFillStyle(c.color, 0.5);
                this.time.delayedCall(120, () => btn.setFillStyle(0x22193d, 0.96));
            });

            items.push(btn, lbl);
        });

        this._cheatOverlay = this.add.container(0, 0, items).setDepth(210);
    }

    private onMuteToggled(muted: boolean): void {
        this._muteText?.setText(muted ? 'M: SFX OFF' : 'M: SFX ON');
    }

    private onOverdriveChanged(payload: {charge: number; active: boolean}): void {
        if (!this._overdriveBarFill || !this._overdriveLabel) return;
        const ratio = Phaser.Math.Clamp(payload.charge / 100, 0, 1);
        this._overdriveBarFill.width = 200 * ratio;
        if (payload.active) {
            this._overdriveLabel.setText('OVERDRIVE ACTIF!').setColor('#ffffff');
            this._overdriveBarFill.setFillStyle(0xffffff, 1);
        } else if (ratio >= 1) {
            this._overdriveLabel.setText('OVERDRIVE PRET [F]!').setColor('#ffe066');
            this._overdriveBarFill.setFillStyle(0xffd166, 1);
        } else {
            this._overdriveLabel.setText('OVERDRIVE [F]').setColor('#ffd166');
            this._overdriveBarFill.setFillStyle(0xff9f1c, 0.9);
        }
    }

    private onWaveProgressChanged(payload: {current: number; target: number}): void {
        if (!this._waveProgressFill) return;
        const ratio = Phaser.Math.Clamp(payload.current / Math.max(1, payload.target), 0, 1);
        this._waveProgressFill.width = 220 * ratio;
    }

    private onTutorialPrompt(payload: {text: string; validated: boolean}): void {
        if (!this._tutorialContainer) return;
        if (!payload || !payload.text) {
            this._tutorialContainer.setVisible(false);
            return;
        }

        this._tutorialContainer.setVisible(true);
        this._tutorialText.setText(payload.text);

        if (payload.validated) {
            this._tutorialBox.setFillStyle(0x123322, 0.96).setStrokeStyle(7, 0x80ed99, 1);
            this._tutorialText.setColor('#80ed99');
            this._tutorialStatusText.setText('✓ ETAPE VALIDEE !').setVisible(true);

            this.tweens.add({
                targets: [this._tutorialBox, this._tutorialText, this._tutorialStatusText],
                scale: 1.07,
                duration: 140,
                yoyo: true,
                ease: 'Back.easeOut',
            });
        } else {
            this._tutorialBox.setFillStyle(0x141029, 0.94).setStrokeStyle(6, 0x4cc9f0, 1);
            this._tutorialText.setColor('#ffffff');
            this._tutorialStatusText.setText('').setVisible(false);

            this._tutorialContainer.setAlpha(0);
            this.tweens.add({
                targets: this._tutorialContainer,
                alpha: 1,
                duration: 220,
                ease: 'Quad.easeOut',
            });
        }
    }

    private onAchievementUnlocked(def: AchievementDef): void {
        const w = this.scale.width;
        const bg = this.add.rectangle(w / 2, -60, 680, 96, 0x161229, 0.96)
            .setStrokeStyle(4, 0xffd166, 1)
            .setDepth(220);
        const title = this.add.text(w / 2, -76, `SUCCES DEBLOQUE : ${def.title}`, {
            fontFamily: 'future',
            fontSize: '23px',
            color: '#ffd166',
        }).setOrigin(0.5).setDepth(221);
        const desc = this.add.text(w / 2, -42, def.description, {
            fontFamily: 'future',
            fontSize: '17px',
            color: '#e0e6ff',
        }).setOrigin(0.5).setDepth(221);

        this.tweens.add({
            targets: [bg, title, desc],
            y: '+=240',
            duration: 420,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: [bg, title, desc],
                    alpha: 0,
                    y: '-=80',
                    delay: 5000,
                    duration: 550,
                    onComplete: () => {
                        bg.destroy();
                        title.destroy();
                        desc.destroy();
                    },
                });
            },
        });
    }

    private onOfferRogueliteCards(cards: RogueliteCard[]): void {
        this._cardsOverlay?.destroy();
        this._offeredCards = cards;

        const w = this.scale.width;
        const h = this.scale.height;
        const elements: GameObjects.GameObject[] = [];

        const dim = this.add.rectangle(w / 2, h / 2, w, h, 0x05030d, 0.78);
        const header = this.add.text(w / 2, h * 0.28, 'CHOISISSEZ UNE AMELIORATION', {
            fontFamily: 'future',
            fontSize: '38px',
            color: '#ffe066',
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5);
        const sub = this.add.text(w / 2, h * 0.28 + 52, 'TOUCHE 1 / 2 / 3  OU  CLIQUEZ SUR UNE CARTE', {
            fontFamily: 'future',
            fontSize: '20px',
            color: '#cccccc',
        }).setOrigin(0.5);

        elements.push(dim, header, sub);

        const cardY = h * 0.54;
        const spacing = 320;
        cards.forEach((card, idx) => {
            const x = w / 2 + (idx - 1) * spacing;
            const box = this.add.rectangle(x, cardY, 290, 360, 0x181330, 0.96)
                .setStrokeStyle(5, card.accentHex, 1)
                .setInteractive({useHandCursor: true});
            box.on('pointerdown', () => this.chooseOfferedCard(idx));
            box.on('pointerover', () => box.setFillStyle(0x282052, 1));
            box.on('pointerout', () => box.setFillStyle(0x181330, 0.96));

            const badge = this.add.text(x, cardY - 130, `[ ${idx + 1} ]`, {
                fontFamily: 'future',
                fontSize: '28px',
                color: card.accentColor,
            }).setOrigin(0.5);

            const title = this.add.text(x, cardY - 50, card.title, {
                fontFamily: 'future',
                fontSize: '26px',
                color: '#ffffff',
                align: 'center',
            }).setOrigin(0.5);

            const desc = this.add.text(x, cardY + 55, card.description, {
                fontFamily: 'future',
                fontSize: '20px',
                color: '#e0e6ff',
                align: 'center',
                lineSpacing: 10,
            }).setOrigin(0.5);

            elements.push(box, badge, title, desc);
        });

        this._cardsOverlay = this.add.container(0, 0, elements).setDepth(200);
    }

    private chooseOfferedCard(index: number): void {
        if (this._offeredCards.length === 0 || !this._offeredCards[index]) return;

        const chosenId: RogueliteCardId = this._offeredCards[index].id;
        this._offeredCards = [];
        this._cardsOverlay?.destroy();
        this._cardsOverlay = undefined;

        this.game.events.emit(GameConstants.Events.ROGUELITE_CARD_CHOSEN, chosenId);
    }
}
