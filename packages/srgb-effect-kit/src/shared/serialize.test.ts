import { describe, expect, it } from 'vitest';
import { escapeAttr, serializeHead, serializeMeter, serializeProperty } from './serialize';

describe('serializeProperty', () => {
  it('serializes each control type with SignalRGB attribute order', () => {
    expect(
      serializeProperty({
        property: 'speed',
        type: 'number',
        label: 'Speed',
        min: 0,
        max: 100,
        default: 50,
        tooltip: 'How fast',
      }),
    ).toBe(
      '<meta property="speed" label="Speed" type="number" min="0" max="100" default="50" tooltip="How fast" />',
    );
    expect(serializeProperty({ property: 'h', type: 'hue', label: 'Hue', default: 120 })).toBe(
      '<meta property="h" label="Hue" type="hue" min="0" max="360" default="120" />',
    );
    expect(serializeProperty({ property: 'b', type: 'boolean', label: 'B', default: true })).toBe(
      '<meta property="b" label="B" type="boolean" default="1" />',
    );
    expect(serializeProperty({ property: 'b', type: 'boolean', label: 'B', default: false })).toBe(
      '<meta property="b" label="B" type="boolean" default="0" />',
    );
    expect(
      serializeProperty({ property: 'c', type: 'color', label: 'C', default: '#009bde' }),
    ).toBe('<meta property="c" label="C" type="color" min="0" max="360" default="#009bde" />');
    expect(serializeProperty({ property: 't', type: 'textfield', label: 'T', default: '' })).toBe(
      '<meta property="t" label="T" type="textfield" default="" />',
    );
    expect(
      serializeProperty({
        property: 'l',
        type: 'list',
        label: 'L',
        values: ['A', 'B c'],
        default: 'B c',
      }),
    ).toBe('<meta property="l" label="L" type="list" values="A,B c" default="B c" />');
  });

  it('escapes special characters', () => {
    expect(escapeAttr(`a"b&c<d>e`)).toBe('a&quot;b&amp;c&lt;d&gt;e');
    expect(
      serializeProperty({
        property: 'l',
        type: 'list',
        label: 'Say "hi" & <go>',
        values: ['<a>', 'b&c'],
        default: 'b&c',
      }),
    ).toBe(
      '<meta property="l" label="Say &quot;hi&quot; &amp; &lt;go&gt;" type="list" values="&lt;a&gt;,b&amp;c" default="b&amp;c" />',
    );
  });
});

describe('serializeMeter', () => {
  it('serializes linear meters with tags and hdr', () => {
    expect(
      serializeMeter({
        meter: 'health',
        type: 'linear',
        tags: ['vlc', 'fortnite'],
        x: 0.05,
        y: 0.9,
        width: 0.189,
        h: [70, 140],
        s: [40, 100],
        l: [40, 100],
        hdr: { h: [0, 60], s: [80, 100], l: [80, 100] },
      }),
    ).toBe(
      '<meta meter="health" type="linear" tags="vlc,fortnite" x="0.05" y="0.9" width="0.189" h="70-140" s="40-100" l="40-100" hdr-h="0-60" hdr-s="80-100" hdr-l="80-100" />',
    );
  });

  it('serializes area and OCR meters with default confidence', () => {
    expect(
      serializeMeter({
        meter: 'a',
        type: 'area',
        x: 0,
        y: 0,
        width: 0.1,
        height: 0.2,
        h: [0, 1],
        s: [2, 3],
        l: [4, 5],
      }),
    ).toBe(
      '<meta meter="a" type="area" x="0" y="0" width="0.1" height="0.2" h="0-1" s="2-3" l="4-5" />',
    );
    expect(
      serializeMeter({
        meter: 't',
        type: 'ocr_textmatch',
        x: 0,
        y: 0,
        width: 0.1,
        height: 0.1,
        string: 'GO',
      }),
    ).toBe(
      '<meta meter="t" type="ocr_textmatch" x="0" y="0" width="0.1" height="0.1" string="GO" confidence="70" />',
    );
    expect(
      serializeMeter({
        meter: 'n',
        type: 'ocr_numeric',
        x: 0,
        y: 0,
        width: 0.1,
        height: 0.1,
        confidence: 90,
      }),
    ).toBe(
      '<meta meter="n" type="ocr_numeric" x="0" y="0" width="0.1" height="0.1" confidence="90" />',
    );
  });

  it('writes non-void meta with resolution children', () => {
    expect(
      serializeMeter({
        meter: 'm',
        type: 'linear',
        x: 0.1,
        y: 0.2,
        width: 0.3,
        h: [0, 1],
        s: [0, 1],
        l: [0, 1],
        resolutions: [
          { size: '1920x1080', x: 0.0557, width: 0.199 },
          { aspect: '21:9', y: 0.5 },
        ],
      }),
    ).toBe(
      [
        '<meta meter="m" type="linear" x="0.1" y="0.2" width="0.3" h="0-1" s="0-1" l="0-1">',
        '  <resolution size="1920x1080" x="0.0557" width="0.199" />',
        '  <resolution aspect="21:9" y="0.5" />',
        '</meta>',
      ].join('\n'),
    );
  });
});

describe('serializeHead', () => {
  it('emits title, description, publisher, properties then meters', () => {
    expect(
      serializeHead({
        title: 'A & B',
        description: 'Desc "q"',
        publisher: 'me',
        properties: [{ property: 'b', type: 'boolean', label: 'B', default: false }],
        meters: [{ meter: 'n', type: 'ocr_numeric', x: 0, y: 0, width: 0.1, height: 0.1 }],
      }),
    ).toBe(
      [
        '<title>A &amp; B</title>',
        '<meta description="Desc &quot;q&quot;" />',
        '<meta publisher="me" />',
        '<meta property="b" label="B" type="boolean" default="0" />',
        '<meta meter="n" type="ocr_numeric" x="0" y="0" width="0.1" height="0.1" confidence="70" />',
      ].join('\n'),
    );
  });

  it('omits missing optional metadata', () => {
    expect(serializeHead({ title: 'Only' })).toBe('<title>Only</title>');
  });
});
