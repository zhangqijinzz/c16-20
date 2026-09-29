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

  it('updates guides, ratio, and variants', () => {
    vm.loadDemo();
    vm.toggleGuide('center');
    vm.setRatio('1:1');
    vm.saveVariant();
    expect(vm.getSnapshot().document.guides.center).toBe(true);
    expect(vm.getSnapshot().document.crop.ratio).toBe('1:1');
    expect(vm.getSnapshot().document.variants).toHaveLength(1);
  });

  it('marks multiple subjects, selects and moves them independently', () => {
    vm.loadDemo();
    vm.addSubject(0.2, 0.8);
    const first = vm.getSnapshot().document.subjects[0];
    expect(vm.getSnapshot().selectedSubjectId).toBe(first.id);

    vm.addSubject(0.7, 0.3);
    const second = vm.getSnapshot().document.subjects[1];
    expect(vm.getSnapshot().document.subjects).toHaveLength(2);
    expect(vm.getSnapshot().selectedSubjectId).toBe(second.id);

    vm.moveSubject(first.id, 0.25, 0.75);
    const subjects = vm.getSnapshot().document.subjects;
    expect(subjects[0]).toEqual({ id: first.id, x: 0.25, y: 0.75 });
    expect(subjects[1]).toEqual({ id: second.id, x: 0.7, y: 0.3 });
  });

  it('removes one subject and clears the selection only when needed', () => {
    vm.loadDemo();
    vm.addSubject(0.2, 0.8);
    const first = vm.getSnapshot().document.subjects[0];
    vm.addSubject(0.7, 0.3);
    const second = vm.getSnapshot().document.subjects[1];

    vm.selectSubject(first.id);
    vm.removeSubject(first.id);
    expect(vm.getSnapshot().document.subjects).toEqual([{ id: second.id, x: 0.7, y: 0.3 }]);
    expect(vm.getSnapshot().selectedSubjectId).toBeNull();
  });

  it('clears every subject at once and persists the empty list', () => {
    vm.loadDemo();
    vm.addSubject(0.2, 0.8);
    vm.addSubject(0.7, 0.3);
    vm.clearSubjects();
    expect(vm.getSnapshot().document.subjects).toEqual([]);
    expect(vm.getSnapshot().selectedSubjectId).toBeNull();
    expect(repository.document.subjects).toEqual([]);
  });

  it('keeps edits in memory and reports persistence failure', () => {
    repository.fail = true;
    vm.loadDemo();
    expect(vm.getSnapshot().phase).toBe('error');
    expect(vm.getSnapshot().document.image).not.toBeNull();
    expect(vm.getSnapshot().error).toContain('本地保存失败');
  });
});
