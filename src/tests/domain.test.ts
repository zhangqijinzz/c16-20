import { describe, expect, it } from 'vitest';
import {
  createSubject,
  cropForRatio,
  migrateDocument,
  moveCrop,
  moveSubject,
  removeSubject,
  resizeCrop,
} from '../domain';
import { DEFAULT_CROP } from '../model';

describe('crop domain rules', () => {
  it('fits a 1:1 crop inside a wide image and centers it', () => {
    const crop = cropForRatio('1:1', 1.5, DEFAULT_CROP);
    expect(crop.width).toBeCloseTo(2 / 3);
    expect(crop.height).toBe(1);
    expect(crop.x).toBeCloseTo(1 / 6);
  });

  it('clamps movement to the image boundary', () => {
    const crop = moveCrop({ ...DEFAULT_CROP, width: 0.5, height: 0.5 }, 0.9, -0.9);
    expect(crop.x).toBe(0.5);
    expect(crop.y).toBe(0);
  });

  it('keeps a selected ratio while resizing', () => {
    const crop = resizeCrop({ ...DEFAULT_CROP, ratio: '16:9', width: 0.5, height: 0.28125 }, 0.8, 0.8);
    expect(crop.width).toBe(0.8);
    expect(crop.height).toBeCloseTo(0.45);
  });
});

describe('subject points', () => {
  it('creates independently identifiable points', () => {
    const first = createSubject({ x: 0.2, y: 0.3 });
    const second = createSubject({ x: 0.7, y: 0.8 });
    expect(first.id).not.toBe(second.id);
    expect([first, second]).toHaveLength(2);
  });

  it('clamps coordinates while creating and moving', () => {
    const subject = createSubject({ x: 1.4, y: -0.2 }, 's1');
    expect(subject).toEqual({ id: 's1', x: 1, y: 0 });
    const moved = moveSubject([subject], 's1', { x: -1, y: 2 });
    expect(moved[0]).toEqual({ id: 's1', x: 0, y: 1 });
  });

  it('moves only the requested point and removes only that one', () => {
    const a = createSubject({ x: 0.2, y: 0.2 }, 'a');
    const b = createSubject({ x: 0.6, y: 0.6 }, 'b');
    const moved = moveSubject([a, b], 'b', { x: 0.7, y: 0.7 });
    expect(moved[0]).toEqual(a);
    expect(moved[1]).toEqual({ id: 'b', x: 0.7, y: 0.7 });
    expect(removeSubject(moved, 'a')).toEqual([{ id: 'b', x: 0.7, y: 0.7 }]);
  });
});

describe('document migration', () => {
  it('turns the legacy single subject into one member of subjects', () => {
    const migrated = migrateDocument({
      version: 1,
      image: null,
      guides: { thirds: true, center: false, diagonal: false, golden: false },
      crop: DEFAULT_CROP,
      variants: [],
      subject: { x: 0.4, y: 0.6 },
    });
    expect(migrated.subjects).toEqual([{ id: 'subject-legacy', x: 0.4, y: 0.6 }]);
    expect('subject' in migrated).toBe(false);
  });

  it('keeps an already multi-point document intact', () => {
    const migrated = migrateDocument({
      version: 1,
      image: null,
      guides: { thirds: true, center: false, diagonal: false, golden: false },
      crop: DEFAULT_CROP,
      variants: [],
      subjects: [
        { id: 'a', x: 0.1, y: 0.1 },
        { id: 'b', x: 0.9, y: 0.9 },
      ],
      subject: { x: 0.5, y: 0.5 },
    });
    expect(migrated.subjects).toHaveLength(2);
    expect(migrated.subjects.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('drops malformed subject entries', () => {
    const migrated = migrateDocument({
      version: 1,
      image: null,
      guides: { thirds: true, center: false, diagonal: false, golden: false },
      crop: DEFAULT_CROP,
      variants: [],
      subjects: [{ id: 'a', x: 0.1, y: 0.1 }, { x: 0.5 } as never, null as never],
    });
    expect(migrated.subjects).toEqual([{ id: 'a', x: 0.1, y: 0.1 }]);
  });
});
