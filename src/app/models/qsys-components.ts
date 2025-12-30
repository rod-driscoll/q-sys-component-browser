import { signal, Signal, computed } from '@angular/core';
import { QSysService } from '../services/qsys.service';

/**
 * Base class for Q-SYS controls with reactive signals
 */
export abstract class QSysControlBase<T> {
  protected _value = signal<T | undefined>(undefined);
  public readonly value: Signal<T | undefined> = this._value.asReadonly();

  constructor(
    protected qsysService: QSysService,
    protected componentName: string,
    protected controlName: string
  ) {
    this.initialize();
  }

  protected initialize(): void {
    // Subscribe to control updates
    this.qsysService.getControlUpdates().subscribe((update) => {
      if (update.component === this.componentName && update.control === this.controlName) {
        this.updateValue(update.value);
      }
    });
  }

  protected abstract updateValue(value: any): void;
}

/**
 * Text/String control
 */
export class TextControl extends QSysControlBase<string> {
  public readonly string = computed(() => this.value() || '');

  protected updateValue(value: any): void {
    this._value.set(String(value));
  }

  setValue(value: string): void {
    this.qsysService.setControl(this.componentName, this.controlName, value);
  }
}

/**
 * Boolean control
 */
export class BooleanControl extends QSysControlBase<boolean> {
  public readonly state = computed(() => this.value() || false);

  protected updateValue(value: any): void {
    this._value.set(Boolean(value));
  }

  setState(value: boolean): void {
    this.qsysService.setControl(this.componentName, this.controlName, value ? 1 : 0);
  }

  toggle(): void {
    this.setState(!this.state());
  }
}

/**
 * Button control (optimized Boolean for UI buttons)
 */
export class ButtonControl extends BooleanControl {
  press(): void {
    this.setState(true);
  }

  release(): void {
    this.setState(false);
  }
}

/**
 * Trigger control
 */
export class TriggerControl {
  constructor(
    protected qsysService: QSysService,
    protected componentName: string,
    protected controlName: string
  ) { }

  trigger(): void {
    // Set to 1 (trigger), Q-SYS will automatically reset to 0
    this.qsysService.setControl(this.componentName, this.controlName, 1);
  }
}

/**
 * Knob/Float control
 */
export class KnobControl extends QSysControlBase<number> {
  private _position = signal<number | undefined>(undefined);
  private _string = signal<string>('');

  public readonly position = this._position.asReadonly();
  public readonly string = this._string.asReadonly();

  protected updateValue(value: any): void {
    this._value.set(Number(value));
  }

  setValue(value: number, ramp?: number): void {
    console.log("Setting control value:", this.componentName, this.controlName, value, ramp);
    this.qsysService.setControl(this.componentName, this.controlName, value, ramp);
  }

  setPosition(position: number, ramp?: number): void {
    console.log("Setting control position:", this.componentName, this.controlName, position, ramp);
    this.qsysService.setControl(this.componentName, this.controlName, position, ramp);
  }
}

/**
 * Integer control
 */
export class IntegerControl extends QSysControlBase<number> {
  protected updateValue(value: any): void {
    this._value.set(Math.floor(Number(value)));
  }

  setValue(value: number): void {
    this.qsysService.setControl(this.componentName, this.controlName, Math.floor(value));
  }
}

/**
 * Component wrapper to access controls
 */
export class QSysComponent {
  constructor(private qsysService: QSysService, private componentName: string) { }

  /**
   * Get a text control
   */
  useText(controlName: string): TextControl {
    return new TextControl(this.qsysService, this.componentName, controlName);
  }

  /**
   * Get a boolean control
   */
  useBoolean(controlName: string): BooleanControl {
    return new BooleanControl(this.qsysService, this.componentName, controlName);
  }

  /**
   * Get a button control
   */
  useButton(controlName: string): ButtonControl {
    return new ButtonControl(this.qsysService, this.componentName, controlName);
  }

  /**
   * Get a trigger control
   */
  useTrigger(controlName: string): TriggerControl {
    return new TriggerControl(this.qsysService, this.componentName, controlName);
  }

  /**
   * Get a knob/float control
   */
  useKnob(controlName: string): KnobControl {
    return new KnobControl(this.qsysService, this.componentName, controlName);
  }

  /**
   * Get an integer control
   */
  useInteger(controlName: string): IntegerControl {
    return new IntegerControl(this.qsysService, this.componentName, controlName);
  }
}
