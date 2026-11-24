import { Castle, Compass } from "lucide-react";

import { FolderTree } from "@/components/krismaps/FolderTree";
import { MapThumb } from "@/components/krismaps/MapThumb";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { LibraryView } from "@/lib/krismaps/libraryView";
import type { TagRule } from "@/lib/krismaps/tags";
import type { FolderNode, MapSettings } from "@/lib/krismaps/types";

import { DEFAULT_LIBRARY_WIDTH, clampLibraryWidth } from "./layout";
import { ResizeHandle } from "./ResizeHandle";

interface Props {
  root: FolderNode | null;
  view: LibraryView;
  selected: string;
  onSelect: (path: string) => void;
  settings: Record<string, MapSettings>;
  tagRules: TagRule[];
  livePath: string | null;
  thumbSize: number;
  onThumbSize: (size: number) => void;
  width: number;
  onWidth: (width: number) => void;
  onEditTags: () => void;
  onOpenMap: (path: string) => void;
  onChooseFolder: () => void;
}

/** Library tab: folder/tag sidebar plus the thumbnail grid, or the first-run prompt */
export function LibraryPane(props: Props) {
  const { root, view, settings } = props;

  if (!root) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center">
          <Compass className="mx-auto size-10 text-primary" />
          <h2 className="font-display mt-4 text-2xl tracking-wide">Point KriffMaps at your maps</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Choose the folder that holds your battlemaps. Subfolders, images and animated maps
            (.webm, .m4v, .mp4 and friends) are read straight from your drive — nothing is uploaded
            anywhere. Firefox can't remember the folder between sessions, so pick it once per
            session; favourites, grids and painted fog are restored automatically.
          </p>
          <Button className="mt-6" onClick={props.onChooseFolder}>
            <Castle className="size-4" /> Choose map folder
          </Button>
        </div>
      </div>
    );
  }

  const count = view.visibleMaps.length;
  return (
    <>
      <div
        className="shrink-0 overflow-y-auto border-r border-border bg-sidebar"
        style={{ width: props.width }}
      >
        <FolderTree
          root={root}
          selected={props.selected}
          favouriteCount={view.favourites.length}
          lastUsedCount={view.lastUsed.length}
          tagRules={props.tagRules}
          tagCounts={view.tagCounts}
          untaggedCount={view.tagIndex.untagged.length}
          tagTrees={view.tagTrees}
          onSelect={props.onSelect}
          onEditTags={props.onEditTags}
        />
      </div>
      <ResizeHandle
        onDrag={(x) => props.onWidth(clampLibraryWidth(x))}
        onReset={() => props.onWidth(DEFAULT_LIBRARY_WIDTH)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-4 border-b border-border px-4 py-2">
          <span className="text-sm text-muted-foreground">
            <span className="text-foreground">{view.label}</span> · {count} map
            {count === 1 ? "" : "s"}
          </span>
          <div className="ml-auto flex w-56 items-center gap-3">
            <Label className="text-xs whitespace-nowrap text-muted-foreground">Thumb size</Label>
            <Slider
              min={96}
              max={360}
              step={4}
              value={[props.thumbSize]}
              onValueChange={([v]) => props.onThumbSize(v ?? 180)}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {count === 0 ? (
            <p className="text-sm text-muted-foreground">{view.emptyMessage}</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {view.visibleMaps.map((entry) => (
                <MapThumb
                  key={entry.path}
                  entry={entry}
                  size={props.thumbSize}
                  favourite={!!settings[entry.path]?.favourite}
                  active={entry.path === props.livePath}
                  onOpen={() => props.onOpenMap(entry.path)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
