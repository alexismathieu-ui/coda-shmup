export default class SaveConstants {
    public static readonly Keys = Object.freeze({
        PLAYER_BEST_SCORE: 'playerBestScore',
        UNLOCKED_ACHIEVEMENTS: 'unlockedAchievements',
        DISCOVERED_ENEMIES: 'discoveredEnemies',
        MUSIC_VOLUME: 'musicVolume',
    } as const);
}