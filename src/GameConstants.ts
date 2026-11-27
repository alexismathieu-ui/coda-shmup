export default class GameConstants {
    public static readonly Events = Object.freeze({
        PLAYER_SPAWNED_EVENT: "playerSpawned",
        ENEMY_SPAWNED_EVENT: "enemySpawned",
        BOSS_SPAWNED_EVENT: "bossSpawned",
        BOSS_HEALTH_CHANGED: "bossHealthChanged",
        BOSS_DEFEATED_EVENT: "bossDefeated",
        BANNER_EVENT: "bannerEvent",
        PLAYER_SHIELD_CHANGED: "playerShieldChanged",
        PLAYER_DASH_COOLDOWN: "playerDashCooldown",
        PLAYER_BOMB_CHANGED: "playerBombChanged",
        PLAYER_WEAPON_LEVEL_CHANGED: "playerWeaponLevelChanged",
        COMBO_CHANGED: "comboChanged",
        WAVE_CHANGED: "waveChanged",
        PAUSE_TOGGLED: "pauseToggled",
        MUTE_TOGGLED: "muteToggled",
        ROGUELITE_OFFER_CARDS: "rogueliteOfferCards",
        ROGUELITE_CARD_CHOSEN: "rogueliteCardChosen",
        OVERDRIVE_CHANGED: "overdriveChanged",
        WAVE_PROGRESS_CHANGED: "waveProgressChanged",
        TUTORIAL_PROMPT: "tutorialPrompt",
        ACHIEVEMENT_UNLOCKED: "achievementUnlocked",
        RETURN_TO_MENU: "returnToMenu",
        MUSIC_VOLUME_CHANGED: "musicVolumeChanged",
        CHEAT_ACTION: "cheatAction",
    } as const);

    public static readonly SceneKeys = Object.freeze({
        HOME: "HomeScene",
        MAIN_GAME: "MainGameScene",
        MAIN_UI: "MainUIScene",
        GAME_OVER: "GameOverScene",
        GROS_BEBE: "GrosBebeScene",
    } as const);

    public static readonly CacheKeys = Object.freeze({
        PLAYER_SHIPS: "playerShips",
        SINUSOIDAL_ENEMY: "sinusoidalEnemy",
        ENEMIES: "enemies",
        BOSSES: "bosses",
    } as const);

    public static readonly TextureKeys = Object.freeze({
        SPRITES: "sprites",
    } as const);

    public static readonly SpriteFrames = Object.freeze({
        ENEMY_UFO: "ufoRed",
        ENEMY_UFO_SHOOT_0: "ufoRed-shoot0",
        ENEMY_UFO_SHOOT_1: "ufoRed-shoot1",
        STAR_1: "star1",
        STAR_2: "star2",
        STAR_3: "star3",
        PLAYER_LIFE: "playerLife1_blue",
    } as const);

    public static readonly AnimKeys = Object.freeze({
        UFO_SHOOT: "ufoShoot",
    } as const);

    public static readonly SoundKeys = Object.freeze({
        PLAYER_LASER: "sfx_laser1",
        ENEMY_LASER: "sfx_laser2",
    } as const);

    public static readonly Colors = Object.freeze({
        HIT_FLASH: 0xffffff,
    } as const);

    public static readonly Pools = Object.freeze({
        PLAYER_BULLETS_MAX_SIZE: 256,
        PLAYER_BULLETS_INITIAL_SIZE: 96,
        ENEMY_BULLETS_MAX_SIZE: 640,
        ARCADE_ENEMIES_POOL_SIZE: 50,
        POWERUPS_POOL_SIZE: 20,
        METEORS_POOL_SIZE: 20,
    } as const);

    public static readonly MAX_SCORE_DIGITS: number = 6;
}