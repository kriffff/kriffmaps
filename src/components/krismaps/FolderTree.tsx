import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Gem,
  Hourglass,
  Scroll,
  ScrollText,
  Settings2,
  Swords,
  Tags,
} from "lucide-react";

import { FAVOURITES_PATH, LAST_USED_PATH, countMaps } from "@/lib/krismaps/library";
import { TAG_FOLDER_SEP, TAG_PREFIX, UNTAGGED_PATH, type TagRule } from "@/lib/krismaps/tags";
import type { FolderNode } from "@/lib/krismaps/types";
import { cn } from "@/lib/utils";

interface Props {
  root: FolderNode;
  selected: string;
  favouriteCount: number;
  lastUsedCount: number;
  tagRules: TagRule[];
  tagCounts: Record<string, number>;
  untaggedCount: number;
  /** pruned folder trees per tag id, plus the untagged sentinel key */
  tagTrees: Record<string, FolderNode | undefined>;
  onSelect: (path: string) => void;
  onEditTags: () => void;
}

export function FolderTree({
  root,
  selected,
  favouriteCount,
  lastUsedCount,
  tagRules,
  tagCounts,
  untaggedCount,
  tagTrees,
  onSelect,
  onEditTags,
}: Props) {
  const [tagsOpen, setTagsOpen] = useState(true);
  const [foldersOpen, setFoldersOpen] = useState(true);

  return (
    <nav className="space-y-1 p-2">
      <MetaFolder
        icon={<Gem className="size-4 shrink-0" />}
        label="Favourites"
        count={favouriteCount}
        active={selected === FAVOURITES_PATH}
        onSelect={() => onSelect(FAVOURITES_PATH)}
      />
      <MetaFolder
        icon={<Hourglass className="size-4 shrink-0" />}
        label="Last Used"
        count={lastUsedCount}
        active={selected === LAST_USED_PATH}
        onSelect={() => onSelect(LAST_USED_PATH)}
      />

      <div>
        <div className="flex items-center gap-1 rounded-md pr-1 text-sidebar-foreground hover:bg-sidebar-accent">
          <button
            type="button"
            aria-label={tagsOpen ? "Collapse tags" : "Expand tags"}
            onClick={() => setTagsOpen((v) => !v)}
            className="p-1"
          >
            {tagsOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setTagsOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm"
          >
            <Tags className="size-4 shrink-0" />
            <span className="truncate">Tags</span>
          </button>
          <button
            type="button"
            title="Edit tag rules"
            aria-label="Edit tag rules"
            onClick={onEditTags}
            className="rounded p-1 text-muted-foreground hover:text-primary"
          >
            <Settings2 className="size-3.5" />
          </button>
        </div>
        {tagsOpen ? (
          <div className="space-y-1">
            {tagRules.map((rule) => (
              <TagGroup
                key={rule.id}
                sentinel={`${TAG_PREFIX}${rule.id}`}
                icon={<Swords className="size-4 shrink-0" />}
                label={rule.label}
                count={tagCounts[rule.id] ?? 0}
                tree={tagTrees[rule.id]}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
            <TagGroup
              sentinel={UNTAGGED_PATH}
              icon={<Scroll className="size-4 shrink-0" />}
              label="Untagged"
              count={untaggedCount}
              tree={tagTrees[UNTAGGED_PATH]}
              selected={selected}
              onSelect={onSelect}
            />
          </div>
        ) : null}
      </div>

      <div>
        <div className="flex items-center gap-1 rounded-md text-sidebar-foreground hover:bg-sidebar-accent">
          <button
            type="button"
            aria-label={foldersOpen ? "Collapse folders" : "Expand folders"}
            onClick={() => setFoldersOpen((v) => !v)}
            className="p-1"
          >
            {foldersOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setFoldersOpen((v) => !v)}
            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm"
          >
            <ScrollText className="size-4 shrink-0" />
            <span className="truncate">Folders</span>
            <span className="ml-auto pr-2 text-xs text-muted-foreground">{countMaps(root)}</span>
          </button>
        </div>
        {foldersOpen ? (
          <TreeNode node={root} depth={1} selected={selected} onSelect={onSelect} defaultOpen />
        ) : null}
      </div>
    </nav>
  );
}

function TagGroup({
  sentinel,
  icon,
  label,
  count,
  tree,
  selected,
  onSelect,
}: {
  sentinel: string;
  icon: React.ReactNode;
  label: string;
  count: number;
  tree: FolderNode | undefined;
  selected: string;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const children = tree?.folders ?? [];
  const hasChildren = children.length > 0;
  const active = selected === sentinel;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md pl-4 pr-2 transition-colors",
          active ? "bg-primary/15 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent",
        )}
      >
        <button
          type="button"
          aria-label={open ? `Collapse ${label} folders` : `Expand ${label} folders`}
          onClick={() => setOpen((v) => !v)}
          className={cn("p-1", !hasChildren && "invisible")}
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onSelect(sentinel)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm"
        >
          {icon}
          <span className="truncate">{label}</span>
          <span className="ml-auto pl-2 text-xs text-muted-foreground">{count}</span>
        </button>
      </div>
      {open && hasChildren ? (
        <div className="space-y-1">
          {children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={3}
              selected={selected}
              onSelect={(path) => onSelect(`${sentinel}${TAG_FOLDER_SEP}${path}`)}
              selectedPrefix={`${sentinel}${TAG_FOLDER_SEP}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MetaFolder({
  icon,
  label,
  count,
  active,
  onSelect,
  indent = false,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        indent && "pl-7",
        active ? "bg-primary/15 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
      <span className="ml-auto text-xs text-muted-foreground">{count}</span>
    </button>
  );
}

function TreeNode({
  node,
  depth,
  selected,
  onSelect,
  defaultOpen = false,
  selectedPrefix = "",
}: {
  node: FolderNode;
  depth: number;
  selected: string;
  onSelect: (path: string) => void;
  defaultOpen?: boolean;
  selectedPrefix?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isSelected = selected === `${selectedPrefix}${node.path}`;
  const hasChildren = node.folders.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md pr-2 transition-colors",
          isSelected
            ? "bg-primary/15 text-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent",
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        <button
          type="button"
          aria-label={open ? "Collapse folder" : "Expand folder"}
          onClick={() => setOpen((v) => !v)}
          className={cn("p-1", !hasChildren && "invisible")}
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.path)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm"
        >
          {open && hasChildren ? (
            <ScrollText className="size-4 shrink-0" />
          ) : (
            <Scroll className="size-4 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
          <span className="ml-auto pl-2 text-xs text-muted-foreground">{countMaps(node)}</span>
        </button>
      </div>
      {open && hasChildren ? (
        <div className="space-y-1">
          {node.folders.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              selectedPrefix={selectedPrefix}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
