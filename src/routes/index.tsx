import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  DirectorStage,
  type DirectorStageHandle,
  type FogHistoryState,
} from "@/components/krismaps/DirectorStage";
import { InitiativePanel } from "@/components/krismaps/initiative/InitiativePanel";
import { MapPreviewDialog } from "@/components/krismaps/MapPreviewDialog";
import { StageToolsPanel } from "@/components/krismaps/StageToolsPanel";
import { TagRulesDialog } from "@/components/krismaps/TagRulesDialog";
import { DirectorHeader, type DirectorTab } from "@/components/krismaps/director/DirectorHeader";
import { LibraryPane } from "@/components/krismaps/director/LibraryPane";
import { SidePanel } from "@/components/krismaps/director/SidePanel";
import {
  DEFAULT_LIBRARY_WIDTH,
  DEFAULT_PANEL_WIDTH,
  clampLibraryWidth,
  clampPanelWidth,
} from "@/components/krismaps/director/layout";
import { ShortcutsDialog } from "@/components/krismaps/director/ShortcutsDialog";
import { StageTabStrip } from "@/components/krismaps/director/StageTabStrip";
import { roundComplete } from "@/lib/krismaps/initiative";
import { buildLibrary } from "@/lib/krismaps/library";
import { shortcutFor } from "@/lib/krismaps/shortcuts";
import { libraryView, toggleTagPatch } from "@/lib/krismaps/libraryView";
import { useMonsterPortraits } from "@/lib/krismaps/portraits";
import { useHeroRoster } from "@/lib/krismaps/roster";
import { autoTagsFor, tagsForEntry, useTagRules } from "@/lib/krismaps/tags";
import type { FolderNode, MapEntry, Tool } from "@/lib/krismaps/types";
import { useInitiative } from "@/lib/krismaps/useInitiative";
import { useMapSettings } from "@/lib/krismaps/useMapSettings";
import { usePersistedState } from "@/lib/krismaps/usePersistedState";
import { useStageTabs } from "@/lib/krismaps/useStageTabs";
import { cn } from "@/lib/utils";

const restoreWidth = (clamp: (w: number) => number) => (stored: unknown) =>
  typeof stored === "number" ? clamp(stored) : undefined;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KriffMaps — Director View for tabletop battlemaps" },
      {
        name: "description",
        content:
          "Lightweight battlemap display for Draw Steel: browse maps from your own drive, paint fog of war, set a grid, and push it all to a second screen on the table.",
      },
      { property: "og:title", content: "KriffMaps — Director View for tabletop battlemaps" },
      {
        property: "og:description",
        content:
          "Browse local battlemaps, paint fog of war, set a grid, and mirror it to the table screen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DirectorView,
});

function DirectorView() {
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<DirectorStageHandle | null>(null);
  const [root, setRoot] = useState<FolderNode | null>(null);
  const [entries, setEntries] = useState<MapEntry[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [thumbSize, setThumbSize] = useState(180);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [tab, setTab] = useState<DirectorTab>("library");
  const [tool, setTool] = useState<Tool>("reveal");
  const [brush, setBrush] = useState(0.06);
  const [tagRulesOpen, setTagRulesOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [fogHistory, setFogHistory] = useState<FogHistoryState>({
    canUndo: false,
    canRedo: false,
  });
  const [panelWidth, setPanelWidth] = usePersistedState(
    "panelWidth",
    DEFAULT_PANEL_WIDTH,
    restoreWidth(clampPanelWidth),
  );
  const [libraryWidth, setLibraryWidth] = usePersistedState(
    "libraryWidth",
    DEFAULT_LIBRARY_WIDTH,
    restoreWidth(clampLibraryWidth),
  );

  const mapSettings = useMapSettings();
  const stage = useStageTabs(entries);
  const tagRules = useTagRules();
  const initiative = useInitiative();
  const roster = useHeroRoster();
  const portraitStore = useMonsterPortraits();

  const view = useMemo(
    () =>
      libraryView({
        root,
        entries,
        settings: mapSettings.settings,
        rules: tagRules.rules,
        selected: selectedFolder,
      }),
    [root, entries, mapSettings.settings, tagRules.rules, selectedFolder],
  );

  const chooseFolder = () => folderInputRef.current?.click();

  // keyboard shortcuts (see lib/krismaps/shortcuts.ts); latest state via a ref
  const keyState = useRef({ tab, initiative: initiative.state });
  keyState.current = { tab, initiative: initiative.state };
  const dispatchInitiative = initiative.dispatch;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = shortcutFor(event);
      if (!action) return;
      const { tab: current, initiative: combat } = keyState.current;
      const onStage = current === "stage";
      switch (action) {
        case "undoFog":
        case "redoFog":
          if (!onStage) return;
          if (action === "undoFog") stageRef.current?.undoFog();
          else stageRef.current?.redoFog();
          break;
        case "endTurn":
          if (!combat.activeId) return;
          dispatchInitiative({ type: "endTurn", groupId: combat.activeId });
          break;
        case "nextRound":
          if (!roundComplete(combat)) return;
          dispatchInitiative({ type: "nextRound" });
          break;
        case "toolReveal":
          setTool("reveal");
          break;
        case "toolHide":
          setTool("hide");
          break;
        case "toolPan":
          setTool("pan");
          break;
        case "brushSmaller":
          setBrush((b) => Math.max(0.005, b - 0.01));
          break;
        case "brushBigger":
          setBrush((b) => Math.min(0.15, b + 0.01));
          break;
        case "help":
          setShortcutsOpen(true);
          break;
      }
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatchInitiative]);

  const onPickFolder = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const { root: tree, entries: found, count } = buildLibrary(Array.from(fileList));
    setRoot(tree);
    setEntries(found);
    setSelectedFolder("");
    toast.success(`Loaded ${count} map${count === 1 ? "" : "s"} from ${tree.name}`);
  };

  /** open a map as a Stage tab (does not touch the Map View) */
  const previewOnStage = (path: string) => {
    stage.open(path);
    setPreviewPath(null);
    setTab("stage");
  };

  const displayInMapView = () => {
    if (!stage.selectedPath) return;
    mapSettings.update(stage.selectedPath, { lastUsed: Date.now() });
    stage.goLive(stage.selectedPath);
  };

  const updateSelected = (patch: Parameters<typeof mapSettings.update>[1]) => {
    if (stage.selectedPath) mapSettings.update(stage.selectedPath, patch);
  };
  const selectedSettings = mapSettings.settingsFor(stage.selectedPath);
  const previewEntry = entries.find((entry) => entry.path === previewPath) ?? null;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <DirectorHeader
        tab={tab}
        onTab={setTab}
        liveEntry={stage.liveEntry}
        entries={entries}
        hasFolder={!!root}
        onChooseFolder={chooseFolder}
        onCleaned={(plan) => mapSettings.forget(plan.settings)}
        onShortcuts={() => setShortcutsOpen(true)}
      />
      <input
        ref={(el) => {
          folderInputRef.current = el;
          // React doesn't know these attributes; set them directly
          el?.setAttribute("webkitdirectory", "");
          el?.setAttribute("directory", "");
        }}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(event) => onPickFolder(event.target.files)}
      />

      <main className="min-h-0 flex-1">
        <div className={cn("h-full", tab === "library" ? "flex" : "hidden")}>
          <LibraryPane
            root={root}
            view={view}
            selected={selectedFolder}
            onSelect={setSelectedFolder}
            settings={mapSettings.settings}
            tagRules={tagRules.rules}
            livePath={stage.livePath}
            thumbSize={thumbSize}
            onThumbSize={setThumbSize}
            width={libraryWidth}
            onWidth={setLibraryWidth}
            onEditTags={() => setTagRulesOpen(true)}
            onOpenMap={setPreviewPath}
            onChooseFolder={chooseFolder}
          />
        </div>

        <div className={cn("h-full min-h-0", tab === "stage" ? "flex" : "hidden")}>
          <div className="flex min-w-0 flex-1 flex-col">
            <StageTabStrip
              tabs={stage.tabs}
              selectedPath={stage.selectedPath}
              livePath={stage.livePath}
              onSelect={stage.select}
              onClose={stage.close}
              onGoLive={displayInMapView}
            />
            <div className="min-h-0 flex-1">
              <DirectorStage
                ref={stageRef}
                entry={stage.selectedEntry}
                settings={selectedSettings}
                initiative={initiative.state}
                live={!!stage.selectedPath && stage.selectedPath === stage.livePath}
                tool={tool}
                brush={brush}
                onSettings={updateSelected}
                onFogHistory={setFogHistory}
              />
            </div>
          </div>
          <SidePanel
            width={panelWidth}
            onWidth={setPanelWidth}
            tools={
              <StageToolsPanel
                tool={tool}
                setTool={setTool}
                brush={brush}
                setBrush={setBrush}
                stageRef={stageRef}
                entry={stage.selectedEntry}
                settings={selectedSettings}
                onSettings={updateSelected}
                canUndoFog={fogHistory.canUndo}
                canRedoFog={fogHistory.canRedo}
              />
            }
            initiative={
              <InitiativePanel
                state={initiative.state}
                dispatch={initiative.dispatch}
                roster={roster.heroes}
                onRememberHero={roster.remember}
                onForgetHero={roster.forget}
                statBlocks={portraitStore.portraits}
                onSetStatBlock={portraitStore.setPortrait}
                onClearStatBlock={portraitStore.clearPortrait}
                onRenameStatBlock={portraitStore.renamePortrait}
              />
            }
          />
        </div>
      </main>

      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      <TagRulesDialog
        open={tagRulesOpen}
        rules={tagRules.rules}
        counts={view.tagCounts}
        onClose={() => setTagRulesOpen(false)}
        onAdd={tagRules.addTag}
        onUpdate={tagRules.updateTag}
        onRemove={tagRules.removeTag}
        onReset={tagRules.resetRules}
      />

      <MapPreviewDialog
        entry={previewEntry}
        settings={mapSettings.settingsFor(previewPath)}
        isActive={!!previewPath && stage.isOpen(previewPath)}
        tagRules={tagRules.rules}
        autoTags={previewEntry ? autoTagsFor(previewEntry, tagRules.rules) : []}
        activeTags={
          previewEntry
            ? tagsForEntry(previewEntry, tagRules.rules, mapSettings.settings[previewEntry.path])
            : []
        }
        onToggleTag={(id) => {
          if (!previewEntry) return;
          mapSettings.update(
            previewEntry.path,
            toggleTagPatch(
              previewEntry,
              tagRules.rules,
              mapSettings.settings[previewEntry.path],
              id,
            ),
          );
        }}
        onClose={() => setPreviewPath(null)}
        onSettings={(patch) => {
          if (previewPath) mapSettings.update(previewPath, patch);
        }}
        onDisplay={() => previewPath && previewOnStage(previewPath)}
      />
    </div>
  );
}
