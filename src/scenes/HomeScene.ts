import { GameObjects, Input, Loader } from "phaser";
import GameConstants from "../GameConstants.ts";
import {
  DIFFICULTIES,
  type DifficultyId,
  type GameModeId,
} from "../gameData/DifficultyData.ts";
import {
  RUN_MODIFIERS,
  type RunModifierId,
} from "../gameData/RunModifiersData.ts";
import { ACHIEVEMENTS } from "../managers/AchievementManager.ts";
import BestiaryManager, {
  BESTIARY_ENTRIES,
  type BestiaryEntry,
} from "../managers/BestiaryManager.ts";
import SaveManager from "../managers/SaveManager.ts";
import SoundManager from "../managers/SoundManager.ts";
import RegistryConstants from "../RegistryConstants.ts";
import SaveConstants from "../SaveConstants.ts";

type MenuStep =
  | "title"
  | "mode"
  | "difficulty"
  | "ship"
  | "achievements"
  | "bestiary";

type ShipPreviewOption = {
  id: number;
  frame: string;
  name: string;
  role: string;
  accent: string;
  accentHex: number;
  stats: { speed: number; damage: number; fireRate: number; hp: number };
};

const SHIP_OPTIONS: ShipPreviewOption[] = [
  {
    id: 1,
    frame: "playerShip1_blue",
    name: "VANGUARD",
    role: "EQUILIBRE · POLYVALENT",
    accent: "#ffe066",
    accentHex: 0xffe066,
    stats: { speed: 0.65, damage: 0.55, fireRate: 0.65, hp: 0.75 },
  },
  {
    id: 2,
    frame: "playerShip2_blue",
    name: "INTERCEPTOR",
    role: "ULTRA RAPIDE · TIR DOUBLE · DEGATS LEGERS",
    accent: "#4cc9f0",
    accentHex: 0x4cc9f0,
    stats: { speed: 1.0, damage: 0.35, fireRate: 1.0, hp: 0.75 },
  },
  {
    id: 3,
    frame: "playerShip3_blue",
    name: "TITAN",
    role: "LENT · OBUS LOURDS x2.5 · 4 PV · 2 EMP",
    accent: "#ff9f1c",
    accentHex: 0xff9f1c,
    stats: { speed: 0.4, damage: 1.0, fireRate: 0.42, hp: 1.0 },
  },
];

type BgStar = { rect: GameObjects.Rectangle; speed: number };

export default class HomeScene extends Phaser.Scene {
  private _bg!: GameObjects.TileSprite;
  private _planet!: GameObjects.Image;
  private _stars: BgStar[] = [];
  private _themeOverlay!: GameObjects.Rectangle;
  private _dangerBorder!: GameObjects.Rectangle;
  private _heroShip!: GameObjects.Image;

  private _step: MenuStep = "title";
  private _isTransitioning: boolean = false;
  private _stepContainer?: GameObjects.Container;
  private _stepIndicatorText!: GameObjects.Text;
  private _navHintText!: GameObjects.Text;

  private _selectedMode: GameModeId = "campaign";
  private _selectedDifficultyIndex: number = 2; // Normal
  private _selectedShipId: number = 1;
  private _selectedModifiers: Set<RunModifierId> = new Set();
  private _tutorialEnabled: boolean = true;

  private _dangerPulseTween?: Phaser.Tweens.Tween;
  private _nightmareShakeTimer?: Phaser.Time.TimerEvent;
  private _previewShotTimer?: Phaser.Time.TimerEvent;
  private _detailModal?: GameObjects.Container;
  private _warpSpeed: number = 1;

  constructor() {
    super(GameConstants.SceneKeys.HOME);
  }

  preload(): void {
    const width: number = this.scale.width;
    const y: number = this.scale.height / 2;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(0, y, width, 64);
    this.load.on(Loader.Events.PROGRESS, (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xffffff, 1);
      progressBar.fillRect(0, y, width * value, 64);
    });
    this.load.on(Loader.Events.COMPLETE, () => {
      progressBar.destroy();
      progressBox.destroy();
    });

    this.load.setPath("assets");

    this.load.image("bg", "Backgrounds/darkPurple.png");
    this.load.image("planet", "Planets/planet00.png");
    this.load.image("gros_bebe", "EasterEgg/gros_bebe.png");
    this.load.atlas(
      "sprites",
      "Spritesheet/gameSprites.png",
      "Spritesheet/gameSprites.json",
    );
    this.load.bitmapFont(
      "future-bmp",
      "Fonts/kenvector_future.png",
      "Fonts/kenvector_future.xml",
    );
    this.load.font("future", "Fonts/kenvector_future.ttf");
    this.load.json(
      GameConstants.CacheKeys.PLAYER_SHIPS,
      "Data/playerShips.json",
    );
    this.load.json(
      GameConstants.CacheKeys.SINUSOIDAL_ENEMY,
      "Data/sinusoidalEnemy.json",
    );
    this.load.json(GameConstants.CacheKeys.ENEMIES, "Data/enemies.json");
    this.load.json(GameConstants.CacheKeys.BOSSES, "Data/bosses.json");
    this.load.audio("sfx_laser1", "Sounds/sfx_laser1.ogg");
    this.load.audio("sfx_laser2", "Sounds/sfx_laser2.ogg");
    this.load.audio("sfx_gros_bebe", "Sounds/gros_bebe.mp3");
    this.load.audio("music_menu", "Music/music_menu.mp3");
    this.load.audio("music_game_1", "Music/music_game_1.mp3");
    this.load.audio("music_game_2", "Music/music_game_2.mp3");
  }

  create(): void {
    const cx = this.scale.width / 2;
    const h = this.scale.height;

    this._step = "title";
    this._isTransitioning = false;
    this._warpSpeed = 1;
    this._stars = [];
    this._detailModal?.destroy();
    this._detailModal = undefined;

    (this as unknown as { saveManager?: SaveManager }).saveManager?.load();

    this._selectedShipId = Number(
      this.registry.get(RegistryConstants.Keys.SELECTED_SHIP) ?? 1,
    );
    this._selectedMode =
      (this.registry.get(RegistryConstants.Keys.SELECTED_MODE) as GameModeId) ??
      "campaign";
    const savedDiff =
      (this.registry.get(
        RegistryConstants.Keys.SELECTED_DIFFICULTY,
      ) as DifficultyId) ?? "normal";
    const diffIdx = DIFFICULTIES.findIndex((d) => d.id === savedDiff);
    this._selectedDifficultyIndex = diffIdx >= 0 ? diffIdx : 2;

    // Animated space backdrop
    this._bg = this.add
      .tileSprite(cx, h / 2, this.scale.width + 256, h + 256, "bg")
      .setTileScale(2);

    for (let i = 0; i < 45; i++) {
      const layer = i % 3;
      const size = layer === 0 ? 2 : layer === 1 ? 3 : 4;
      const rect = this.add.rectangle(
        Phaser.Math.Between(0, this.scale.width),
        Phaser.Math.Between(0, h),
        size,
        size,
        i % 6 === 0 ? 0x4cc9f0 : 0xcad2ff,
        layer === 0 ? 0.2 : layer === 1 ? 0.35 : 0.55,
      );
      this._stars.push({
        rect,
        speed: layer === 0 ? 0.06 : layer === 1 ? 0.14 : 0.28,
      });
    }

    this._planet = this.add
      .image(cx + 220, 380, "planet")
      .setScale(0.75)
      .setAlpha(0.5);

    this._themeOverlay = this.add.rectangle(
      cx,
      h / 2,
      this.scale.width,
      h,
      0x000000,
      0,
    );
    this._dangerBorder = this.add
      .rectangle(cx, h / 2, this.scale.width - 16, h - 16, 0xff0022, 0)
      .setStrokeStyle(18, 0xff1e42, 0.9)
      .setVisible(false);

    // Decorative hero ship for the intro fly-in
    this._heroShip = this.add
      .image(cx, h + 160, GameConstants.TextureKeys.SPRITES, "playerShip1_blue")
      .setAngle(-90)
      .setScale(1.45);

    this._stepIndicatorText = this.add
      .text(cx, 88, "", {
        fontSize: "20px",
        color: "#9aa5ce",
        fontFamily: "future",
      })
      .setOrigin(0.5);

    this._navHintText = this.add
      .text(cx, h - 74, "", {
        fontSize: "20px",
        color: "#9aa5ce",
        fontFamily: "future",
      })
      .setOrigin(0.5);

    // Music volume control in top-right corner of Menu
    const soundMgr = (this as unknown as { soundManager?: SoundManager }).soundManager;
    soundMgr?.startMusic("menu");

    const volBg = this.add
      .rectangle(this.scale.width - 175, 58, 290, 52, 0x161229, 0.85)
      .setStrokeStyle(2, 0x4cc9f0, 0.7)
      .setDepth(120);
    const volText = this.add
      .text(
        this.scale.width - 175,
        58,
        `MUSIQUE ${Math.round((soundMgr?.musicVolume ?? 0.3) * 100)}%`,
        { fontSize: "17px", color: "#4cc9f0", fontFamily: "future" },
      )
      .setOrigin(0.5)
      .setDepth(121);
    const volMinus = this.add
      .text(this.scale.width - 292, 58, "−", {
        fontSize: "30px",
        color: "#ffffff",
        fontFamily: "future",
      })
      .setOrigin(0.5)
      .setDepth(121)
      .setInteractive({ useHandCursor: true });
    const volPlus = this.add
      .text(this.scale.width - 58, 58, "+", {
        fontSize: "30px",
        color: "#ffffff",
        fontFamily: "future",
      })
      .setOrigin(0.5)
      .setDepth(121)
      .setInteractive({ useHandCursor: true });

    const refreshVol = () => {
      volText.setText(
        `MUSIQUE ${Math.round((soundMgr?.musicVolume ?? 0.3) * 100)}%`,
      );
    };
    volMinus.on("pointerdown", () => {
      soundMgr?.adjustMusicVolume(-0.1);
      refreshVol();
    });
    volPlus.on("pointerdown", () => {
      soundMgr?.adjustMusicVolume(0.1);
      refreshVol();
    });
    void volBg;

    this.bindKeyboard();

    // Play welcoming intro animation into Title screen
    this.cameras.main.fadeIn(450, 0, 0, 0);
    this.tweens.add({
      targets: this._heroShip,
      y: h * 0.62,
      duration: 900,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: this._heroShip,
          y: h * 0.62 - 22,
          duration: 1400,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      },
    });

    this.showStep("title", 0);
  }

  private bindKeyboard(): void {
    if (!this.input.keyboard) return;

    const onConfirm = (event?: KeyboardEvent) => {
      if (event?.repeat || this._isTransitioning) return;
      this.handleConfirm();
    };
    const onBack = () => {
      if (this._isTransitioning) return;
      this.handleBack();
    };

    this.input.keyboard.on("keydown-SPACE", onConfirm);
    this.input.keyboard.on("keydown-ENTER", onConfirm);
    this.input.keyboard.addKey(Input.Keyboard.KeyCodes.ESC).on("down", onBack);
    this.input.keyboard
      .addKey(Input.Keyboard.KeyCodes.BACKSPACE)
      .on("down", onBack);

    const moveLeft = () => {
      if (!this._isTransitioning) this.handleHorizontal(-1);
    };
    const moveRight = () => {
      if (!this._isTransitioning) this.handleHorizontal(1);
    };

    this.input.keyboard
      .addKey(Input.Keyboard.KeyCodes.LEFT)
      .on("down", moveLeft);
    this.input.keyboard.addKey(Input.Keyboard.KeyCodes.A).on("down", moveLeft);
    this.input.keyboard.addKey(Input.Keyboard.KeyCodes.Q).on("down", moveLeft);
    this.input.keyboard
      .addKey(Input.Keyboard.KeyCodes.RIGHT)
      .on("down", moveRight);
    this.input.keyboard.addKey(Input.Keyboard.KeyCodes.D).on("down", moveRight);
  }

  private handleHorizontal(dir: -1 | 1): void {
    if (this._step === "mode") {
      this._selectedMode =
        this._selectedMode === "campaign" ? "roguelite" : "campaign";
      this.registry.set(
        RegistryConstants.Keys.SELECTED_MODE,
        this._selectedMode,
      );
      this.showStep("mode", 0, true);
    } else if (this._step === "difficulty") {
      this._selectedDifficultyIndex =
        (this._selectedDifficultyIndex + dir + DIFFICULTIES.length) %
        DIFFICULTIES.length;
      this.registry.set(
        RegistryConstants.Keys.SELECTED_DIFFICULTY,
        DIFFICULTIES[this._selectedDifficultyIndex].id,
      );
      this.showStep("difficulty", dir, true);
    } else if (this._step === "ship") {
      this._selectedShipId = ((this._selectedShipId - 1 + dir + 3) % 3) + 1;
      this.registry.set(
        RegistryConstants.Keys.SELECTED_SHIP,
        this._selectedShipId,
      );
      this.showStep("ship", dir, true);
    }
  }

  private handleConfirm(): void {
    if (this._step === "title") {
      this.showStep("mode", 1);
      return;
    }
    if (this._step === "mode") {
      this.showStep("difficulty", 1);
      return;
    }
    if (this._step === "difficulty") {
      const diff = DIFFICULTIES[this._selectedDifficultyIndex];
      this.registry.set(RegistryConstants.Keys.SELECTED_DIFFICULTY, diff.id);
      // Subtlety: confirming Gros Bébé immediately launches the laughing cat Easter Egg!
      if (diff.id === "gros_bebe") {
        (this as unknown as { soundManager?: SoundManager }).soundManager?.stopMusic();
        this.scene.start(GameConstants.SceneKeys.GROS_BEBE);
        return;
      }
      this.showStep("ship", 1);
      return;
    }
    if (this._step === "ship") {
      this.launchGame();
    }
  }

  private handleBack(): void {
    if (this._detailModal) {
      this._detailModal.destroy();
      this._detailModal = undefined;
      return;
    }
    if (
      this._step === "mode" ||
      this._step === "achievements" ||
      this._step === "bestiary"
    ) {
      this.showStep("title", -1);
    } else if (this._step === "difficulty") {
      this.resetTheme();
      this.showStep("mode", -1);
    } else if (this._step === "ship") {
      this.showStep("difficulty", -1);
    }
  }

  private showStep(
    nextStep: MenuStep,
    direction: number,
    instantCarousel: boolean = false,
  ): void {
    this._step = nextStep;
    this._heroShip.setVisible(nextStep === "title");

    if (nextStep === "difficulty") {
      this.applyDifficultyTheme(DIFFICULTIES[this._selectedDifficultyIndex].id);
    } else if (nextStep === "ship") {
      const diff = DIFFICULTIES[this._selectedDifficultyIndex];
      if (diff.id === "cauchemar") {
        this.applyDifficultyTheme("cauchemar");
      } else {
        this.resetTheme();
      }
    } else {
      this.resetTheme();
    }

    const oldContainer = this._stepContainer;
    const newContainer = this.buildStepContainer(nextStep);
    this._stepContainer = newContainer;

    const slideDist = instantCarousel ? 160 : 280;
    if (oldContainer) {
      this.tweens.add({
        targets: oldContainer,
        x: -direction * slideDist,
        alpha: 0,
        duration: instantCarousel ? 160 : 220,
        ease: "Cubic.easeIn",
        onComplete: () => oldContainer.destroy(),
      });
    }

    newContainer.setPosition(direction * slideDist, 0).setAlpha(0);
    this._isTransitioning = true;
    this.tweens.add({
      targets: newContainer,
      x: 0,
      alpha: 1,
      duration: instantCarousel ? 200 : 280,
      ease: "Cubic.easeOut",
      onComplete: () => {
        this._isTransitioning = false;
      },
    });
  }

  private buildStepContainer(step: MenuStep): GameObjects.Container {
    const cx = this.scale.width / 2;
    const h = this.scale.height;

    if (step === "title") {
      this._stepIndicatorText.setText("");
      this._navHintText.setText(
        "ARROWS / WASD · SPACE · SHIFT (DASH) · E (EMP)",
      );

      const title = this.add
        .text(cx, 440, "SHIP AND\nCIRCLES", {
          fontSize: "112px",
          color: "#ffffff",
          fontFamily: "future",
          align: "center",
          stroke: "#4cc9f0",
          strokeThickness: 10,
          lineSpacing: 16,
        })
        .setOrigin(0.5);

      const sub = this.add
        .text(cx, 665, "ARCADE SPACE SHOOTER", {
          fontSize: "30px",
          color: "#4cc9f0",
          fontFamily: "future",
        })
        .setOrigin(0.5);

      const startBtn = this.add
        .text(cx, h - 340, "PRESS SPACE TO START", {
          fontSize: "42px",
          color: "#ffe066",
          fontFamily: "future",
          stroke: "#000000",
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      startBtn.on("pointerdown", () => this.handleConfirm());

      this.tweens.add({
        targets: startBtn,
        alpha: 0.32,
        duration: 650,
        yoyo: true,
        repeat: -1,
      });

      // Achievements & Bestiary Encyclopedia buttons on Title Screen
      const btnY = h - 210;
      const achBox = this.add
        .rectangle(cx - 210, btnY, 370, 74, 0x161229, 0.9)
        .setStrokeStyle(3, 0xffd166, 0.95)
        .setInteractive({ useHandCursor: true });
      const achLabel = this.add
        .text(cx - 210, btnY, "SUCCES", {
          fontSize: "26px",
          color: "#ffd166",
          fontFamily: "future",
        })
        .setOrigin(0.5);
      achBox.on("pointerdown", () => this.showStep("achievements", 1));

      const encBox = this.add
        .rectangle(cx + 210, btnY, 370, 74, 0x161229, 0.9)
        .setStrokeStyle(3, 0x4cc9f0, 0.95)
        .setInteractive({ useHandCursor: true });
      const encLabel = this.add
        .text(cx + 210, btnY, "ENCYCLOPEDIE", {
          fontSize: "26px",
          color: "#4cc9f0",
          fontFamily: "future",
        })
        .setOrigin(0.5);
      encBox.on("pointerdown", () => this.showStep("bestiary", 1));

      return this.add.container(0, 0, [
        title,
        sub,
        startBtn,
        achBox,
        achLabel,
        encBox,
        encLabel,
      ]);
    }

    if (step === "achievements") {
      this._stepIndicatorText.setText("SUCCES");
      this._navHintText.setText("ESC / BACKSPACE POUR RETOURNER A L'ACCUEIL");

      const save = (this as unknown as { saveManager?: SaveManager }).saveManager;
      const unlocked =
        (save?.getData(SaveConstants.Keys.UNLOCKED_ACHIEVEMENTS) as
          | string[]
          | undefined) ?? [];
      const all = Object.values(ACHIEVEMENTS);

      const elements: GameObjects.GameObject[] = [];
      const header = this.add
        .text(cx, 195, `SUCCES  (${unlocked.length} / ${all.length})`, {
          fontSize: "48px",
          color: "#ffd166",
          fontFamily: "future",
          stroke: "#000000",
          strokeThickness: 6,
        })
        .setOrigin(0.5);
      elements.push(header);

      all.forEach((ach, idx) => {
        const isUnlocked = unlocked.includes(ach.id);
        const y = 310 + idx * 126;
        const box = this.add
          .rectangle(
            cx,
            y,
            880,
            106,
            isUnlocked ? 0x241d3d : 0x120e21,
            isUnlocked ? 0.94 : 0.72,
          )
          .setStrokeStyle(3, isUnlocked ? 0xffd166 : 0x3b3654, 1);

        const titleTxt = this.add
          .text(
            cx - 400,
            y - 22,
            isUnlocked ? `✓  ${ach.title}` : `🔒  ${ach.title}`,
            {
              fontSize: "24px",
              color: isUnlocked ? "#ffd166" : "#7a7594",
              fontFamily: "future",
            },
          )
          .setOrigin(0, 0.5);

        const descTxt = this.add
          .text(cx - 400, y + 18, ach.description, {
            fontSize: "18px",
            color: isUnlocked ? "#e0e6ff" : "#5e5a75",
            fontFamily: "future",
          })
          .setOrigin(0, 0.5);

        elements.push(box, titleTxt, descTxt);
      });

      const backBtn = this.add
        .text(cx, h - 155, "◀  RETOUR A L'ACCUEIL  [ESC]", {
          fontSize: "30px",
          color: "#4cc9f0",
          fontFamily: "future",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      backBtn.on("pointerdown", () => this.handleBack());
      elements.push(backBtn);

      return this.add.container(0, 0, elements);
    }

    if (step === "bestiary") {
      const discovered = BestiaryManager.getDiscovered(this);
      this._stepIndicatorText.setText("ENCYCLOPEDIE DES ENNEMIS");
      this._navHintText.setText(
        "CLIQUEZ SUR UN ENNEMI DEBLOQUE POUR VOIR SES STATS · ESC RETOUR",
      );

      const elements: GameObjects.GameObject[] = [];
      const header = this.add
        .text(
          cx,
          190,
          `ENCYCLOPEDIE  (${discovered.length} / ${BESTIARY_ENTRIES.length})`,
          {
            fontSize: "44px",
            color: "#4cc9f0",
            fontFamily: "future",
            stroke: "#000000",
            strokeThickness: 6,
          },
        )
        .setOrigin(0.5);
      elements.push(header);

      const sub = this.add
        .text(
          cx,
          248,
          "TUEZ LES ENNEMIS ET LES BOSS EN JEU POUR LES DEBLOQUER",
          {
            fontSize: "18px",
            color: "#b8c0ff",
            fontFamily: "future",
          },
        )
        .setOrigin(0.5);
      elements.push(sub);

      BESTIARY_ENTRIES.forEach((entry, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const bx = cx + (col - 1) * 305;
        const by = 400 + row * 245;
        const isUnlocked = discovered.includes(entry.id);
        const borderCol = !isUnlocked
          ? 0x3b3654
          : entry.category === "BOSS FINAL"
            ? 0xffd166
            : entry.category === "BOSS"
              ? 0xff4d6d
              : 0x4cc9f0;

        const card = this.add
          .rectangle(
            bx,
            by,
            280,
            215,
            isUnlocked ? 0x1a1533 : 0x100c1e,
            isUnlocked ? 0.94 : 0.78,
          )
          .setStrokeStyle(isUnlocked ? 4 : 2, borderCol, 1);

        if (isUnlocked) {
          card.setInteractive({ useHandCursor: true });
          card.on("pointerdown", () => this.openBestiaryDetail(entry));
        }

        const sprite = this.add
          .image(
            bx,
            by - 28,
            GameConstants.TextureKeys.SPRITES,
            GameConstants.SpriteFrames.ENEMY_UFO,
          )
          .setScale(Math.min(1.05, entry.scale * 0.82));

        if (!isUnlocked) {
          sprite.setTintFill(0x1f1a33).setAlpha(0.75);
        } else if (entry.tint !== 0xffffff) {
          sprite.setTint(entry.tint);
        }

        const catLabel = this.add
          .text(bx, by - 88, entry.category, {
            fontSize: "13px",
            color:
              entry.category === "BOSS FINAL"
                ? "#ffd166"
                : entry.category === "BOSS"
                  ? "#ff4d6d"
                  : "#9aa5ce",
            fontFamily: "future",
          })
          .setOrigin(0.5);

        const nameLabel = this.add
          .text(bx, by + 64, isUnlocked ? entry.name : "???", {
            fontSize: "17px",
            color: isUnlocked ? "#ffffff" : "#666080",
            fontFamily: "future",
            align: "center",
          })
          .setOrigin(0.5);

        elements.push(card, sprite, catLabel, nameLabel);
      });

      const backBtn = this.add
        .text(cx, h - 145, "◀  RETOUR A L'ACCUEIL  [ESC]", {
          fontSize: "30px",
          color: "#4cc9f0",
          fontFamily: "future",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      backBtn.on("pointerdown", () => this.handleBack());
      elements.push(backBtn);

      return this.add.container(0, 0, elements);
    }

    if (step === "mode") {
      this._stepIndicatorText.setText("ETAPE 1 / 3  ·  MODE DE JEU");
      this._navHintText.setText("← → CHOISIR  ·  SPACE VALIDER  ·  ESC RETOUR");

      const elements: GameObjects.GameObject[] = [];
      const header = this.add
        .text(cx, 320, "CHOISISSEZ VOTRE MODE", {
          fontSize: "44px",
          color: "#ffffff",
          fontFamily: "future",
          stroke: "#000000",
          strokeThickness: 6,
        })
        .setOrigin(0.5);
      elements.push(header);

      const modes: {
        mode: GameModeId;
        title: string;
        badge: string;
        desc: string;
        accent: number;
        accentStr: string;
      }[] = [
        {
          mode: "campaign",
          title: "CAMPAGNE",
          badge: "30 VAGUES · 5 BOSS",
          desc: "AFFRONTEZ LES 5 BOSS\nET VAINQUEZ OMEGA EMPEROR\nA LA VAGUE 30 POUR GAGNER !",
          accent: 0x4cc9f0,
          accentStr: "#4cc9f0",
        },
        {
          mode: "roguelite",
          title: "INFINI ROGUELITE",
          badge: "SANS FIN · CARTES UPGRADE",
          desc: "CHOISISSEZ 1 CARTE PARMI 3\nTOUTES LES 2 VAGUES ET BOSS.\nPOUSSEZ VOTRE BUILD AU MAX !",
          accent: 0xffd166,
          accentStr: "#ffd166",
        },
      ];

      modes.forEach((m, idx) => {
        const y = idx === 0 ? 680 : 1140;
        const active = this._selectedMode === m.mode;
        const box = this.add
          .rectangle(
            cx,
            y,
            780,
            340,
            active ? 0x26204a : 0x161229,
            active ? 0.94 : 0.76,
          )
          .setStrokeStyle(active ? 7 : 3, active ? m.accent : 0x444466, 1)
          .setInteractive({ useHandCursor: true });

        box.on("pointerdown", () => {
          if (this._selectedMode === m.mode) {
            this.handleConfirm();
          } else {
            this._selectedMode = m.mode;
            this.registry.set(RegistryConstants.Keys.SELECTED_MODE, m.mode);
            this.showStep("mode", 0, true);
          }
        });

        const title = this.add
          .text(cx, y - 95, m.title, {
            fontSize: "46px",
            color: active ? m.accentStr : "#ffffff",
            fontFamily: "future",
          })
          .setOrigin(0.5);

        const badge = this.add
          .text(cx, y - 35, m.badge, {
            fontSize: "22px",
            color: m.accentStr,
            fontFamily: "future",
          })
          .setOrigin(0.5);

        const desc = this.add
          .text(cx, y + 65, m.desc, {
            fontSize: "22px",
            color: "#e0e6ff",
            fontFamily: "future",
            align: "center",
            lineSpacing: 12,
          })
          .setOrigin(0.5);

        elements.push(box, title, badge, desc);
      });

      const nextBtn = this.add
        .text(cx, h - 220, "CONTINUER  [SPACE]", {
          fontSize: "34px",
          color: "#ffe066",
          fontFamily: "future",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      nextBtn.on("pointerdown", () => this.handleConfirm());
      elements.push(nextBtn);

      return this.add.container(0, 0, elements);
    }

    if (step === "difficulty") {
      const diff = DIFFICULTIES[this._selectedDifficultyIndex];
      this._stepIndicatorText.setText("ETAPE 2 / 3  ·  DIFFICULTE");
      this._navHintText.setText(
        "← → DEFILER  ·  SPACE CONFIRMER  ·  ESC RETOUR",
      );

      const elements: GameObjects.GameObject[] = [];
      const header = this.add
        .text(cx, 320, "CHOISISSEZ LA DIFFICULTE", {
          fontSize: "42px",
          color:
            diff.id === "gros_bebe"
              ? "#fff3b0"
              : diff.id === "cauchemar"
                ? "#ff1e42"
                : "#ffffff",
          fontFamily: "future",
          stroke: "#000000",
          strokeThickness: 6,
        })
        .setOrigin(0.5);
      elements.push(header);

      // Carousel main card
      const cardY = 860;
      const card = this.add
        .rectangle(
          cx,
          cardY,
          720,
          560,
          diff.id === "gros_bebe" ? 0x4a2442 : 0x161229,
          0.92,
        )
        .setStrokeStyle(7, diff.accentHex, 1);

      const badgeText =
        diff.id === "gros_bebe"
          ? "MODE DE GROS BEBE"
          : diff.id === "cauchemar"
            ? "⚠ DANGER EXTREME ⚠"
            : `SCORE x${diff.scoreMultiplier}`;

      const badge = this.add
        .text(cx, cardY - 190, badgeText, {
          fontSize: "26px",
          color: diff.accentColor,
          fontFamily: "future",
        })
        .setOrigin(0.5);

      const title = this.add
        .text(cx, cardY - 85, diff.label, {
          fontSize: "74px",
          color: diff.accentColor,
          fontFamily: "future",
          stroke: "#000000",
          strokeThickness: 8,
        })
        .setOrigin(0.5);

      const desc = this.add
        .text(cx, cardY + 30, diff.shortDesc, {
          fontSize: "26px",
          color: "#ffffff",
          fontFamily: "future",
          align: "center",
        })
        .setOrigin(0.5);

      // Danger meter pips (1 to 5)
      const dangerLabel = this.add
        .text(cx, cardY + 135, "INTENSITE", {
          fontSize: "20px",
          color: "#bbbbbb",
          fontFamily: "future",
        })
        .setOrigin(0.5);
      elements.push(card, badge, title, desc, dangerLabel);

      for (let i = 0; i < 5; i++) {
        const filled =
          i <= this._selectedDifficultyIndex && diff.id !== "gros_bebe";
        const pip = this.add.rectangle(
          cx + (i - 2) * 58,
          cardY + 185,
          44,
          18,
          filled ? diff.accentHex : 0x33334d,
          1,
        );
        elements.push(pip);
      }

      // Left / Right carousel arrows
      const leftArrow = this.add
        .text(105, cardY, "◀", {
          fontSize: "84px",
          color: "#ffffff",
          fontFamily: "future",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      leftArrow.on("pointerdown", () => this.handleHorizontal(-1));

      const rightArrow = this.add
        .text(this.scale.width - 105, cardY, "▶", {
          fontSize: "84px",
          color: "#ffffff",
          fontFamily: "future",
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      rightArrow.on("pointerdown", () => this.handleHorizontal(1));
      elements.push(leftArrow, rightArrow);

      // Pagination dots
      DIFFICULTIES.forEach((d, idx) => {
        const active = idx === this._selectedDifficultyIndex;
        const dot = this.add
          .circle(
            cx + (idx - 2) * 42,
            cardY + 340,
            active ? 12 : 7,
            active ? d.accentHex : 0x555577,
            1,
          )
          .setInteractive({ useHandCursor: true });
        dot.on("pointerdown", () => {
          const dir = idx > this._selectedDifficultyIndex ? 1 : -1;
          this._selectedDifficultyIndex = idx;
          this.showStep("difficulty", dir, true);
        });
        elements.push(dot);
      });

      const confirmLabel =
        diff.id === "gros_bebe"
          ? "CONTINUER SI TU OSES [SPACE]"
          : diff.id === "cauchemar"
            ? "ACCEPTER LE CAUCHEMAR [SPACE]"
            : "VALIDER [SPACE]";

      const confirmBtn = this.add
        .text(cx, h - 220, confirmLabel, {
          fontSize: "34px",
          color: diff.accentColor,
          fontFamily: "future",
          stroke: "#000000",
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      confirmBtn.on("pointerdown", () => this.handleConfirm());
      elements.push(confirmBtn);

      return this.add.container(0, 0, elements);
    }

    // Step 3: Ship selection carousel with stat bars + live shot preview + run modifiers + tutorial toggle
    this._previewShotTimer?.remove(false);
    const ship = SHIP_OPTIONS[this._selectedShipId - 1] ?? SHIP_OPTIONS[0];
    this._stepIndicatorText.setText("ETAPE 3 / 3  ·  VAISSEAU & OPTIONS");
    this._navHintText.setText(
      "← → VAISSEAU  ·  SPACE LANCER  ·  ESC RETOUR",
    );

    const elements: GameObjects.GameObject[] = [];
    const header = this.add
      .text(cx, 225, "CHOISISSEZ VOTRE VAISSEAU", {
        fontSize: "40px",
        color: "#ffffff",
        fontFamily: "future",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    elements.push(header);

    const cardY = 665;
    const card = this.add
      .rectangle(cx, cardY, 740, 620, 0x161229, 0.92)
      .setStrokeStyle(7, ship.accentHex, 1);

    const shipPreviewY = cardY - 165;
    const sprite = this.add
      .image(cx, shipPreviewY, GameConstants.TextureKeys.SPRITES, ship.frame)
      .setAngle(-90)
      .setScale(1.55);

    // Live weapon shot preview!
    const previewDelay = ship.id === 2 ? 260 : ship.id === 3 ? 520 : 380;
    this._previewShotTimer = this.time.addEvent({
      delay: previewDelay,
      loop: true,
      callback: () => {
        if (this._step !== "ship") return;
        const offsets = ship.id === 2 ? [-18, 18] : [0];
        const bw = ship.id === 3 ? 10 : 6;
        const bh = ship.id === 3 ? 24 : 16;
        for (const ox of offsets) {
          const bolt = this.add
            .rectangle(cx + ox, shipPreviewY - 62, bw, bh, ship.accentHex, 1)
            .setStrokeStyle(1.5, 0xffffff, 0.9)
            .setDepth(50);
          this.tweens.add({
            targets: bolt,
            y: shipPreviewY - 165,
            alpha: 0,
            duration: 260,
            onComplete: () => bolt.destroy(),
          });
        }
      },
    });

    const shipName = this.add
      .text(cx, cardY - 52, ship.name, {
        fontSize: "48px",
        color: ship.accent,
        fontFamily: "future",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const role = this.add
      .text(cx, cardY + 2, ship.role, {
        fontSize: "19px",
        color: "#e0e6ff",
        fontFamily: "future",
        align: "center",
      })
      .setOrigin(0.5);

    elements.push(card, sprite, shipName, role);

    // Stat bars
    const statRows: { label: string; value: number }[] = [
      { label: "VITESSE", value: ship.stats.speed },
      { label: "DEGATS ", value: ship.stats.damage },
      { label: "CADENCE", value: ship.stats.fireRate },
      { label: "VIE    ", value: ship.stats.hp },
    ];
    statRows.forEach((row, idx) => {
      const ry = cardY + 72 + idx * 48;
      const lbl = this.add
        .text(cx - 290, ry, row.label, {
          fontSize: "20px",
          color: "#cccccc",
          fontFamily: "future",
        })
        .setOrigin(0, 0.5);

      const bg = this.add
        .rectangle(cx - 110, ry, 380, 20, 0x2a2445, 1)
        .setOrigin(0, 0.5);
      const fill = this.add
        .rectangle(cx - 110, ry, 380 * row.value, 20, ship.accentHex, 1)
        .setOrigin(0, 0.5);
      elements.push(lbl, bg, fill);
    });

    const leftArrow = this.add
      .text(95, cardY, "◀", {
        fontSize: "84px",
        color: "#ffffff",
        fontFamily: "future",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    leftArrow.on("pointerdown", () => this.handleHorizontal(-1));

    const rightArrow = this.add
      .text(this.scale.width - 95, cardY, "▶", {
        fontSize: "84px",
        color: "#ffffff",
        fontFamily: "future",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    rightArrow.on("pointerdown", () => this.handleHorizontal(1));
    elements.push(leftArrow, rightArrow);

    // Run Modifiers selector
    const modHeader = this.add
      .text(cx, 1055, "MODIFICATEURS DE RUN (OPTIONNEL)", {
        fontSize: "22px",
        color: "#cccccc",
        fontFamily: "future",
      })
      .setOrigin(0.5);
    elements.push(modHeader);

    const modY = 1145;
    const modSpacing = 290;
    RUN_MODIFIERS.forEach((mod, idx) => {
      const mx = cx + (idx - 1) * modSpacing;
      const isOn = this._selectedModifiers.has(mod.id);
      const mBox = this.add
        .rectangle(mx, modY, 270, 108, isOn ? 0x2b1e4a : 0x161229, isOn ? 0.96 : 0.78)
        .setStrokeStyle(isOn ? 5 : 2, isOn ? mod.accentHex : 0x444466, 1)
        .setInteractive({ useHandCursor: true });
      mBox.on("pointerdown", () => {
        if (this._selectedModifiers.has(mod.id)) {
          this._selectedModifiers.delete(mod.id);
        } else {
          this._selectedModifiers.add(mod.id);
        }
        this.showStep("ship", 0, true);
      });

      const mTitle = this.add
        .text(mx, modY - 22, `${isOn ? "✓ " : ""}${mod.label}`, {
          fontSize: "20px",
          color: isOn ? mod.accentColor : "#ffffff",
          fontFamily: "future",
        })
        .setOrigin(0.5);

      const mDesc = this.add
        .text(mx, modY + 18, mod.shortDesc, {
          fontSize: "13px",
          color: "#d0d6ff",
          fontFamily: "future",
          align: "center",
        })
        .setOrigin(0.5);

      elements.push(mBox, mTitle, mDesc);
    });

    // Tutorial toggle button
    const tutoY = 1315;
    const tutoBox = this.add
      .rectangle(
        cx,
        tutoY,
        480,
        74,
        this._tutorialEnabled ? 0x1c3542 : 0x161229,
        0.92,
      )
      .setStrokeStyle(3, this._tutorialEnabled ? 0x4cc9f0 : 0x555577, 1)
      .setInteractive({ useHandCursor: true });
    tutoBox.on("pointerdown", () => {
      this._tutorialEnabled = !this._tutorialEnabled;
      this.showStep("ship", 0, true);
    });
    const tutoLabel = this.add
      .text(
        cx,
        tutoY,
        `TUTORIEL AVANT VAGUE 1 : ${this._tutorialEnabled ? "OUI" : "NON"}`,
        {
          fontSize: "22px",
          color: this._tutorialEnabled ? "#4cc9f0" : "#aaaaaa",
          fontFamily: "future",
        },
      )
      .setOrigin(0.5);
    elements.push(tutoBox, tutoLabel);

    const launchBtn = this.add
      .text(cx, h - 195, "LANCER LA MISSION  [SPACE]", {
        fontSize: "38px",
        color: "#ffe066",
        fontFamily: "future",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    launchBtn.on("pointerdown", () => this.handleConfirm());
    elements.push(launchBtn);

    return this.add.container(0, 0, elements);
  }

  private openBestiaryDetail(entry: BestiaryEntry): void {
    this._detailModal?.destroy();

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const borderCol =
      entry.category === "BOSS FINAL"
        ? 0xffd166
        : entry.category === "BOSS"
          ? 0xff4d6d
          : 0x4cc9f0;

    const dim = this.add
      .rectangle(cx, cy, this.scale.width, this.scale.height, 0x05030d, 0.82)
      .setInteractive();
    const box = this.add
      .rectangle(cx, cy, 820, 740, 0x161229, 0.98)
      .setStrokeStyle(6, borderCol, 1);

    const catTxt = this.add
      .text(cx, cy - 310, entry.category, {
        fontSize: "24px",
        color:
          entry.category === "BOSS FINAL"
            ? "#ffd166"
            : entry.category === "BOSS"
              ? "#ff4d6d"
              : "#4cc9f0",
        fontFamily: "future",
      })
      .setOrigin(0.5);

    const nameTxt = this.add
      .text(cx, cy - 250, entry.name, {
        fontSize: "48px",
        color: "#ffffff",
        fontFamily: "future",
        stroke: "#000000",
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    const sprite = this.add
      .image(
        cx,
        cy - 105,
        GameConstants.TextureKeys.SPRITES,
        GameConstants.SpriteFrames.ENEMY_UFO,
      )
      .setScale(entry.scale * 1.45);
    if (entry.tint !== 0xffffff) {
      sprite.setTint(entry.tint);
    }

    const statsBox = this.add
      .rectangle(cx, cy + 55, 740, 74, 0x221b3d, 0.92)
      .setStrokeStyle(2, borderCol, 0.7);
    const statsTxt = this.add
      .text(cx, cy + 55, entry.statsText, {
        fontSize: "21px",
        color: "#ffe066",
        fontFamily: "future",
        align: "center",
      })
      .setOrigin(0.5);

    const abilitiesHeader = this.add
      .text(cx, cy + 135, "CAPACITES & COMPORTEMENT", {
        fontSize: "20px",
        color: "#9aa5ce",
        fontFamily: "future",
      })
      .setOrigin(0.5);

    const abilitiesTxt = this.add
      .text(cx, cy + 215, entry.abilitiesText, {
        fontSize: "22px",
        color: "#e0e6ff",
        fontFamily: "future",
        align: "center",
        lineSpacing: 12,
        wordWrap: { width: 720 },
      })
      .setOrigin(0.5);

    const closeBtn = this.add
      .text(cx, cy + 315, "FERMER  [ESC / CLIC]", {
        fontSize: "26px",
        color: "#4cc9f0",
        fontFamily: "future",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const close = () => {
      this._detailModal?.destroy();
      this._detailModal = undefined;
    };
    closeBtn.on("pointerdown", close);
    dim.on("pointerdown", close);

    this._detailModal = this.add
      .container(0, 0, [
        dim,
        box,
        catTxt,
        nameTxt,
        sprite,
        statsBox,
        statsTxt,
        abilitiesHeader,
        abilitiesTxt,
        closeBtn,
      ])
      .setDepth(250);
  }

  private resetTheme(): void {
    this._dangerPulseTween?.stop();
    this._nightmareShakeTimer?.remove(false);
    this._dangerBorder.setVisible(false).setAlpha(0.9);
    this._bg.clearTint();
    this._themeOverlay.setFillStyle(0x000000, 0);
  }

  private applyDifficultyTheme(id: DifficultyId): void {
    this.resetTheme();

    if (id === "gros_bebe") {
      this._bg.setTint(0xffc6e5);
      this._themeOverlay.setFillStyle(0xffb3d9, 0.34);
      return;
    }

    if (id === "cauchemar") {
      this._bg.setTint(0xff2244);
      this._themeOverlay.setFillStyle(0x990018, 0.36);
      this._dangerBorder.setVisible(true);
      this._dangerPulseTween = this.tweens.add({
        targets: this._dangerBorder,
        alpha: { from: 0.95, to: 0.25 },
        duration: 280,
        yoyo: true,
        repeat: -1,
      });
      this._nightmareShakeTimer = this.time.addEvent({
        delay: 950,
        callback: () => this.cameras.main.shake(140, 0.006),
        loop: true,
      });
    }
  }

  private launchGame(): void {
    if (this._isTransitioning) return;
    this._isTransitioning = true;

    const diff = DIFFICULTIES[this._selectedDifficultyIndex];
    this.registry.set(
      RegistryConstants.Keys.SELECTED_SHIP,
      this._selectedShipId,
    );
    this.registry.set(RegistryConstants.Keys.SELECTED_MODE, this._selectedMode);
    this.registry.set(RegistryConstants.Keys.SELECTED_DIFFICULTY, diff.id);
    this.registry.set(
      RegistryConstants.Keys.RUN_MODIFIERS,
      Array.from(this._selectedModifiers),
    );
    this.registry.set(
      RegistryConstants.Keys.TUTORIAL_ENABLED,
      this._tutorialEnabled,
    );
    this.registry.set(RegistryConstants.Keys.VICTORY, false);
    this._previewShotTimer?.remove(false);

    // Warp speed transition into the game!
    this.tweens.add({
      targets: this,
      _warpSpeed: 7,
      duration: 380,
      ease: "Quad.easeIn",
    });
    this.cameras.main.fadeOut(380, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      (this as unknown as { soundManager?: SoundManager }).soundManager?.stopMusic();
      this.scene.launch(GameConstants.SceneKeys.MAIN_UI);
      this.scene.start(GameConstants.SceneKeys.MAIN_GAME);
    });
  }

  update(_time: number, delta: number): void {
    const isNightmare =
      (this._step === "difficulty" || this._step === "ship") &&
      DIFFICULTIES[this._selectedDifficultyIndex]?.id === "cauchemar";
    const mult = this._warpSpeed * (isNightmare ? 2.4 : 1);

    this._bg.tilePositionY -= 0.08 * mult * delta;
    this._planet.y += 0.03 * mult * delta;
    if (this._planet.y > this.scale.height + 400) {
      this._planet.y = -400;
    }

    for (const star of this._stars) {
      star.rect.y += star.speed * mult * delta;
      star.rect.scaleY = this._warpSpeed > 2 ? 5 : 1;
      if (star.rect.y > this.scale.height + 20) {
        star.rect.y = -20;
        star.rect.x = Phaser.Math.Between(0, this.scale.width);
      }
    }
  }
}
