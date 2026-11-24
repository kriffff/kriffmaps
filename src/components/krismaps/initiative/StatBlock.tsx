import { ChevronDown, ChevronUp, ScrollText } from "lucide-react";

import type { Member } from "@/lib/krismaps/initiative";

import { firstImage, statBlockKey, usePanel } from "./context";

interface Props {
  groupId: string;
  member: Member;
  expanded: boolean;
  onToggle: () => void;
  /** showing the "press Ctrl+V" target for this member */
  arming: boolean;
  onArmed: () => void;
}

/** a member's stat block image: paste target, collapsible view, re-read and remove */
export function StatBlock({ groupId, member, expanded, onToggle, arming, onArmed }: Props) {
  const { statBlocks, setStatBlock, clearStatBlock, ocr } = usePanel();
  const url = statBlocks[statBlockKey(member.name)];

  return (
    <>
      {arming ? (
        <div
          tabIndex={0}
          autoFocus
          onPaste={(e) => {
            const image = firstImage(e.clipboardData?.files);
            if (!image) return;
            e.preventDefault();
            setStatBlock(member.name, image);
            onArmed();
            void ocr.read(groupId, member, image);
          }}
          className="mt-2 rounded-md border-2 border-dashed border-primary/60 p-2 text-center text-[0.7rem] text-muted-foreground outline-none"
        >
          Press Ctrl+V to paste a stat block for {member.name}
        </div>
      ) : null}

      {url ? (
        <div className="mt-2 overflow-hidden rounded-md border border-border">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-center gap-1.5 bg-muted/40 px-2 py-1 text-[0.65rem] tracking-widest text-muted-foreground uppercase hover:text-foreground"
          >
            <ScrollText className="size-3.5" />
            Stat block
            {ocr.busy[member.id] ? (
              <span className="normal-case tracking-normal">reading...</span>
            ) : ocr.failed[member.id] ? (
              <span className="normal-case tracking-normal text-destructive">couldn't read</span>
            ) : null}
            {expanded ? (
              <ChevronUp className="ml-auto size-3.5" />
            ) : (
              <ChevronDown className="ml-auto size-3.5" />
            )}
          </button>
          {expanded ? (
            <>
              <div className="max-h-[28rem] overflow-auto bg-background">
                <a href={url} target="_blank" rel="noreferrer">
                  <img
                    src={url}
                    alt={`${member.name} stat block`}
                    className="w-full object-contain"
                  />
                </a>
              </div>
              <div className="flex border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    void fetch(url)
                      .then((r) => r.blob())
                      .then((b) => ocr.read(groupId, member, b));
                  }}
                  className="flex-1 py-1 text-[0.65rem] text-muted-foreground hover:text-primary"
                >
                  Re-read name &amp; Stamina
                </button>
                <button
                  type="button"
                  onClick={() => clearStatBlock(member.name)}
                  className="flex-1 border-l border-border py-1 text-[0.65rem] text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
