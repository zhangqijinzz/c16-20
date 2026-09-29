import { describe, expect, it } from 'vitest';
import { LocalFrameRepository } from '../repository';
import { EMPTY_DOCUMENT } from '../model';
import type { StorageService } from '../service';

class MemoryStorage implements StorageService {
  value: string | null = null;
  read() { return this.value; }
  write(value: string) { this.value = value; }
}

describe('LocalFrameRepository', () => {
  it('saves and reloads multiple subject points', () => {
    const storage = new MemoryStorage();
    const repository = new LocalFrameRepository(storage);
    const document = {
      ...structuredClone(EMPTY_DOCUMENT),
      subjects: [
        { id: 'a', x: 0.2, y: 0.3 },
        { id: 'b', x: 0.7, y: 0.8 },
      ],
    };
    repository.save(document);
    expect(repository.load().subjects).toEqual([
      { id: 'a', x: 0.2, y: 0.3 },
      { id: 'b', x: 0.7, y: 0.8 },
    ]);
  });

  it('migrates legacy single-subject data without losing the point', () => {
    const storage = new MemoryStorage();
    storage.value = JSON.stringify({
      version: 1,
      image: null,
      guides: { thirds: true, center: false, diagonal: false, golden: false },
      subject: { x: 0.4, y: 0.6 },
      crop: { id: 'current', x: 0, y: 0, width: 1, height: 1, ratio: 'free' },
      variants: [],
    });
    const document = new LocalFrameRepository(storage).load();
    expect(document.subjects).toEqual([{ id: 'subject-legacy', x: 0.4, y: 0.6 }]);
    expect(document.subject).toBeUndefined();
  });

  it('falls back to a usable empty document for damaged data', () => {
    const storage = new MemoryStorage();
    storage.value = '{ damaged';
    const document = new LocalFrameRepository(storage).load();
    expect(document.version).toBe(1);
    expect(document.image).toBeNull();
    expect(document.variants).toEqual([]);
    expect(document.subjects).toEqual([]);
  });
});
