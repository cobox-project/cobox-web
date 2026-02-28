"use client";

import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChannelIcon } from "./channel-icon";
import type { Conversation, Status } from "@/data/types";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: Status | "all";
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  filter,
}: ConversationListProps) {
  const filtered =
    filter === "all"
      ? conversations
      : conversations.filter((c) => c.status === filter);

  return (
    <div className="flex h-full w-[340px] flex-col border-r bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-5">
        <h2 className="text-[15px] font-semibold text-foreground">
          会話
          <span className="ml-2 text-[13px] font-normal text-muted-foreground">
            {filtered.length}
          </span>
        </h2>
        <div className="flex items-center gap-1">
          <Badge variant={filter === "all" ? "default" : filter} className="capitalize">
            {filter === "all" ? "すべて" : filter === "open" ? "未対応" : filter === "pending" ? "保留中" : "完了"}
          </Badge>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-[13px]">該当する会話がありません</p>
          </div>
        ) : (
          filtered.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={conv.id === selectedId}
              onSelect={() => onSelect(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ConversationItem({
  conversation,
  isSelected,
  onSelect,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { contactName, contactInitials, channel, status, lastMessage, lastMessageAt, unreadCount, assignee, subject } =
    conversation;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full gap-3 border-b px-5 py-3.5 text-left transition-colors duration-100 cursor-pointer",
        isSelected
          ? "bg-accent/70"
          : "hover:bg-accent/40",
        unreadCount > 0 && !isSelected && "bg-accent/20"
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0 pt-0.5">
        <Avatar fallback={contactInitials} size="md" />
        <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background p-[2px]">
          <ChannelIcon channel={channel} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-[13px]",
              unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground"
            )}
          >
            {contactName}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {lastMessageAt}
          </span>
        </div>

        {subject && (
          <p className="truncate text-[12px] font-medium text-foreground/80 mt-0.5">
            {subject}
          </p>
        )}

        <p
          className={cn(
            "mt-0.5 truncate text-[12px] leading-relaxed",
            unreadCount > 0 ? "text-foreground/70" : "text-muted-foreground"
          )}
        >
          {lastMessage}
        </p>

        {/* Meta row */}
        <div className="mt-1.5 flex items-center gap-2">
          <Badge variant={status} className="text-[10px] px-1.5 py-0">
            {status === "open" ? "未対応" : status === "pending" ? "保留" : "完了"}
          </Badge>
          {assignee && (
            <span className="text-[11px] text-muted-foreground">
              {assignee.name}
            </span>
          )}
          {unreadCount > 0 && (
            <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold text-background">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
