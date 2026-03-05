"use client";

import { useState, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { conversations, accounts } from "@/data/mock";
import type { Channel } from "@/data/types";
import {
  Instagram,
  MessageCircle,
  Mail,
  Facebook,

  Inbox,
  Check,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from "lucide-react";

const channelIcons: Record<Channel, React.ElementType> = {
  instagram: Instagram,
  line: MessageCircle,
  email: Mail,
  facebook: Facebook,
};

const channelColors: Record<Channel, string> = {
  instagram: "oklch(0.62 0.24 330)",
  line: "oklch(0.60 0.17 145)",
  email: "oklch(0.52 0.14 250)",
  facebook: "oklch(0.50 0.18 285)",
};

const channelBgClasses: Record<Channel, string> = {
  instagram: "bg-channel-instagram",
  line: "bg-channel-line",
  email: "bg-channel-email",
  facebook: "bg-channel-facebook",
};

const channelLabels: Record<Channel, string> = {
  instagram: "Instagram",
  line: "LINE",
  email: "Email",
  facebook: "Facebook",
};

const dayLabels = ["月", "火", "水", "木", "金", "土", "日"];

function formatDateFull(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function generateWeekData(weekStart: Date) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return dayLabels.map((label, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const isFuture = date > today;
    const seed = date.getDate() + date.getMonth() * 31;
    const instagram = isFuture ? 0 : ((seed * 3 + 7) % 5) + 1;
    const line = isFuture ? 0 : ((seed * 5 + 3) % 4) + 1;
    const email = isFuture ? 0 : ((seed * 7 + 2) % 6) + 1;
    const facebook = isFuture ? 0 : (seed * 11) % 3;
    const resolved = isFuture ? 0 : Math.max(0, Math.floor((instagram + line + email + facebook) * 0.4 + ((seed * 13) % 3) - 1));
    return { label, date: formatDate(date), fullDate: date, instagram, line, email, facebook, resolved, isFuture };
  });
}

function WeekNav({ weekOffset, setWeekOffset, currentMonday, weekEnd }: {
  weekOffset: number; setWeekOffset: (fn: (p: number) => number) => void;
  currentMonday: Date; weekEnd: Date;
}) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => setWeekOffset((p) => p - 1)} className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
        <ChevronLeft className="h-6 w-6" />
      </button>
      <span className="text-[14px] font-medium text-muted-foreground text-center">
        {formatDateFull(currentMonday)} - {formatDate(weekEnd)}
      </span>
      <button onClick={() => setWeekOffset((p) => Math.min(p + 1, 0))} disabled={weekOffset >= 0}
        className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-default">
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  );
}

function BarTooltip({ d, x, y }: { d: ReturnType<typeof generateWeekData>[0]; x: number; y: number }) {
  const total = d.instagram + d.line + d.email + d.facebook;
  return (
    <div
      className="pointer-events-none fixed z-[300] rounded-lg bg-foreground/90 px-3 py-2 text-[12px] text-white shadow-lg"
      style={{ left: x, top: y - 8, transform: "translate(-50%, -100%)" }}
    >
      <p className="font-semibold mb-1">{d.date}（{d.label}） — 合計 {total}件 / 完了 {d.resolved}件</p>
      {(["instagram", "line", "email", "facebook"] as Channel[]).map((ch) => {
        const val = d[ch as keyof typeof d] as number;
        if (val === 0) return null;
        return (
          <div key={ch} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: channelColors[ch] }} />
            <span>{channelLabels[ch]}: {val}件</span>
          </div>
        );
      })}
    </div>
  );
}

// Pie chart component with hover tooltips
function ChannelPieChart() {
  const [hoveredSlice, setHoveredSlice] = useState<{ channel: Channel; count: number; x: number; y: number } | null>(null);
  const channelCounts = (["instagram", "line", "email", "facebook"] as Channel[]).map((ch) => ({
    channel: ch,
    count: conversations.filter((c) => c.channel === ch).length,
  }));
  const total = channelCounts.reduce((sum, c) => sum + c.count, 0);
  if (total === 0) return null;

  let cumulative = 0;
  const slices = channelCounts.filter((c) => c.count > 0).map((c) => {
    const startAngle = (cumulative / total) * 360;
    cumulative += c.count;
    const endAngle = (cumulative / total) * 360;
    return { ...c, startAngle, endAngle };
  });

  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  return (
    <div className="flex items-center gap-4">
      <svg width="72" height="72" viewBox="0 0 72 72" className="cursor-default">
        {slices.map((s) => {
          const start = polarToCartesian(36, 36, 30, s.startAngle);
          const end = polarToCartesian(36, 36, 30, s.endAngle);
          const largeArc = s.endAngle - s.startAngle > 180 ? 1 : 0;
          const d = `M36,36 L${start.x},${start.y} A30,30 0 ${largeArc},1 ${end.x},${end.y} Z`;
          return <path key={s.channel} d={d} fill={channelColors[s.channel]}
            className="transition-opacity hover:opacity-80"
            onMouseEnter={(e) => {
              const rect = (e.target as SVGPathElement).closest("svg")!.getBoundingClientRect();
              setHoveredSlice({ channel: s.channel, count: s.count, x: rect.left + rect.width / 2, y: rect.top });
            }}
            onMouseLeave={() => setHoveredSlice(null)}
          />;
        })}
      </svg>
      <div className="space-y-1">
        {slices.map((s) => (
          <div key={s.channel} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: channelColors[s.channel] }} />
            <span className="text-[12px] text-muted-foreground">{channelLabels[s.channel]} {s.count}</span>
          </div>
        ))}
      </div>
      {hoveredSlice && (
        <div className="pointer-events-none fixed z-[300] rounded-lg bg-foreground/90 px-3 py-2 text-[12px] text-white shadow-lg"
          style={{ left: hoveredSlice.x, top: hoveredSlice.y - 8, transform: "translate(-50%, -100%)" }}>
          {channelLabels[hoveredSlice.channel]}: {hoveredSlice.count}件 ({Math.round((hoveredSlice.count / total) * 100)}%)
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [weekOffset, setWeekOffset] = useState(0);

  const currentMonday = useMemo(() => {
    const monday = getMonday(new Date());
    monday.setDate(monday.getDate() + weekOffset * 7);
    return monday;
  }, [weekOffset]);

  const weekEnd = useMemo(() => {
    const sun = new Date(currentMonday);
    sun.setDate(currentMonday.getDate() + 6);
    return sun;
  }, [currentMonday]);

  return (
    <div className="flex h-full">
      {/* Left sub-navigation - just "レポート" title, no sub-tabs */}
      <div className="w-[220px] shrink-0 border-r bg-background px-3 py-4">
        <h1 className="mb-4 px-2.5 text-[15px] font-semibold">レポート</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full px-8 py-8">
          <SummaryReport weekOffset={weekOffset} setWeekOffset={setWeekOffset} currentMonday={currentMonday} weekEnd={weekEnd} />
        </div>
      </div>
    </div>
  );
}

/* ─── Summary Report ────── */

function SummaryReport({ weekOffset, setWeekOffset, currentMonday, weekEnd }: {
  weekOffset: number; setWeekOffset: (fn: (p: number) => number) => void;
  currentMonday: Date; weekEnd: Date;
}) {
  const total = conversations.length;
  const resolvedCount = conversations.filter((c) => c.status === "completed").length;

  const stackedData = useMemo(() => generateWeekData(currentMonday), [currentMonday]);
  const maxStacked = Math.max(...stackedData.map((d) => d.instagram + d.line + d.email + d.facebook));
  const maxResolved = Math.max(...stackedData.map((d) => d.resolved));

  const [hoveredBar, setHoveredBar] = useState<{ d: typeof stackedData[0]; x: number; y: number } | null>(null);

  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <h2 className="text-[19px] font-semibold">サマリー</h2>
        <WeekNav weekOffset={weekOffset} setWeekOffset={setWeekOffset} currentMonday={currentMonday} weekEnd={weekEnd} />
      </div>

      {/* Top metrics - 3 cards */}
      <div className="mb-8 grid grid-cols-3 gap-4 items-start">
        <div className="rounded-lg border bg-white px-5 py-5 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 mb-2">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <span className="text-[13px] text-muted-foreground">新着</span>
          </div>
          <p className="text-[28px] font-semibold tabular-nums">{total}</p>
          <div className="mt-2 text-[12px] text-muted-foreground">前週比 <span className="text-foreground font-medium">+12%</span></div>
        </div>
        <div className="rounded-lg border bg-white px-5 py-5 flex flex-col justify-between h-full">
          <div className="flex items-center gap-2 mb-2">
            <Check className="h-4 w-4 text-muted-foreground" />
            <span className="text-[13px] text-muted-foreground">完了数</span>
          </div>
          <p className="text-[28px] font-semibold tabular-nums">{resolvedCount}</p>
          <div className="mt-2 text-[12px] text-muted-foreground">前週比 <span className="text-foreground font-medium">+8%</span></div>
        </div>
        <div className="rounded-lg border bg-white px-5 py-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-[13px] text-muted-foreground">チャネル比率</span>
          </div>
          <ChannelPieChart />
        </div>
      </div>

      {/* Chart - single full-width stacked bar chart with line overlay */}
      <section className="rounded-lg border bg-white p-5 flex flex-col">
        <div className="mb-4">
          <h3 className="text-[15px] font-semibold">新着と完了数の推移</h3>
        </div>
        <div className="relative flex-1 min-h-[260px]">
          {/* SVG polyline overlay - uses same grid positioning as bars */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox={`0 0 ${stackedData.length * 100} 260`} preserveAspectRatio="none">
            <polyline fill="none" stroke="oklch(0.52 0.17 155)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              points={stackedData.map((d, i) => {
                const x = (i + 0.5) / stackedData.length * stackedData.length * 100;
                const y = maxResolved > 0 ? 260 - (d.resolved / maxResolved) * 240 : 260;
                return `${x},${y}`;
              }).join(" ")} />
            {stackedData.map((d, i) => {
              const x = (i + 0.5) / stackedData.length * stackedData.length * 100;
              const y = maxResolved > 0 ? 260 - (d.resolved / maxResolved) * 240 : 260;
              return <circle key={i} cx={x} cy={y} r="4" fill="white" stroke="oklch(0.52 0.17 155)" strokeWidth="2" vectorEffect="non-scaling-stroke" />;
            })}
          </svg>
          {/* Bars grid - equal columns */}
          <div className="relative grid h-[260px]" style={{ gridTemplateColumns: `repeat(${stackedData.length}, 1fr)` }}>
            {stackedData.map((d, i) => {
              const barTotal = d.instagram + d.line + d.email + d.facebook;
              const height = maxStacked > 0 ? (barTotal / maxStacked) * 250 : 0;
              return (
                <div key={i} className={cn("flex items-end justify-center", d.isFuture && "opacity-20")}
                  onMouseEnter={(e) => { if (!d.isFuture) { const rect = e.currentTarget.getBoundingClientRect(); setHoveredBar({ d, x: rect.left + rect.width / 2, y: rect.top }); } }}
                  onMouseLeave={() => setHoveredBar(null)}>
                  <div className={cn("w-[36px] flex flex-col-reverse rounded-t overflow-hidden transition-opacity",
                    hoveredBar && hoveredBar.d.date !== d.date ? "opacity-40" : "opacity-100"
                  )} style={{ height: `${height}px` }}>
                    {d.email > 0 && <div className="bg-channel-email" style={{ height: `${(d.email / barTotal) * 100}%` }} />}
                    {d.line > 0 && <div className="bg-channel-line" style={{ height: `${(d.line / barTotal) * 100}%` }} />}
                    {d.instagram > 0 && <div className="bg-channel-instagram" style={{ height: `${(d.instagram / barTotal) * 100}%` }} />}
                    {d.facebook > 0 && <div className="bg-channel-facebook" style={{ height: `${(d.facebook / barTotal) * 100}%` }} />}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Date labels grid - same columns */}
          <div className="grid mt-1" style={{ gridTemplateColumns: `repeat(${stackedData.length}, 1fr)` }}>
            {stackedData.map((d, i) => (
              <div key={i} className={cn("text-center", d.isFuture && "opacity-30")}>
                <div className="text-[11px] text-muted-foreground leading-tight">{d.date}</div>
                <div className="text-[10px] text-muted-foreground/60">{d.label}</div>
              </div>
            ))}
          </div>
        </div>
        {hoveredBar && <BarTooltip d={hoveredBar.d} x={hoveredBar.x} y={hoveredBar.y} />}
        <div className="mt-3 flex items-center gap-4">
          {(["instagram", "line", "email", "facebook"] as Channel[]).map((ch) => (
            <div key={ch} className="flex items-center gap-1.5">
              <div className={cn("h-3 w-3 rounded-sm", channelBgClasses[ch])} />
              <span className="text-[12px] text-muted-foreground">{channelLabels[ch]}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-3 rounded-full bg-brand" />
            <span className="text-[12px] text-muted-foreground">完了</span>
          </div>
        </div>
      </section>
    </>
  );
}
