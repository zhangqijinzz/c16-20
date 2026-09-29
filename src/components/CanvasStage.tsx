import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { CropVariant, GuideKey, ImageAsset, SubjectPoint } from '../model';

interface CanvasStageProps {
  image: ImageAsset;
  guides: Record<GuideKey, boolean>;
  crop: CropVariant;
  subjects: SubjectPoint[];
  selectedSubjectId: string | null;
  onAddSubject: (x: number, y: number) => void;
  onMoveSubject: (id: string, x: number, y: number) => void;
  onSelectSubject: (id: string | null) => void;
  onRemoveSubject: (id: string) => void;
  onMoveCrop: (dx: number, dy: number) => void;
  onResizeCrop: (width: number, height: number) => void;
}

// 按下后移动超过这个像素距离才认定为“拖动”，否则算轻点添加标记
const TAP_SLOP_PX = 6;

type DragState =
  | { kind: 'tap'; startClientX: number; startClientY: number; moved: boolean }
  | { kind: 'crop-pending'; startClientX: number; startClientY: number; lastX: number; lastY: number }
  | { kind: 'crop-move'; lastX: number; lastY: number }
  | { kind: 'resize'; startX: number; startY: number; lastX: number; lastY: number; crop: CropVariant }
  | { kind: 'subject'; id: string; lastX: number; lastY: number };

export function CanvasStage({
  image,
  guides,
  crop,
  subjects,
  selectedSubjectId,
  onAddSubject,
  onMoveSubject,
  onSelectSubject,
  onRemoveSubject,
  onMoveCrop,
  onResizeCrop,
}: CanvasStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [cropDragging, setCropDragging] = useState(false);
  const [pinDragging, setPinDragging] = useState(false);

  const pointFromEvent = (event: PointerEvent): { x: number; y: number } | null => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };

  const isSlopExceeded = (event: PointerEvent, startClientX: number, startClientY: number): boolean =>
    Math.hypot(event.clientX - startClientX, event.clientY - startClientY) > TAP_SLOP_PX;

  // —— 背景轻点：添加重点 ——
  const startBackgroundTap = (event: PointerEvent) => {
    if ((event.target as HTMLElement).closest('.crop-frame, .subject-pin')) return;
    dragRef.current = { kind: 'tap', startClientX: event.clientX, startClientY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveBackgroundTap = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== 'tap') return;
    if (!drag.moved && isSlopExceeded(event, drag.startClientX, drag.startClientY)) {
      dragRef.current = { ...drag, moved: true };
    }
  };

  const finishBackgroundTap = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== 'tap') return;
    dragRef.current = null;
    if (!drag.moved) {
      const point = pointFromEvent(event);
      if (point) onAddSubject(point.x, point.y);
    }
  };

  // —— 裁切框：先待定，移动超阈值才是拖框；松手没动过 = 在框上轻点添加标记 ——
  const startCropGesture = (event: PointerEvent) => {
    event.stopPropagation();
    if ((event.target as HTMLElement).closest('.resize-handle')) return;
    const point = pointFromEvent(event);
    if (!point) return;
    dragRef.current = { kind: 'crop-pending', startClientX: event.clientX, startClientY: event.clientY, lastX: point.x, lastY: point.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveCropGesture = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || (drag.kind !== 'crop-pending' && drag.kind !== 'crop-move' && drag.kind !== 'resize')) return;
    const point = pointFromEvent(event);
    if (!point) return;

    if (drag.kind === 'crop-pending') {
      if (!isSlopExceeded(event, drag.startClientX, drag.startClientY)) return;
      dragRef.current = { kind: 'crop-move', lastX: drag.lastX, lastY: drag.lastY };
      setCropDragging(true);
      return;
    }
    if (drag.kind === 'crop-move') {
      onMoveCrop(point.x - drag.lastX, point.y - drag.lastY);
      dragRef.current = { kind: 'crop-move', lastX: point.x, lastY: point.y };
      return;
    }
    onResizeCrop(drag.crop.width + point.x - drag.lastX, drag.crop.height + point.y - drag.lastY);
    dragRef.current = { ...drag, lastX: point.x, lastY: point.y, crop: { ...crop } };
  };

  const finishCropGesture = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || (drag.kind !== 'crop-pending' && drag.kind !== 'crop-move' && drag.kind !== 'resize')) return;
    event.stopPropagation();
    const wasPendingTap = drag.kind === 'crop-pending';
    dragRef.current = null;
    setCropDragging(false);
    if (wasPendingTap) {
      const point = pointFromEvent(event);
      if (point) onAddSubject(point.x, point.y);
    }
  };

  const startResize = (event: PointerEvent) => {
    event.stopPropagation();
    const point = pointFromEvent(event);
    if (!point) return;
    dragRef.current = { kind: 'resize', startX: point.x, startY: point.y, lastX: point.x, lastY: point.y, crop };
    setCropDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  // —— 重点标记：按下即选中并开始拖动，独立于裁切手势 ——
  const startSubjectDrag = (event: PointerEvent, id: string) => {
    event.stopPropagation();
    const point = pointFromEvent(event);
    if (!point) return;
    onSelectSubject(id);
    dragRef.current = { kind: 'subject', id, lastX: point.x, lastY: point.y };
    setPinDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveSubjectDrag = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== 'subject') return;
    const point = pointFromEvent(event);
    if (!point) return;
    onMoveSubject(drag.id, point.x, point.y);
    dragRef.current = { ...drag, lastX: point.x, lastY: point.y };
  };

  const finishSubjectDrag = (event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.kind !== 'subject') return;
    event.stopPropagation();
    dragRef.current = null;
    setPinDragging(false);
  };

  // Delete 删除当前选中重点，Esc 取消选中
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (event.key === 'Escape') {
        onSelectSubject(null);
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedSubjectId) {
        event.preventDefault();
        onRemoveSubject(selectedSubjectId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedSubjectId, onSelectSubject, onRemoveSubject]);

  return (
    <div className="stage-shell">
      <div
        className="canvas-stage"
        ref={stageRef}
        style={{ aspectRatio: `${image.width} / ${image.height}` }}
        onPointerDown={startBackgroundTap}
        onPointerMove={(event) => { moveBackgroundTap(event); }}
        onPointerUp={finishBackgroundTap}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        <img src={image.src} alt={image.name} draggable={false} />
        <div className="image-wash" />
        {guides.thirds && <div className="guide thirds-guide"><i /><i /><b /><b /></div>}
        {guides.center && <div className="guide center-guide"><i /><i /></div>}
        {guides.diagonal && <div className="guide diagonal-guide"><i /><i /></div>}
        {guides.golden && <div className="guide golden-guide"><i /><i /></div>}
        <div
          className={`crop-frame ${cropDragging ? 'dragging' : ''}`}
          style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%` }}
          onPointerDown={startCropGesture}
          onPointerMove={moveCropGesture}
          onPointerUp={finishCropGesture}
          onPointerCancel={() => { dragRef.current = null; setCropDragging(false); }}
        >
          <div className="crop-label">{crop.ratio === 'free' ? '自由裁切' : crop.ratio}</div>
          <button
            className="resize-handle"
            aria-label="调整裁切大小"
            onPointerDown={startResize}
            onClick={(event) => event.stopPropagation()}
          />
        </div>
        {subjects.map((subject, index) => {
          const selected = subject.id === selectedSubjectId;
          return (
            <div
              key={subject.id}
              className={`subject-pin ${selected ? 'selected' : ''} ${pinDragging && selected ? 'dragging' : ''}`}
              style={{ left: `${subject.x * 100}%`, top: `${subject.y * 100}%` }}
              onPointerDown={(event) => startSubjectDrag(event, subject.id)}
              onPointerMove={moveSubjectDrag}
              onPointerUp={finishSubjectDrag}
              onPointerCancel={() => { dragRef.current = null; setPinDragging(false); }}
            >
              <em>{index + 1}</em>
              {selected && (
                <div className="subject-card">
                  <span>重点 {index + 1}</span>
                  <button
                    type="button"
                    className="subject-delete"
                    aria-label={`删除重点 ${index + 1}`}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => { event.stopPropagation(); onRemoveSubject(subject.id); }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="stage-caption">
        <span>点击画面添加重点 · 拖动圆点微调 · 拖动画框调整位置{selectedSubjectId ? ' · Delete 删除 / Esc 取消选中' : ''}</span>
        <span>{image.width} × {image.height}px</span>
      </div>
    </div>
  );
}
