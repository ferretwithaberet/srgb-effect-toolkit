/** Inclusive `[min, max]` range, serialized as `"min-max"`. */
export type Range = readonly [min: number, max: number];

interface BaseProperty<T extends string, D> {
  /**
   * Global variable name SignalRGB injects. Must be a valid JavaScript identifier that does not
   * collide with a browser or SignalRGB global. Its change handler is `on<Property>Changed`.
   */
  property: string;
  /** Control type. */
  type: T;
  /** Name shown next to the control in SignalRGB. */
  label: string;
  /** Initial value. */
  default: D;
  /** Hover text for the control. */
  tooltip?: string;
}

/** Slider with whole-number `min`, `max` and `default`. The global is a `number`. */
export interface NumberProperty extends BaseProperty<'number', number> {
  min: number;
  max: number;
}
/** Hue slider, `0 ≤ min ≤ default ≤ max ≤ 360`. The global is a `number`. */
export interface HueProperty extends BaseProperty<'hue', number> {
  /** @default 0 */
  min?: number;
  /** @default 360 */
  max?: number;
}
/** Toggle. `default` is serialized as `"1"`/`"0"`; the global is an `SRGBBoolean`. */
export type BooleanProperty = BaseProperty<'boolean', boolean>;
/** Color picker. `default` is `#rrggbb`. The global is a `string`. */
export type ColorProperty = BaseProperty<'color', string>;
/** Text input. `default` may be empty. The global is a `string`. */
export type TextfieldProperty = BaseProperty<'textfield', string>;
/** Dropdown. The global is the union of `values`. */
export interface ListProperty extends BaseProperty<'list', string> {
  /** Options in display order: unique, non-empty, without commas. Must include `default`. */
  values: readonly string[];
}

/** One user control. Array order in `properties` is the order in SignalRGB's UI. */
export type PropertyDef =
  NumberProperty | HueProperty | BooleanProperty | ColorProperty | TextfieldProperty | ListProperty;
/** `'number' | 'hue' | 'boolean' | 'color' | 'textfield' | 'list'` */
export type PropertyType = PropertyDef['type'];

/** Color ranges a pixel must fall in to count toward a `linear` or `area` meter. */
export interface HslRanges {
  /** 0–360 */
  h: Range;
  /** 0–100 */
  s: Range;
  /** 0–100 */
  l: Range;
}

/** Region fields a resolution override replaces; omitted fields keep the meter's own value. */
interface ResolutionRegion {
  x?: number;
  y?: number;
  width?: number;
  /** Not allowed on `linear` meters. */
  height?: number;
}
/**
 * Meter region override for one screen size (`size: '1920x1080'`) or aspect ratio
 * (`aspect: '21:9'`). Exactly one of the two is required.
 */
export type ResolutionDef = ResolutionRegion &
  (
    | { size: `${number}x${number}`; aspect?: never }
    | { aspect: `${number}:${number}`; size?: never }
  );

interface BaseMeter<T extends string> {
  /** Readable as `engine.vision.<meter>`. A unique, valid JavaScript identifier. */
  meter: string;
  /** Meter type. */
  type: T;
  /** Normalized 0–1 from the left edge of the screen. `x + width` must be ≤ 1. */
  x: number;
  /** Normalized 0–1 from the top edge of the screen. `y + height` must be ≤ 1. */
  y: number;
  /** Serialized comma-separated, so tags must not contain commas. */
  tags?: readonly string[];
  /** Region overrides per screen size or aspect ratio. */
  resolutions?: readonly ResolutionDef[];
}

/** Single row of pixels; the value is the fraction of matching pixels (0–1). */
export interface LinearMeter extends BaseMeter<'linear'>, HslRanges {
  /** Normalized 0–1. */
  width: number;
  /** Alternative ranges for HDR screens, serialized as `hdr-h`, `hdr-s` and `hdr-l`. */
  hdr?: HslRanges;
}
/** Rectangle; the value is the fraction of matching pixels (0–1). */
export interface AreaMeter extends BaseMeter<'area'>, HslRanges {
  /** Normalized 0–1. */
  width: number;
  /** Normalized 0–1. */
  height: number;
  /** Alternative ranges for HDR screens, serialized as `hdr-h`, `hdr-s` and `hdr-l`. */
  hdr?: HslRanges;
}
/** Text recognition; the value is 1 (found), 0 (not found) or -1 (unsure). */
export interface OcrTextMatchMeter extends BaseMeter<'ocr_textmatch'> {
  /** Normalized 0–1. */
  width: number;
  /** Normalized 0–1. */
  height: number;
  /** Text to look for. Must not be empty. */
  string: string;
  /** 0–100, @default 70 */
  confidence?: number;
}
/** Number recognition; the value is the integer read, or -1 when reading fails. */
export interface OcrNumericMeter extends BaseMeter<'ocr_numeric'> {
  /** Normalized 0–1. */
  width: number;
  /** Normalized 0–1. */
  height: number;
  /** 0–100, @default 70 */
  confidence?: number;
}

/** One screen meter. Array order in `meters` is the declaration order in `<head>`. */
export type MeterDef = LinearMeter | AreaMeter | OcrTextMatchMeter | OcrNumericMeter;
/** `'linear' | 'area' | 'ocr_textmatch' | 'ocr_numeric'` */
export type MeterType = MeterDef['type'];

/** Effect metadata, controls and meters, serialized into the effect's `<head>`. */
export interface EffectManifest {
  /** Effect name shown in SignalRGB, written as `<title>`. Must not be empty. */
  title: string;
  /** Written as `<meta description="…" />`. */
  description?: string;
  /** Written as `<meta publisher="…" />`. */
  publisher?: string;
  /** User controls, in UI order. */
  properties?: readonly PropertyDef[];
  /** Screen meters, in declaration order. */
  meters?: readonly MeterDef[];
}
