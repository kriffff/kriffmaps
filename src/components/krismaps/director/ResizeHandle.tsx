interface Props {
  /** called with the pointer's x position while dragging */
  onDrag: (clientX: number) => void;
  /** double-click resets to the default size */
  onReset: () => void;
}

/** vertical drag handle between two columns */
export function ResizeHandle({ onDrag, onReset }: Props) {
  const start = (event: React.PointerEvent) => {
    event.preventDefault();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const move = (e: PointerEvent) => onDrag(e.clientX);
    const stop = () => {
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · double-click to reset"
      onPointerDown={start}
      onDoubleClick={onReset}
      className="w-1.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary"
    />
  );
}
