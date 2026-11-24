import {
  bloodiedCount,
  isMemberDown,
  minionsLeft,
  overlaySections,
  type Group,
  type InitiativeState,
  type Member,
} from "@/lib/krismaps/initiative";
import { cn } from "@/lib/utils";

interface Props {
  state: InitiativeState;
  /** dimmed, non-interactive reference version shown inside Director View */
  preview?: boolean;
  className?: string;
}

const tag = "rounded bg-[#b3202a] px-1.5 py-0.5 text-[0.6rem] tracking-widest text-white uppercase";

/**
 * One line per member. Players see enemy names, how many are left and who is
 * bloodied, but never enemy numbers; heroes show their Stamina.
 */
function ConditionTags({ member }: { member: Member }) {
  if (!member.conditions?.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {member.conditions.map((c) => (
        <span
          key={c.id}
          className="rounded border border-white/40 px-1 py-px text-[0.55rem] tracking-wider text-white/85 uppercase"
        >
          {c.name}
        </span>
      ))}
    </span>
  );
}

function MemberLine({ member, enemy }: { member: Member; enemy: boolean }) {
  if (enemy && isMemberDown(member)) return null;
  return (
    <span className="flex flex-col gap-0.5">
      <MemberStatus member={member} enemy={enemy} />
      <ConditionTags member={member} />
    </span>
  );
}

function MemberStatus({ member, enemy }: { member: Member; enemy: boolean }) {
  if (member.kind === "minions") {
    return (
      <span className="text-base leading-none">
        {member.name}
        <span className="ml-1 text-xs opacity-80">×{minionsLeft(member)}</span>
      </span>
    );
  }
  const n = member.stamina.length;
  const bloodied = bloodiedCount(member);
  return (
    <span className="flex items-center gap-2">
      <span className="text-base leading-none">
        {member.name}
        {n > 1 ? <span className="ml-1 text-xs opacity-80">×{n}</span> : null}
      </span>
      {enemy ? (
        bloodied > 0 ? (
          <span className={tag}>{n > 1 ? `${bloodied} bloodied` : "Bloodied"}</span>
        ) : null
      ) : member.maxStamina > 0 ? (
        <span className={cn("text-xs tabular-nums", bloodied ? "text-[#ffb4b4]" : "opacity-85")}>
          {member.stamina[0]}/{member.maxStamina}
        </span>
      ) : null}
    </span>
  );
}

function Plate({
  group,
  current,
  horizontal,
}: {
  group: Group;
  current: boolean;
  horizontal: boolean;
}) {
  const enemy = group.side === "enemy";
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-md border-2 px-3 py-1.5 font-display tracking-wide whitespace-nowrap backdrop-blur-sm transition-all",
        horizontal ? "items-center px-3 py-2" : "min-w-[9rem]",
        enemy
          ? "border-[#b3202a] bg-[#2a0c0f]/85 text-[#ff9a9f]"
          : "border-[#2f9e57] bg-[#0c2417]/85 text-[#9ff0b8]",
        current ? "scale-105 shadow-[0_0_0_2px_rgba(255,255,255,0.55)]" : "",
        group.acted && !current ? "opacity-35 saturate-50" : "",
      )}
    >
      {group.members.map((m) => (
        <MemberLine key={m.id} member={m} enemy={enemy} />
      ))}
    </div>
  );
}

function Divider({ horizontal }: { horizontal: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 rounded bg-white/45",
        horizontal ? "mx-1 h-10 w-0.5" : "my-1 h-0.5 w-10",
      )}
    />
  );
}

export function InitiativeOverlay({ state, preview = false, className }: Props) {
  const { layout } = state;
  const sections = overlaySections(state);
  if (!layout.visible || sections.length === 0) return null;
  const horizontal = layout.orientation === "horizontal";

  return (
    <div
      data-testid={preview ? undefined : "initiative-overlay"}
      className={cn("pointer-events-none absolute z-20", preview && "opacity-60", className)}
      style={{
        left: `${layout.x * 100}%`,
        top: `${layout.y * 100}%`,
        transform: `translate(-50%, -50%) rotate(${layout.rotation}deg) scale(${layout.scale})`,
        transformOrigin: "center",
      }}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-lg bg-black/45 p-2",
          horizontal ? "flex-row" : "flex-col",
        )}
      >
        <span className="text-[0.6rem] tracking-[0.3em] text-white/70 uppercase">
          Round {state.round}
        </span>
        {sections.map((section, index) => (
          <div
            key={index}
            className={cn("flex items-center gap-1.5", horizontal ? "flex-row" : "flex-col")}
          >
            {index > 0 ? <Divider horizontal={horizontal} /> : null}
            {section.map((g) => (
              <Plate
                key={g.id}
                group={g}
                current={g.id === state.activeId}
                horizontal={horizontal}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
