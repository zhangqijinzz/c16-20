import { describe, expect, it } from 'vitest';
import { addSubjectMarker, cropForRatio, migrateFrameDocument, moveCrop, moveSubjectMarker, removeSubjectMarker, resizeCrop } from '../domain';
import { DEFAULT_CROP, EMPTY_DOCUMENT } from '../model';

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

describe('subject marker rules', () => {
  it('appends markers with clamped coordinates', () => {
    const subjects = addSubjectMarker([], 1.4, -0.2, 's1');
    expect(subjects).toEqual([{ id: 's1', x: 1, y: 0 }]);
  });

  it('moves only the matching marker', () => {
    const subjects = moveSubjectMarker([{ id: 's1', x: 0.2, y: 0.3 }, { id: 's2', x: 0.7, y: 0.8 }], 's2', 0.5, 0.5);
    expect(subjects).toEqual([{ id: 's1', x: 0.2, y: 0.3 }, { id: 's2', x: 0.5, y: 0.5 }]);
  });

  it('removes only the matching marker', () => {
    const subjects = removeSubjectMarker([{ id: 's1', x: 0.2, y: 0.3 }, { id: 's2', x: 0.7, y: 0.8 }], 's1');
    expect(subjects).toEqual([{ id: 's2', x: 0.7, y: 0.8 }]);
  });

  it('migrates a legacy single subject into the first marker', () => {
    const document = migrateFrameDocument({ ...EMPTY_DOCUMENT, subject: { x: 0.4, y: 0.6 } });
    expect(document.subject).toBeNull();
    expect(document.subjects).toEqual([{ id: 'subject-legacy', x: 0.4, y: 0.6 }]);
  });

  it('keeps existing markers and drops the legacy field when both exist', () => {
    const document = migrateFrameDocument({ ...EMPTY_DOCUMENT, subject: { x: 0.1, y: 0.1 }, subjects: [{ id: 's1', x: 0.3, y: 0.3 }] });
    expect(document.subject).toBeNull();
    expect(document.subjects).toEqual([{ id: 's1', x: 0.3, y: 0.3 }]);
  });
});
