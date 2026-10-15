/** Inclusive `[min, max]` range, serialized as `"min-max"`. */
export type Range = readonly [min: number, max: number];

interface BaseProperty<T extends string, D> {
  /** Global variable name SignalRGB injects. */
  property: string;
  type: T;
  label: string;
  default: D;
  tooltip?: string;
}

export interface NumberProperty extends BaseProperty<'number', number> {
  min: number;
  max: number;
}
export interface HueProperty extends BaseProperty<'hue', number> {
  /** @default 0 */
  min?: number;
  /** @default 360 */
  max?: number;
}
export type BooleanProperty = BaseProperty<'boolean', boolean>;
/** `default` is `#rrggbb`. */
export type ColorProperty = BaseProperty<'color', string>;
export type TextfieldProperty = BaseProperty<'textfield', string>;
export interface ListProperty extends BaseProperty<'list', string> {
  values: readonly string[];
}

export type PropertyDef =
  NumberProperty | HueProperty | BooleanProperty | ColorProperty | TextfieldProperty | ListProperty;
export type PropertyType = PropertyDef['type'];

export interface HslRanges {
  /** 0–360 */
  h: Range;
  /** 0–100 */
  s: Range;
  /** 0–100 */
  l: Range;
}

interface ResolutionRegion {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}
export type ResolutionDef = ResolutionRegion &
  (
    | { size: `${number}x${number}`; aspect?: never }
    | { aspect: `${number}:${number}`; size?: never }
  );

interface BaseMeter<T extends string> {
  /** Readable as `engine.vision.<meter>`. */
  meter: string;
  type: T;
  /** Normalized 0–1 from the top-left of the screen. */
  x: number;
  y: number;
  tags?: readonly string[];
  resolutions?: readonly ResolutionDef[];
}

export interface LinearMeter extends BaseMeter<'linear'>, HslRanges {
  width: number;
  hdr?: HslRanges;
}
export interface AreaMeter extends BaseMeter<'area'>, HslRanges {
  width: number;
  height: number;
  hdr?: HslRanges;
}
export interface OcrTextMatchMeter extends BaseMeter<'ocr_textmatch'> {
  width: number;
  height: number;
  string: string;
  /** 0–100, @default 70 */
  confidence?: number;
}
export interface OcrNumericMeter extends BaseMeter<'ocr_numeric'> {
  width: number;
  height: number;
  /** 0–100, @default 70 */
  confidence?: number;
}

export type MeterDef = LinearMeter | AreaMeter | OcrTextMatchMeter | OcrNumericMeter;
export type MeterType = MeterDef['type'];

export interface EffectManifest {
  title: string;
  description?: string;
  publisher?: string;
  properties?: readonly PropertyDef[];
  meters?: readonly MeterDef[];
}
