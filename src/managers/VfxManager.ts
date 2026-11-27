import {Plugins, Scene} from "phaser";
import GameConstants from "../GameConstants.ts";

export default class VfxManager extends Plugins.ScenePlugin {
    public static readonly PLUGIN_KEY: string = 'VfxManager';
    public static readonly MAPPING_NAME: string = 'vfxManager';

    private static readonly STAR_FRAMES: readonly string[] = [
        GameConstants.SpriteFrames.STAR_1,
        GameConstants.SpriteFrames.STAR_2,
        GameConstants.SpriteFrames.STAR_3,
    ];

    constructor(scene: Scene, pluginManager: Plugins.PluginManager) {
        super(scene, pluginManager, VfxManager.PLUGIN_KEY);
    }

    public spawnExplosion(x: number, y: number, color: number = 0xffe066, scale: number = 1): void {
        const scene = this.scene;
        if (!scene) return;

        // Expanding shockwave ring
        const ring = scene.add.circle(x, y, 16 * scale, color, 0)
            .setStrokeStyle(5 * scale, color, 0.9)
            .setDepth(45);
        scene.tweens.add({
            targets: ring,
            scale: 4.5,
            alpha: 0,
            duration: 360,
            ease: 'Cubic.easeOut',
            onComplete: () => ring.destroy(),
        });

        // Core flash
        const flash = scene.add.circle(x, y, 24 * scale, 0xffffff, 0.9).setDepth(46);
        scene.tweens.add({
            targets: flash,
            scale: 2.2,
            alpha: 0,
            duration: 180,
            ease: 'Quad.easeOut',
            onComplete: () => flash.destroy(),
        });

        // Star particles burst using existing Kenney atlas frames
        const particleCount = Math.min(20, Math.max(6, Math.round(9 * scale)));
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount + Phaser.Math.FloatBetween(-0.25, 0.25);
            const distance = Phaser.Math.FloatBetween(60, 170) * scale;
            const frame = VfxManager.STAR_FRAMES[i % VfxManager.STAR_FRAMES.length];
            const star = scene.add.image(x, y, GameConstants.TextureKeys.SPRITES, frame)
                .setTint(i % 3 === 0 ? 0xffffff : color)
                .setScale(Phaser.Math.FloatBetween(0.7, 1.5) * scale)
                .setDepth(44);

            scene.tweens.add({
                targets: star,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                angle: Phaser.Math.Between(-240, 240),
                scale: 0,
                alpha: 0,
                duration: Phaser.Math.Between(320, 580),
                ease: 'Cubic.easeOut',
                onComplete: () => star.destroy(),
            });
        }
    }

    public spawnHitSpark(x: number, y: number, color: number = 0xffffff): void {
        const scene = this.scene;
        if (!scene) return;

        for (let i = 0; i < 4; i++) {
            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const dist = Phaser.Math.FloatBetween(24, 58);
            const spark = scene.add.rectangle(x, y, 8, 3, color)
                .setRotation(angle)
                .setDepth(42);
            scene.tweens.add({
                targets: spark,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                alpha: 0,
                scaleX: 0.2,
                duration: 160,
                ease: 'Quad.easeOut',
                onComplete: () => spark.destroy(),
            });
        }
    }

    public spawnMuzzleFlash(x: number, y: number, color: number = 0xffe066): void {
        const scene = this.scene;
        if (!scene) return;

        const flash = scene.add.circle(x, y, 11, color, 0.85).setDepth(35);
        scene.tweens.add({
            targets: flash,
            scale: 1.8,
            alpha: 0,
            duration: 90,
            ease: 'Quad.easeOut',
            onComplete: () => flash.destroy(),
        });
    }

    public spawnDashGhost(x: number, y: number, frame: string, angle: number, tint: number = 0x4cc9f0): void {
        const scene = this.scene;
        if (!scene) return;

        const ghost = scene.add.image(x, y, GameConstants.TextureKeys.SPRITES, frame)
            .setAngle(angle)
            .setTint(tint)
            .setAlpha(0.55)
            .setDepth(15);

        scene.tweens.add({
            targets: ghost,
            alpha: 0,
            scale: 0.82,
            duration: 240,
            ease: 'Quad.easeOut',
            onComplete: () => ghost.destroy(),
        });
    }

    public spawnEmpWave(x: number, y: number): void {
        const scene = this.scene;
        if (!scene) return;

        const wave = scene.add.circle(x, y, 36, 0x4cc9f0, 0.12)
            .setStrokeStyle(14, 0x4cc9f0, 0.95)
            .setDepth(60);

        scene.tweens.add({
            targets: wave,
            scale: 32,
            alpha: 0,
            duration: 620,
            ease: 'Cubic.easeOut',
            onComplete: () => wave.destroy(),
        });

        scene.cameras.main.flash(220, 76, 201, 240, true);
        scene.cameras.main.shake(260, 0.018);
    }

    public spawnFloatingText(x: number, y: number, message: string, color: string = '#ffffff', fontSize: number = 34): void {
        const scene = this.scene;
        if (!scene) return;

        const text = scene.add.text(x, y, message, {
            fontFamily: 'future',
            fontSize: `${fontSize}px`,
            color,
            stroke: '#000000',
            strokeThickness: 6,
        }).setOrigin(0.5).setDepth(70);

        scene.tweens.add({
            targets: text,
            y: y - 76,
            alpha: 0,
            scale: 1.15,
            duration: 720,
            ease: 'Cubic.easeOut',
            onComplete: () => text.destroy(),
        });
    }

    public triggerHitstop(durationMs: number = 45): void {
        const scene = this.scene;
        if (!scene || !scene.physics?.world) return;

        scene.physics.world.timeScale = 5;
        scene.time.delayedCall(durationMs, () => {
            if (scene.physics?.world) {
                scene.physics.world.timeScale = 1;
            }
        });
    }

    public playBossDeathSequence(x: number, y: number, color: number, onComplete?: () => void): void {
        const scene = this.scene;
        if (!scene) return;

        scene.physics.world.timeScale = 2.5;
        scene.cameras.main.shake(900, 0.02);

        for (let i = 0; i < 6; i++) {
            scene.time.delayedCall(i * 130, () => {
                const ox = x + Phaser.Math.Between(-90, 90);
                const oy = y + Phaser.Math.Between(-90, 90);
                this.spawnExplosion(ox, oy, i % 2 === 0 ? color : 0xffe066, 1.4);
            });
        }

        scene.time.delayedCall(820, () => {
            this.spawnExplosion(x, y, 0xffffff, 2.6);
            scene.cameras.main.flash(350, 255, 255, 255, true);
            if (scene.physics?.world) {
                scene.physics.world.timeScale = 1;
            }
            onComplete?.();
        });
    }
}
