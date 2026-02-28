"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import type { Status } from "@/data/types";
import {
  Inbox,
  Clock,
  CheckCircle2,
  CircleDot,
  BarChart3,
  Settings,
  Users,
  Search,
  Plus,
} from "lucide-react";

interface SidebarProps {
  currentFilter: Status | "all";
  onFilterChange: (filter: Status | "all") => void;
  counts: { all: number; open: number; pending: number; resolved: number };
}

const navItems: {
  id: Status | "all";
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "all", label: "すべて", icon: Inbox },
  { id: "open", label: "未対応", icon: CircleDot },
  { id: "pending", label: "保留中", icon: Clock },
  { id: "resolved", label: "完了", icon: CheckCircle2 },
];

export function Sidebar({ currentFilter, onFilterChange, counts }: SidebarProps) {
  return (
    <aside className="flex h-full w-[220px] flex-col border-r bg-sidebar">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
          <span className="text-[11px] font-bold tracking-tight text-background">Co</span>
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-foreground">
          Cobox
        </span>
      </div>

      {/* Search + New */}
      <div className="flex items-center gap-1.5 px-3 pb-2">
        <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2 text-muted-foreground font-normal">
          <Search className="h-3.5 w-3.5" />
          <span className="text-[13px]">検索...</span>
        </Button>
        <Button variant="ghost" size="icon-sm">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3">
        <p className="px-2 pb-1.5 pt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          インボックス
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentFilter === item.id;
          const count = counts[item.id];
          return (
            <button
              key={item.id}
              onClick={() => onFilterChange(item.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100 cursor-pointer",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "min-w-[18px] rounded-full px-1.5 py-px text-center text-[10px] font-semibold",
                    isActive
                      ? "bg-foreground/10 text-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-5">
          <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            管理
          </p>
          <Tooltip content="レポート" side="right">
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground cursor-pointer">
              <BarChart3 className="h-4 w-4 shrink-0" />
              <span>レポート</span>
            </button>
          </Tooltip>
          <Tooltip content="チーム" side="right">
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground cursor-pointer">
              <Users className="h-4 w-4 shrink-0" />
              <span>チーム</span>
            </button>
          </Tooltip>
          <Tooltip content="設定" side="right">
            <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground cursor-pointer">
              <Settings className="h-4 w-4 shrink-0" />
              <span>設定</span>
            </button>
          </Tooltip>
        </div>
      </nav>

      {/* User */}
      <div className="border-t p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground">
            田美
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-[13px] font-medium">田中 美咲</p>
            <p className="truncate text-[11px] text-muted-foreground">スターター</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
