import Entity from "../entities/Entity.ts";
import type {SinusoidalMovementData} from "../gameData/SinusoidalEnemyData.ts";
import IComponent from "./IComponent.ts";

export default class SinusoidalMovement implements IComponent {
    private static readonly MS_PER_SECOND: number = 1000;
    private static readonly TWO_PI: number = Math.PI * 2;

    public enabled: boolean = true;

    private readonly _verticalSpeed: number;
    private readonly _amplitude: number;
    private readonly _frequency: number;

    private _originX: number = 0;
    private _elapsedTimeMs: number = 0;

    public constructor(config: SinusoidalMovementData) {
        this._verticalSpeed = config.verticalSpeed;
        this._amplitude = config.amplitude;
        this._frequency = config.frequency;
    }

    public reset(originX: number): void {
        this._originX = originX;
        this._elapsedTimeMs = 0;
    }

    public move(entity: Entity, deltaTime: number): void {
        if (!this.enabled) {
            return;
        }

        this._elapsedTimeMs += deltaTime;
        const elapsedSeconds = this._elapsedTimeMs / SinusoidalMovement.MS_PER_SECOND;
        const phase = SinusoidalMovement.TWO_PI * this._frequency * elapsedSeconds;

        entity.x = this._originX + this._amplitude * Math.sin(phase);
        entity.y += this._verticalSpeed * deltaTime;
    }
}
