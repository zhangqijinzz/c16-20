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
  it('migrates the legacy single subject into the subjects list', () => {
    const storage = new MemoryStorage();
    const repository = new LocalFrameRepository(storage);
    const document = { ...structuredClone(EMPTY_DOCUMENT), subject: { x: 0.4, y: 0.6 } };
    repository.save(document);
    const loaded = repository.load();
    expect(loaded.subject).toBeNull();
    expect(loaded.subjects).toEqual([{ id: 'subject-legacy', x: 0.4, y: 0.6 }]);
  });

  it('keeps multiple subject markers across save and reload', () => {
    const storage = new MemoryStorage();
    const repository = new LocalFrameRepository(storage);
    const document = { ...structuredClone(EMPTY_DOCUMENT), subjects: [{ id: 's1', x: 0.2, y: 0.3 }, { id: 's2', x: 0.7, y: 0.8 }] };
    repository.save(document);
    expect(repository.load().subjects).toEqual([{ id: 's1', x: 0.2, y: 0.3 }, { id: 's2', x: 0.7, y: 0.8 }]);
  });

  it('falls back to a usable empty document for damaged data', () => {
    const storage = new MemoryStorage();
    storage.value = '{ damaged';
    const document = new LocalFrameRepository(storage).load();
    expect(document.version).toBe(1);
    expect(document.image).toBeNull();
    expect(document.variants).toEqual([]);
  });
});
