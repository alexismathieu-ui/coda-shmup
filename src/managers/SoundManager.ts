import {Plugins, Sound} from "phaser";
import GameConstants from "../GameConstants.ts";

export type MusicContext = 'menu' | 'normal' | 'boss' | 'nightmare';

export default class SoundManager extends Plugins.BasePlugin {
    public static readonly PLUGIN_KEY: string = 'SoundManager';
    public static readonly MAPPING_NAME: string = 'soundManager';

    private static readonly TRACK_GAP_MS: number = 3000;
    private static readonly MENU_BASE_VOLUME: number = 0.45;
    private static readonly GAME_BASE_VOLUME: number = 0.16;

    private _ctx: AudioContext | null = null;
    private _muted: boolean = false;
    private _musicVolume: number = 0.3; // 0..1 user slider (30% default)

    // Phaser MP3 playlist state
    private _currentTrack: Sound.BaseSound | null = null;
    private _gapTimeout: number | null = null;
    private _playlist: string[] = [];
    private _playlistIndex: number = 0;

    // Fallback procedural synth state (used for Nightmare until custom MP3 is provided)
    private _synthInterval: number | null = null;
    private _synthStep: number = 0;
    private _musicContext: MusicContext = 'menu';

    public get muted(): boolean {
        return this._muted;
    }

    public get musicVolume(): number {
        return this._musicVolume;
    }

    constructor(pluginManager: Plugins.PluginManager) {
        super(pluginManager);
    }

    public toggleMute(): boolean {
        this._muted = !this._muted;
        this.game.sound.mute = this._muted;
        this.game.events.emit(GameConstants.Events.MUTE_TOGGLED, this._muted);
        return this._muted;
    }

    public setMusicVolume(volume: number): void {
        this._musicVolume = Phaser.Math.Clamp(Math.round(volume * 10) / 10, 0, 1);
        this.applyCurrentTrackVolume();
        this.game.events.emit(GameConstants.Events.MUSIC_VOLUME_CHANGED, this._musicVolume);
    }

    public adjustMusicVolume(delta: number): number {
        this.setMusicVolume(this._musicVolume + delta);
        return this._musicVolume;
    }

    public startMusic(context: MusicContext = 'normal'): void {
        if (this._musicContext === context && (this._currentTrack?.isPlaying || this._synthInterval !== null || this._gapTimeout !== null)) {
            this.applyCurrentTrackVolume();
            return;
        }

        this.stopMusic();
        this._musicContext = context;

        if (context === 'menu') {
            this._playlist = ['music_menu'];
            this._playlistIndex = 0;
            this.playNextInPlaylist();
            return;
        }

        if (context === 'nightmare') {
            // Keep intense procedural soundtrack for Nightmare (until a custom track is added)
            this._synthStep = 0;
            this._synthInterval = window.setInterval(() => {
                if (this._muted || this._musicVolume <= 0) return;
                this.playNightmareStep();
            }, 130);
            return;
        }

        // Standard gameplay (Facile / Normal / Difficile / Boss): alternate the 2 game MP3 tracks in background!
        this._playlist = ['music_game_1', 'music_game_2'];
        this._playlistIndex = Phaser.Math.Between(0, this._playlist.length - 1);
        this.playNextInPlaylist();
    }

    public setMusicMode(context: MusicContext): void {
        // Don't interrupt the 2-track game playlist when switching between normal wave and boss wave
        if ((this._musicContext === 'normal' || this._musicContext === 'boss') && (context === 'normal' || context === 'boss')) {
            this._musicContext = context;
            return;
        }
        this.startMusic(context);
    }

    public stopMusic(): void {
        if (this._gapTimeout !== null) {
            window.clearTimeout(this._gapTimeout);
            this._gapTimeout = null;
        }
        if (this._currentTrack) {
            this._currentTrack.removeAllListeners();
            this._currentTrack.stop();
            this._currentTrack.destroy();
            this._currentTrack = null;
        }
        if (this._synthInterval !== null) {
            window.clearInterval(this._synthInterval);
            this._synthInterval = null;
        }
    }

    private getEffectiveMusicVolume(): number {
        const base = this._musicContext === 'menu'
            ? SoundManager.MENU_BASE_VOLUME
            : SoundManager.GAME_BASE_VOLUME;
        return base * this._musicVolume;
    }

    private applyCurrentTrackVolume(): void {
        if (this._currentTrack && 'setVolume' in this._currentTrack) {
            (this._currentTrack as Sound.WebAudioSound | Sound.HTML5AudioSound).setVolume(this.getEffectiveMusicVolume());
        }
    }

    private playNextInPlaylist(): void {
        if (this._playlist.length === 0) return;

        const key = this._playlist[this._playlistIndex % this._playlist.length];
        if (!this.game.cache.audio.exists(key)) return;

        const track = this.game.sound.add(key, {
            volume: this.getEffectiveMusicVolume(),
            loop: false,
        });
        this._currentTrack = track;

        track.once('complete', () => {
            if (this._currentTrack === track) {
                track.destroy();
                this._currentTrack = null;
            }
            this._playlistIndex = (this._playlistIndex + 1) % this._playlist.length;

            // 3-second quiet gap between tracks as requested!
            this._gapTimeout = window.setTimeout(() => {
                this._gapTimeout = null;
                this.playNextInPlaylist();
            }, SoundManager.TRACK_GAP_MS);
        });

        track.play();
    }

    private playNightmareStep(): void {
        const vol = 0.025 * this._musicVolume;
        const bass = [98, 98, 116.54, 130.81, 146.83, 130.81, 116.54, 110];
        const arp = [392, 466.16, 587.33, 698.46, 587.33, 523.25, 466.16, 440];
        const idx = this._synthStep % 8;

        if (this._synthStep % 2 === 0) {
            const bFreq = bass[idx];
            this.playTone(bFreq, bFreq * 0.98, 0.13, 'sawtooth', vol);
        }
        const aFreq = arp[(this._synthStep + 2) % 8];
        this.playTone(aFreq, aFreq, 0.08, 'triangle', vol * 0.75);
        if (this._synthStep % 4 === 0) {
            this.playTone(130, 42, 0.08, 'sine', vol * 1.4);
        }
        this._synthStep++;
    }

    public playHit(): void {
        this.playTone(320, 140, 0.06, 'square', 0.08);
    }

    public playExplosion(big: boolean = false): void {
        this.playNoise(big ? 0.35 : 0.16, big ? 0.18 : 0.11);
        this.playTone(big ? 120 : 190, 38, big ? 0.32 : 0.15, 'sawtooth', big ? 0.14 : 0.09);
    }

    public playPowerUp(): void {
        this.playTone(520, 660, 0.08, 'triangle', 0.12, 0);
        this.playTone(660, 880, 0.1, 'triangle', 0.12, 0.07);
        this.playTone(880, 1180, 0.14, 'triangle', 0.12, 0.15);
    }

    public playDash(): void {
        this.playTone(680, 220, 0.13, 'sine', 0.11);
    }

    public playEmp(): void {
        this.playTone(440, 60, 0.45, 'sawtooth', 0.16);
        this.playNoise(0.4, 0.16);
    }

    public playShieldBreak(): void {
        this.playTone(800, 180, 0.22, 'sawtooth', 0.12);
    }

    public playWarning(): void {
        this.playTone(440, 560, 0.18, 'square', 0.09, 0);
        this.playTone(440, 560, 0.18, 'square', 0.09, 0.24);
    }

    public playWaveClear(): void {
        this.playTone(440, 554, 0.1, 'triangle', 0.1, 0);
        this.playTone(554, 659, 0.1, 'triangle', 0.1, 0.09);
        this.playTone(659, 880, 0.18, 'triangle', 0.12, 0.18);
    }

    private ensureContext(): AudioContext | null {
        if (this._muted) return null;

        if (!this._ctx) {
            const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
            if (!AudioCtx) return null;
            this._ctx = new AudioCtx();
        }

        if (this._ctx.state === 'suspended') {
            this._ctx.resume().catch(() => {});
        }
        return this._ctx;
    }

    private playTone(
        startFreq: number,
        endFreq: number,
        durationSec: number,
        type: OscillatorType,
        volume: number,
        delaySec: number = 0
    ): void {
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime + delaySec;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + durationSec);

        gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + durationSec + 0.01);
    }

    private playNoise(durationSec: number, volume: number): void {
        const ctx = this.ensureContext();
        if (!ctx) return;

        const sampleCount = Math.floor(ctx.sampleRate * durationSec);
        const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < sampleCount; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + durationSec);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(Math.max(0.0001, volume), ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationSec);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        source.start();
    }
}
