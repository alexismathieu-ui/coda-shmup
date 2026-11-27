export default class GameConstants {
    public static readonly Events = Object.freeze({
        PLAYER_SPAWNED_EVENT: "playerSpawned",
        ENEMY_SPAWNED_EVENT: "enemySpawned",
    } as const);

    public static readonly SceneKeys = Object.freeze({
        HOME: "HomeScene",
        MAIN_GAME: "MainGameScene",
        MAIN_UI: "MainUIScene",
        GAME_OVER: "GameOverScene",
    } as const);

    public static readonly CacheKeys = Object.freeze({
        PLAYER_SHIPS: "playerShips",
        SINUSOIDAL_ENEMY: "sinusoidalEnemy",
    } as const);

    public static readonly TextureKeys = Object.freeze({
        SPRITES: "sprites",
    } as const);

    public static readonly SpriteFrames = Object.freeze({
        ENEMY_UFO: "ufoRed",
        ENEMY_UFO_SHOOT_0: "ufoRed-shoot0",
        ENEMY_UFO_SHOOT_1: "ufoRed-shoot1",
    } as const);

    public static readonly AnimKeys = Object.freeze({
        UFO_SHOOT: "ufoShoot",
    } as const);

    public static readonly SoundKeys = Object.freeze({
        ENEMY_LASER: "sfx_laser2",
    } as const);

    public static readonly Colors = Object.freeze({
        HIT_FLASH: 0xffffff,
    } as const);

    public static readonly Pools = Object.freeze({
        PLAYER_BULLETS_MAX_SIZE: 256,
        PLAYER_BULLETS_INITIAL_SIZE: 64,
        ENEMY_BULLETS_MAX_SIZE: 512,
    } as const);

    public static readonly MAX_SCORE_DIGITS: number = 6;
}