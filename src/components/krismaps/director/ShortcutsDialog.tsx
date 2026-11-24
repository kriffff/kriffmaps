import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SHORTCUTS } from "@/lib/krismaps/shortcuts";

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display tracking-wide">Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {SHORTCUTS.map((s) => (
            <div key={s.action} className="contents">
              <dt>
                <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs whitespace-nowrap">
                  {s.keys}
                </kbd>
              </dt>
              <dd className="text-muted-foreground">{s.label}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          Shortcuts are ignored while typing in a box.
        </p>
      </DialogContent>
    </Dialog>
  );
}
