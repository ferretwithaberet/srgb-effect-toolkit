// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { h, rafBatch } from './dom';

describe('h', () => {
  it('sets attributes and appends children as text, never HTML', () => {
    const element = h(
      'button',
      { type: 'button', disabled: true, hidden: false, title: undefined, 'data-n': 3 },
      '<b>label</b>',
      4,
      null,
      h('span'),
    );
    expect(element.outerHTML).toBe(
      '<button type="button" disabled="" data-n="3">&lt;b&gt;label&lt;/b&gt;4<span></span></button>',
    );
  });
});

describe('rafBatch', () => {
  it('runs the update once per frame however often it is scheduled', () => {
    const frames: FrameRequestCallback[] = [];
    const update = vi.fn();
    const schedule = rafBatch((callback) => frames.push(callback), update);
    schedule();
    schedule();
    expect(frames).toHaveLength(1);
    frames[0]!(0);
    expect(update).toHaveBeenCalledOnce();
    schedule();
    expect(frames).toHaveLength(2);
  });
});
