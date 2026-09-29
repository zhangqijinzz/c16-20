import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { CropVariant, GuideKey, ImageAsset, SubjectMarker } from '../model';

interface CanvasStageProps {
  image: ImageAsset;
  guides: Record<GuideKey, boolean>;
  crop: CropVariant;
  subjects: SubjectMarker[];
  selectedSubjectId: string | null;
  onAddSubject: (x: number, y: number) => void;
  onSelectSubject: (id: string | null) => void;
  onMoveSubject: (id: string, x: number, y: number) => void;
  onRemoveSubject: (id: string) => void;
  onClearSubjects: () => void;
  onMoveCrop: (dx: number, dy: number) => void;
  onResizeCrop: (width: number, height: number) => void;
}

type DragMode = 'move-crop' | 'resize-crop' | 'move-subject';

interface DragState {
  mode: DragMode;
  x: number;
  y: number;
  crop: CropVariant;
  subjectId: string | null;
}

export function CanvasStage({ image, guides, crop, subjects, selectedSubjectId, onAddSubject, onSelectSubject, onMoveSubject, onRemoveSubject, onClearSubjects, onMoveCrop, onResizeCrop }: CanvasStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragMode, setDragMode] = useState<DragMode | null>(null);

  const pointFromEvent = (event: PointerEvent): { x: number; y: number } | null => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };

  const beginDrag = (event: PointerEvent, mode: DragMode, subjectId: string | null = null) => {
    event.stopPropagation();
    if (subjectId) onSelectSubject(subjectId);
    const point = pointFromEvent(event);
    if (!point) return;
    dragRef.current = { mode, x: point.x, y: point.y, crop, subjectId };
    setDragMode(mode);
    stageRef.current?.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointFromEvent(event);
    if (!point) return;
    if (drag.mode === 'move-crop') onMoveCrop(point.x - drag.x, point.y - drag.y);
    else if (drag.mode === 'resize-crop') onResizeCrop(drag.crop.width + point.x - drag.x, drag.crop.height + point.y - drag.y);
    else if (drag.subjectId) onMoveSubject(drag.subjectId, point.x, point.y);
    dragRef.current = { ...drag, x: point.x, y: point.y, crop };
  };

  const stopDrag = () => { dragRef.current = null; setDragMode(null); };

  const clickStage = (event: PointerEvent) => {
    if (dragRef.current || (event.target as HTMLElement).closest('.crop-frame, .subject-marker')) return;
    const point = pointFromEvent(event);
    if (point) onAddSubject(point.x, point.y);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && selectedSubjectId) {
      event.preventDefault();
      onRemoveSubject(selectedSubjectId);
    } else if (event.key === 'Escape') {
      onSelectSubject(null);
    }
  };

  return (
    <div className="stage-shell">
      <div
        className="canvas-stage"
        ref={stageRef}
        style={{ aspectRatio: `${image.width} / ${image.height}` }}
        tabIndex={0}
        onPointerDown={clickStage}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onKeyDown={handleKeyDown}
      >
        <img src={image.src} alt={image.name} draggable={false} />
        <div className="image-wash" />
        {guides.thirds && <div className="guide thirds-guide"><i /><i /><b /><b /></div>}
        {guides.center && <div className="guide center-guide"><i /><i /></div>}
        {guides.diagonal && <div className="guide diagonal-guide"><i /><i /></div>}
        {guides.golden && <div className="guide golden-guide"><i /><i /></div>}
        {subjects.map((subject, index) => {
          const selected = selectedSubjectId === subject.id;
          const dragging = dragMode === 'move-subject' && dragRef.current?.subjectId === subject.id;
          return (
            <div
              key={subject.id}
              className={`subject-marker ${selected ? 'selected' : ''} ${dragging ? 'dragging' : ''}`}
              style={{ left: `${subject.x * 100}%`, top: `${subject.y * 100}%`, zIndex: dragging ? 9 : selected ? 8 : 5 }}
              onPointerDown={(event) => beginDrag(event, 'move-subject', subject.id)}
              title={`主体标记 ${index + 1}：可拖动微调，选中后按 Delete 删除`}
            >
              <span className="marker-dot"><span className="marker-index">{index + 1}</span></span>
              {selected && (
                <>
                  <button
                    className="marker-delete"
                    aria-label={`删除主体标记 ${index + 1}`}
                    title="删除该标记"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => { event.stopPropagation(); onRemoveSubject(subject.id); }}
                  >×</button>
                  <span className="marker-label">拖动微调 · Delete 删除</span>
                </>
              )}
            </div>
          );
        })}
        <div
          className={`crop-frame ${dragMode === 'move-crop' || dragMode === 'resize-crop' ? 'dragging' : ''}`}
          style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}
          onPointerDown={(event) => beginDrag(event, 'move-crop')}
        >
          <div className="crop-label">{crop.ratio === 'free' ? '自由裁切' : crop.ratio}</div>
          <button className="resize-handle" aria-label="调整裁切大小" onPointerDown={(event) => { event.stopPropagation(); beginDrag(event, 'resize-crop'); }} onClick={(event) => event.stopPropagation()} />
        </div>
      </div>
      <div className="stage-caption">
        <span>{subjects.length === 0 ? '点击画面添加主体标记 · 拖动画框调整位置' : `已标记 ${subjects.length} 个主体 · 拖动标记可微调位置`}</span>
        <span className="caption-side">
          <span>{image.width} × {image.height}px</span>
          {subjects.length > 0 && <button className="clear-subjects" onClick={onClearSubjects}>清空全部标记</button>}
        </span>
      </div>
    </div>
  );
}
