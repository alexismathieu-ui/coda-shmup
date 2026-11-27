import GameConstants from "../GameConstants.ts";
import AchievementManager from "../managers/AchievementManager.ts";
import RegistryConstants from "../RegistryConstants.ts";

export default class GrosBebeScene extends Phaser.Scene {
    constructor() {
        super(GameConstants.SceneKeys.GROS_BEBE);
    }

    create(): void {
        AchievementManager.unlock(this, 'gros_bebe');
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;

        // Pastel baby background
        this.add.rectangle(cx, cy, this.scale.width, this.scale.height, 0xffd1e8);
        this.add.circle(cx - 280, cy - 520, 220, 0xbde0fe, 0.55);
        this.add.circle(cx + 300, cy + 540, 260, 0xfff3b0, 0.55);

        const img = this.add.image(cx, cy, 'gros_bebe').setOrigin(0.5);
        const targetScale = Math.min((this.scale.width * 0.88) / img.width, (this.scale.height * 0.65) / img.height);
        img.setScale(targetScale * 0.2);

        this.tweens.add({
            targets: img,
            scale: targetScale,
            duration: 220,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: img,
                    scale: targetScale * 1.07,
                    angle: {from: -4, to: 4},
                    duration: 130,
                    yoyo: true,
                    repeat: -1,
                });
            },
        });

        this.cameras.main.shake(450, 0.012);

        let finished = false;
        const returnToMenu = () => {
            if (finished) return;
            finished = true;
            this.registry.set(RegistryConstants.Keys.SELECTED_DIFFICULTY, 'normal');
            this.scene.start(GameConstants.SceneKeys.HOME);
        };

        const laugh = this.sound.add('sfx_gros_bebe', {volume: 1.0});
        laugh.once('complete', returnToMenu);
        laugh.play();

        // Safety fallback in case browser audio playback is blocked
        this.time.delayedCall(6000, returnToMenu);
    }
}
