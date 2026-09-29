export type GuideKey = 'thirds' | 'center' | 'diagonal' | 'golden';
export type Phase = 'loading' | 'ready' | 'editing' | 'error';
export type Ratio = 'free' | '1:1' | '4:5' | '16:9';

export interface ImageAsset {
  src: string;
  width: number;
  height: number;
  name: string;
}

export interface CropVariant {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ratio: string;
}

export interface SubjectMarker {
  id: string;
  x: number;
  y: number;
}

export interface FrameDocument {
  version: 1;
  image: ImageAsset | null;
  guides: Record<GuideKey, boolean>;
  /** @deprecated 旧版单点主体标记，载入时迁移到 subjects */
  subject?: { x: number; y: number } | null;
  subjects: SubjectMarker[];
  crop: CropVariant;
  variants: CropVariant[];
}

export interface ViewState {
  phase: Phase;
  document: FrameDocument;
  compareOpen: boolean;
  selectedSubjectId: string | null;
  notice: string;
  error: string | null;
}

export const DEFAULT_CROP: CropVariant = {
  id: 'current',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
  ratio: 'free',
};

export const EMPTY_DOCUMENT: FrameDocument = {
  version: 1,
  image: null,
  guides: { thirds: true, center: false, diagonal: false, golden: false },
  subjects: [],
  crop: DEFAULT_CROP,
  variants: [],
};
