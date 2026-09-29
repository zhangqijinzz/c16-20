import { beforeEach, describe, expect, it } from 'vitest';
import { FrameSenseViewModel } from '../viewModel';
import { EMPTY_DOCUMENT, type FrameDocument, type ImageAsset } from '../model';
import type { FrameRepository } from '../repository';
import type { ImageService } from '../service';

class MemoryRepository implements FrameRepository {
  document: FrameDocument = structuredClone(EMPTY_DOCUMENT);
  fail = false;
  load() { return structuredClone(this.document); }
  save(document: FrameDocument) { if (this.fail) throw new Error('no storage'); this.document = structuredClone(document); }
}

class FakeImageService implements ImageService {
  asset: ImageAsset = { src: 'data:image/svg+xml,test', width: 1200, height: 800, name: 'test.svg' };
  readFile() { return Promise.resolve(this.asset); }
  demo() { return this.asset; }
}

describe('FrameSenseViewModel', () => {
  let repository: MemoryRepository;
  let vm: FrameSenseViewModel;
  beforeEach(() => { repository = new MemoryRepository(); vm = new FrameSenseViewModel(repository, new FakeImageService()); });

  it('initializes empty and loads a demo image', async () => {
    await vm.initialize();
    expect(vm.getSnapshot().phase).toBe('ready');
    vm.loadDemo();
    expect(vm.getSnapshot().document.image?.name).toBe('test.svg');
    expect(repository.document.image).not.toBeNull();
  });

  it('updates guides, subjects, ratio, and variants', () => {
    vm.loadDemo();
    vm.toggleGuide('center');
    vm.addSubject(0.2, 0.8);
    vm.setRatio('1:1');
    vm.saveVariant();
    expect(vm.getSnapshot().document.guides.center).toBe(true);
    expect(vm.getSnapshot().document.subjects).toHaveLength(1);
    expect(vm.getSnapshot().document.subjects[0]).toMatchObject({ x: 0.2, y: 0.8 });
    expect(vm.getSnapshot().selectedSubjectId).toBe(vm.getSnapshot().document.subjects[0].id);
    expect(vm.getSnapshot().document.crop.ratio).toBe('1:1');
    expect(vm.getSnapshot().document.variants).toHaveLength(1);
  });

  it('adds, selects, moves, and removes individual subject markers', () => {
    vm.loadDemo();
    vm.addSubject(0.2, 0.3);
    const first = vm.getSnapshot().document.subjects[0];
    vm.addSubject(0.7, 0.6);
    const second = vm.getSnapshot().document.subjects[1];
    expect(vm.getSnapshot().document.subjects).toHaveLength(2);
    expect(vm.getSnapshot().selectedSubjectId).toBe(second.id);

    vm.selectSubject(first.id);
    expect(vm.getSnapshot().selectedSubjectId).toBe(first.id);

    vm.moveSubject(first.id, 0.4, 0.9);
    expect(vm.getSnapshot().document.subjects[0]).toMatchObject({ id: first.id, x: 0.4, y: 0.9 });

    vm.removeSubject(first.id);
    expect(vm.getSnapshot().document.subjects).toEqual([second]);
    expect(vm.getSnapshot().selectedSubjectId).toBeNull();
  });

  it('clamps moved markers into the image bounds and clears all markers', () => {
    vm.loadDemo();
    vm.addSubject(0.5, 0.5);
    const id = vm.getSnapshot().document.subjects[0].id;
    vm.moveSubject(id, 1.4, -0.2);
    expect(vm.getSnapshot().document.subjects[0]).toMatchObject({ x: 1, y: 0 });
    vm.clearSubjects();
    expect(vm.getSnapshot().document.subjects).toEqual([]);
    expect(vm.getSnapshot().selectedSubjectId).toBeNull();
  });

  it('keeps edits in memory and reports persistence failure', () => {
    repository.fail = true;
    vm.loadDemo();
    expect(vm.getSnapshot().phase).toBe('error');
    expect(vm.getSnapshot().document.image).not.toBeNull();
    expect(vm.getSnapshot().error).toContain('本地保存失败');
  });
});
