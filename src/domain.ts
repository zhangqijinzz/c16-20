import type { CropVariant, FrameDocument, Ratio, SubjectMarker } from './model';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

let subjectSequence = 0;

export function createSubjectId(): string {
  subjectSequence += 1;
  return `subject-${Date.now().toString(36)}-${subjectSequence}`;
}

export function createSubjectMarker(x: number, y: number, id: string): SubjectMarker {
  return { id, x: clamp(x), y: clamp(y) };
}

export function addSubjectMarker(subjects: SubjectMarker[], x: number, y: number, id: string): SubjectMarker[] {
  return [...subjects, createSubjectMarker(x, y, id)];
}

export function moveSubjectMarker(subjects: SubjectMarker[], id: string, x: number, y: number): SubjectMarker[] {
  return subjects.map((subject) => (subject.id === id ? { ...subject, x: clamp(x), y: clamp(y) } : subject));
}

export function removeSubjectMarker(subjects: SubjectMarker[], id: string): SubjectMarker[] {
  return subjects.filter((subject) => subject.id !== id);
}

function isSubjectMarker(value: unknown): value is SubjectMarker {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.x === 'number' && typeof candidate.y === 'number';
}

/** 把旧版单点主体标记迁移为多标记列表；已有 subjects 时以 subjects 为准。 */
export function migrateFrameDocument(document: FrameDocument): FrameDocument {
  const subjects: SubjectMarker[] = Array.isArray(document.subjects)
    ? document.subjects
        .filter(isSubjectMarker)
        .map((subject) => ({ id: subject.id, x: clamp(subject.x), y: clamp(subject.y) }))
    : [];
  if (subjects.length === 0 && document.subject && typeof document.subject.x === 'number' && typeof document.subject.y === 'number') {
    subjects.push({ id: 'subject-legacy', x: clamp(document.subject.x), y: clamp(document.subject.y) });
  }
  return { ...document, subject: null, subjects };
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
