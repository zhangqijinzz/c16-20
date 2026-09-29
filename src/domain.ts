import type { CropVariant, FrameDocument, Ratio, SubjectPoint } from './model';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

let subjectSequence = 0;

export function createSubjectId(): string {
  subjectSequence += 1;
  return `subject-${Date.now().toString(36)}-${subjectSequence}`;
}

export function clampPoint(point: { x: number; y: number }): { x: number; y: number } {
  return { x: clamp(point.x), y: clamp(point.y) };
}

export function createSubject(point: { x: number; y: number }, id = createSubjectId()): SubjectPoint {
  return { id, ...clampPoint(point) };
}

export function moveSubject(subjects: SubjectPoint[], id: string, point: { x: number; y: number }): SubjectPoint[] {
  return subjects.map((subject) => (subject.id === id ? { ...subject, ...clampPoint(point) } : subject));
}

export function removeSubject(subjects: SubjectPoint[], id: string): SubjectPoint[] {
  return subjects.filter((subject) => subject.id !== id);
}

/**
 * 把旧版文档（只有一个 subject 点位）迁移成 subjects 数组，
 * 迁移后的文档移除遗留字段，保证老数据打开后仍是其中一个标记。
 */
export function migrateDocument(value: Partial<FrameDocument>): FrameDocument {
  const subjects = Array.isArray(value.subjects)
    ? value.subjects
        .filter((item): item is SubjectPoint => !!item && typeof item.id === 'string' && typeof item.x === 'number' && typeof item.y === 'number')
        .map((item) => ({ id: item.id, x: clamp(item.x), y: clamp(item.y) }))
    : [];
  const migrated: FrameDocument = {
    version: 1,
    image: value.image ?? null,
    guides: value.guides ?? { thirds: true, center: false, diagonal: false, golden: false },
    subjects,
    crop: value.crop ?? { id: 'current', x: 0, y: 0, width: 1, height: 1, ratio: 'free' },
    variants: Array.isArray(value.variants) ? value.variants : [],
  };
  if (subjects.length === 0 && value.subject && typeof value.subject.x === 'number' && typeof value.subject.y === 'number') {
    migrated.subjects = [createSubject({ x: value.subject.x, y: value.subject.y }, 'subject-legacy')];
  }
  return migrated;
}

export function normalizeCrop(crop: CropVariant): CropVariant {
  const width = clamp(crop.width, 0.12, 1);
  const height = clamp(crop.height, 0.12, 1);
  return {
    ...crop,
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
    width,
    height,
  };
}

export function cropForRatio(ratio: Ratio, imageRatio: number, current: CropVariant): CropVariant {
  if (ratio === 'free') return { ...current, ratio };
  const [w, h] = ratio.split(':').map(Number);
  const target = w / h;
  let width = 1;
  let height = 1;
  if (target > imageRatio) height = Math.min(1, imageRatio / target);
  else width = Math.min(1, target / imageRatio);
  return normalizeCrop({
    ...current,
    ratio,
    width,
    height,
    x: (1 - width) / 2,
    y: (1 - height) / 2,
  });
}

export function moveCrop(crop: CropVariant, dx: number, dy: number): CropVariant {
  return normalizeCrop({ ...crop, x: crop.x + dx, y: crop.y + dy });
}

export function resizeCrop(crop: CropVariant, width: number, height: number): CropVariant {
  const nextWidth = width;
  let nextHeight = height;
  if (crop.ratio !== 'free') {
    const [w, h] = crop.ratio.split(':').map(Number);
    nextHeight = nextWidth / (w / h);
  }
  return normalizeCrop({ ...crop, width: nextWidth, height: nextHeight });
}

export function makeVariant(crop: CropVariant, id: string): CropVariant {
  return { ...normalizeCrop(crop), id };
}

export function isFrameDocument(value: unknown): value is FrameDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<FrameDocument>;
  return candidate.version === 1 && typeof candidate.guides === 'object' && candidate.crop !== undefined && Array.isArray(candidate.variants);
}
