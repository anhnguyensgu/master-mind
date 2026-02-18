import { test, expect, describe } from 'bun:test';
import { scrollReducer, initialScrollState, type ScrollState } from './useScroll';

function stateWith(overrides: Partial<ScrollState>): ScrollState {
  return { ...initialScrollState, ...overrides };
}

describe('scrollReducer', () => {
  describe('SCROLL_UP', () => {
    test('decreases offset and disables autoFollow', () => {
      const state = stateWith({ scrollOffset: 10, autoFollow: true });
      const next = scrollReducer(state, { type: 'SCROLL_UP', lines: 3 });
      expect(next.scrollOffset).toBe(7);
      expect(next.autoFollow).toBe(false);
    });

    test('clamps to 0', () => {
      const state = stateWith({ scrollOffset: 2 });
      const next = scrollReducer(state, { type: 'SCROLL_UP', lines: 10 });
      expect(next.scrollOffset).toBe(0);
    });
  });

  describe('SCROLL_DOWN', () => {
    test('increases offset', () => {
      const state = stateWith({ scrollOffset: 0, contentHeight: 50, viewportHeight: 20 });
      const next = scrollReducer(state, { type: 'SCROLL_DOWN', lines: 5 });
      expect(next.scrollOffset).toBe(5);
      expect(next.autoFollow).toBe(false);
    });

    test('clamps to maxScroll', () => {
      const state = stateWith({ scrollOffset: 25, contentHeight: 50, viewportHeight: 20 });
      const next = scrollReducer(state, { type: 'SCROLL_DOWN', lines: 100 });
      expect(next.scrollOffset).toBe(30); // maxScroll = 50 - 20
    });

    test('enables autoFollow at bottom', () => {
      const state = stateWith({
        scrollOffset: 28,
        contentHeight: 50,
        viewportHeight: 20,
        autoFollow: false,
        hasNewMessages: true,
      });
      const next = scrollReducer(state, { type: 'SCROLL_DOWN', lines: 5 });
      expect(next.scrollOffset).toBe(30);
      expect(next.autoFollow).toBe(true);
      expect(next.hasNewMessages).toBe(false);
    });
  });

  describe('SCROLL_TO_TOP', () => {
    test('sets offset to 0 and disables autoFollow', () => {
      const state = stateWith({ scrollOffset: 20, autoFollow: true });
      const next = scrollReducer(state, { type: 'SCROLL_TO_TOP' });
      expect(next.scrollOffset).toBe(0);
      expect(next.autoFollow).toBe(false);
    });
  });

  describe('SCROLL_TO_BOTTOM', () => {
    test('sets offset to maxScroll and enables autoFollow', () => {
      const state = stateWith({
        scrollOffset: 0,
        contentHeight: 50,
        viewportHeight: 20,
        autoFollow: false,
        hasNewMessages: true,
      });
      const next = scrollReducer(state, { type: 'SCROLL_TO_BOTTOM' });
      expect(next.scrollOffset).toBe(30);
      expect(next.autoFollow).toBe(true);
      expect(next.hasNewMessages).toBe(false);
    });
  });

  describe('SET_CONTENT_HEIGHT', () => {
    test('with autoFollow pins to bottom', () => {
      const state = stateWith({ contentHeight: 30, viewportHeight: 20, scrollOffset: 10, autoFollow: true });
      const next = scrollReducer(state, { type: 'SET_CONTENT_HEIGHT', height: 40 });
      expect(next.contentHeight).toBe(40);
      expect(next.scrollOffset).toBe(20); // maxScroll = 40 - 20
    });

    test('without autoFollow preserves offset', () => {
      const state = stateWith({ contentHeight: 30, viewportHeight: 20, scrollOffset: 5, autoFollow: false });
      const next = scrollReducer(state, { type: 'SET_CONTENT_HEIGHT', height: 40 });
      expect(next.contentHeight).toBe(40);
      expect(next.scrollOffset).toBe(5);
    });
  });

  describe('SET_VIEWPORT_HEIGHT', () => {
    test('with autoFollow recalculates offset', () => {
      const state = stateWith({ contentHeight: 50, viewportHeight: 20, scrollOffset: 30, autoFollow: true });
      const next = scrollReducer(state, { type: 'SET_VIEWPORT_HEIGHT', height: 25 });
      expect(next.viewportHeight).toBe(25);
      expect(next.scrollOffset).toBe(25); // maxScroll = 50 - 25
    });
  });

  describe('CONTENT_APPENDED', () => {
    test('with autoFollow returns same state', () => {
      const state = stateWith({ autoFollow: true });
      const next = scrollReducer(state, { type: 'CONTENT_APPENDED' });
      expect(next).toBe(state); // same reference
    });

    test('without autoFollow sets hasNewMessages', () => {
      const state = stateWith({ autoFollow: false, hasNewMessages: false });
      const next = scrollReducer(state, { type: 'CONTENT_APPENDED' });
      expect(next.hasNewMessages).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('content shorter than viewport has maxScroll 0', () => {
      const state = stateWith({ contentHeight: 10, viewportHeight: 20, autoFollow: true });
      const next = scrollReducer(state, { type: 'SCROLL_TO_BOTTOM' });
      expect(next.scrollOffset).toBe(0);
    });

    test('empty content', () => {
      const next = scrollReducer(initialScrollState, { type: 'SCROLL_UP', lines: 5 });
      expect(next.scrollOffset).toBe(0);
    });
  });
});
