"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  accounts,
  conversations as allConversations,
  teamMembers,
  currentUser,
} from "@/data/mock";
import type { Conversation, Message, Status, Channel } from "@/data/types";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Instagram,
  MessageCircle,
  Mail,
  Facebook,
  Send,
  Paperclip,
  MoreHorizontal,
  UserPlus,
  Clock,
  CheckCircle2,
  CircleDot,
  MessageSquareText,
  ChevronDown,
  Search,
  Check,
  User,
  Inbox,
} from "lucide-react";

const channelIcons: Record<Channel, React.ElementType> = {
  instagram: Instagram,
  line: MessageCircle,
  email: Mail,
  facebook: Facebook,
};

const channelLabels: Record<Channel, string> = {
  instagram: "Instagram",
  line: "LINE",
  email: "Email",
  facebook: "Facebook",
};

const channelStyles: Record<Channel, { bg: string; text: string }> = {
  instagram: { bg: "bg-channel-instagram/10", text: "text-channel-instagram" },
  line: { bg: "bg-channel-line/10", text: "text-channel-line" },
  email: { bg: "bg-channel-email/10", text: "text-channel-email" },
  facebook: { bg: "bg-channel-facebook/10", text: "text-channel-facebook" },
};

const statusConfig: Record<
  Status,
  { label: string; icon: React.ElementType }
> = {
  open: { label: "未対応", icon: CircleDot },
  pending: { label: "保留中", icon: Clock },
  resolved: { label: "完了", icon: CheckCircle2 },
};

export default function MessagesPage() {
  const [conversations, setConversations] = useState(allConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    allConversations[0]?.id ?? null
  );
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [onlyMine, setOnlyMine] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let list = conversations;
    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (channelFilter !== "all") {
      list = list.filter((c) => c.channel === channelFilter);
    }
    if (onlyMine) {
      list = list.filter((c) => c.assignee?.id === currentUser.id);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.contactName.toLowerCase().includes(q) ||
          c.lastMessage.toLowerCase().includes(q) ||
          (c.subject && c.subject.toLowerCase().includes(q))
      );
    }
    return list;
  }, [conversations, statusFilter, channelFilter, onlyMine, searchQuery]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const handleStatusChange = useCallback((id: string, status: Status) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
  }, []);

  const handleAssigneeChange = useCallback(
    (id: string, assigneeId: string | null) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                assignee: assigneeId
                  ? teamMembers.find((m) => m.id === assigneeId)
                  : undefined,
              }
            : c
        )
      );
    },
    []
  );

  const counts = useMemo(() => {
    let base = conversations;
    if (channelFilter !== "all") {
      base = base.filter((c) => c.channel === channelFilter);
    }
    if (onlyMine) {
      base = base.filter((c) => c.assignee?.id === currentUser.id);
    }
    return {
      all: base.length,
      open: base.filter((c) => c.status === "open").length,
      pending: base.filter((c) => c.status === "pending").length,
      resolved: base.filter((c) => c.status === "resolved").length,
    };
  }, [conversations, channelFilter, onlyMine]);

  // Unique channels from accounts
  const availableChannels = useMemo(() => {
    const channels = [...new Set(accounts.map((a) => a.channel))];
    return channels;
  }, []);

  return (
    <div className="flex h-full">
      {/* ── Second column: Conversation list ── */}
      <div className="flex h-full w-[340px] shrink-0 flex-col border-r bg-background">
        {/* Header */}
        <div className="shrink-0 px-4 pt-4 pb-2">
          <h1 className="text-[15px] font-semibold text-foreground">
            メッセージ
          </h1>
        </div>

        {/* Filters */}
        <div className="shrink-0 border-b px-3 pb-2.5 space-y-2">
          {/* Status tabs */}
          <div className="flex gap-1">
            {(["all", "open", "pending", "resolved"] as const).map((s) => {
              const isActive = statusFilter === s;
              const label = s === "all" ? "すべて" : statusConfig[s].label;
              const count = counts[s];
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-md px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {label}
                  {count > 0 && (
                    <span className="ml-1 opacity-70">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Channel filter + my assignments + search */}
          <div className="flex items-center gap-2">
            {/* Channel filter */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setChannelFilter("all")}
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors cursor-pointer",
                  channelFilter === "all"
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                全Ch
              </button>
              {availableChannels.map((ch) => {
                const Icon = channelIcons[ch];
                const style = channelStyles[ch];
                const isActive = channelFilter === ch;
                return (
                  <button
                    key={ch}
                    onClick={() => setChannelFilter(ch)}
                    title={channelLabels[ch]}
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded transition-colors cursor-pointer",
                      isActive
                        ? cn(style.bg, style.text)
                        : "text-muted-foreground/50 hover:text-muted-foreground"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </button>
                );
              })}
            </div>

            <div className="h-3 w-px bg-border" />

            {/* My assignments */}
            <label className="flex items-center gap-1 cursor-pointer select-none">
              <button
                onClick={() => setOnlyMine(!onlyMine)}
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors cursor-pointer",
                  onlyMine
                    ? "bg-foreground border-foreground"
                    : "border-input hover:border-foreground/30"
                )}
              >
                {onlyMine && (
                  <Check className="h-2.5 w-2.5 text-background" />
                )}
              </button>
              <span className="text-[10px] text-muted-foreground">自分</span>
            </label>

            {/* Search */}
            <div className="ml-auto flex items-center gap-1.5 rounded-md border px-2 py-1">
              <Search className="h-3 w-3 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="検索"
                className="w-16 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-[12px]">該当する会話がありません</p>
            </div>
          ) : (
            filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={conv.id === selectedId}
                onSelect={() => setSelectedId(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Third column: Conversation detail ── */}
      {selectedConversation ? (
        <ConversationDetail
          conversation={selectedConversation}
          onStatusChange={handleStatusChange}
          onAssigneeChange={handleAssigneeChange}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Inbox className="mx-auto h-10 w-10 mb-3 opacity-20" />
            <p className="text-[13px]">会話を選択してください</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Conversation List Item ─────────────────────────── */

function ConversationItem({
  conversation,
  isSelected,
  onSelect,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const {
    contactName,
    channel,
    status,
    lastMessage,
    lastMessageAt,
    unreadCount,
    assignee,
    subject,
  } = conversation;

  const Icon = channelIcons[channel];
  const style = channelStyles[channel];

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full gap-3 border-b px-4 py-3 text-left transition-colors cursor-pointer",
        isSelected ? "bg-accent/70" : "hover:bg-accent/40",
        unreadCount > 0 && !isSelected && "bg-accent/25"
      )}
    >
      {/* Channel icon */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-0.5",
          style.bg
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", style.text)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "truncate text-[13px]",
              unreadCount > 0
                ? "font-semibold text-foreground"
                : "font-medium text-foreground"
            )}
          >
            {contactName}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {lastMessageAt}
          </span>
        </div>

        {subject && (
          <p className="truncate text-[11px] font-medium text-foreground/70 mt-0.5">
            {subject}
          </p>
        )}

        <p className="mt-0.5 truncate text-[11px] leading-relaxed text-muted-foreground">
          {lastMessage}
        </p>

        {/* Status + assignee row */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <Badge
            variant={status}
            className="text-[9px] px-1.5 py-0 leading-4"
          >
            {statusConfig[status].label}
          </Badge>
          {assignee ? (
            <span className="truncate text-[10px] text-muted-foreground">
              {assignee.name}
            </span>
          ) : (
            <span className="text-[10px] font-medium text-status-pending">
              未アサイン
            </span>
          )}
          {unreadCount > 0 && (
            <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] font-bold text-background">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Conversation Detail ────────────────────────────── */

function ConversationDetail({
  conversation,
  onStatusChange,
  onAssigneeChange,
}: {
  conversation: Conversation;
  onStatusChange: (id: string, status: Status) => void;
  onAssigneeChange: (id: string, assigneeId: string | null) => void;
}) {
  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const Icon = channelIcons[conversation.channel];
  const style = channelStyles[conversation.channel];

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      {/* Header */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b px-5">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              style.bg
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", style.text)} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[14px] font-semibold">
                {conversation.contactName}
              </h3>
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[9px] font-medium",
                  style.bg,
                  style.text
                )}
              >
                {channelLabels[conversation.channel]}
              </span>
            </div>
            {conversation.subject && (
              <p className="truncate text-[11px] text-muted-foreground">
                {conversation.subject}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Status dropdown */}
          <Dropdown
            align="right"
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-[11px] h-7"
              >
                {(() => {
                  const s = statusConfig[conversation.status];
                  const SIcon = s.icon;
                  return (
                    <>
                      <SIcon className="h-3 w-3" />
                      {s.label}
                      <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
                    </>
                  );
                })()}
              </Button>
            }
          >
            {(Object.keys(statusConfig) as Status[]).map((s) => {
              const conf = statusConfig[s];
              const SIcon = conf.icon;
              return (
                <DropdownItem
                  key={s}
                  active={s === conversation.status}
                  onClick={() => onStatusChange(conversation.id, s)}
                >
                  <SIcon className="h-3.5 w-3.5" />
                  {conf.label}
                </DropdownItem>
              );
            })}
          </Dropdown>

          {/* Assignee dropdown */}
          <Dropdown
            align="right"
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-[11px] h-7"
              >
                <User className="h-3 w-3" />
                {conversation.assignee
                  ? conversation.assignee.name
                  : "未アサイン"}
                <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
              </Button>
            }
          >
            <DropdownItem
              active={!conversation.assignee}
              onClick={() => onAssigneeChange(conversation.id, null)}
            >
              <UserPlus className="h-3.5 w-3.5" />
              未アサイン
            </DropdownItem>
            {teamMembers.map((m) => (
              <DropdownItem
                key={m.id}
                active={conversation.assignee?.id === m.id}
                onClick={() => onAssigneeChange(conversation.id, m.id)}
              >
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[8px] font-medium">
                  {m.name.charAt(0)}
                </div>
                {m.name}
              </DropdownItem>
            ))}
          </Dropdown>

          {/* More options */}
          <Dropdown
            align="right"
            trigger={
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          >
            <DropdownItem>連絡先を表示</DropdownItem>
            <DropdownItem>会話をアーカイブ</DropdownItem>
          </Dropdown>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto max-w-2xl space-y-4">
          {conversation.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </div>

      {/* Reply */}
      <div className="border-t px-5 py-3">
        <div className="mx-auto max-w-2xl">
          <div className="mb-2 flex items-center gap-1.5">
            <button
              onClick={() => setIsInternal(false)}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                !isInternal
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              返信
            </button>
            <button
              onClick={() => setIsInternal(true)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                isInternal
                  ? "bg-amber-500/10 text-amber-600"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquareText className="h-3 w-3" />
              社内メモ
            </button>
          </div>

          <div
            className={cn(
              "flex items-end gap-2 rounded-lg border px-3 py-2 transition-colors",
              isInternal
                ? "border-amber-300/50 bg-amber-50/40"
                : "bg-background focus-within:border-foreground/20"
            )}
          >
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={
                isInternal
                  ? "チームへのメモを入力..."
                  : "メッセージを入力..."
              }
              rows={1}
              className="flex-1 resize-none bg-transparent py-1 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground/50"
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 120) + "px";
              }}
            />
            <div className="flex items-center gap-1 pb-0.5">
              <Tooltip content="ファイルを添付" side="top">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </Tooltip>
              <Button
                size="icon-sm"
                className={cn(
                  "rounded-md",
                  isInternal && "bg-amber-500 hover:bg-amber-600"
                )}
                disabled={!replyText.trim()}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Message Bubble ─────────────────────────────────── */

function MessageBubble({ message }: { message: Message }) {
  const { content, timestamp, isInbound, senderName, isInternal } = message;

  if (isInternal) {
    return (
      <div className="flex justify-center">
        <div className="max-w-md rounded-lg border border-amber-200/60 bg-amber-50/40 px-4 py-2.5">
          <div className="mb-1 flex items-center gap-1.5">
            <MessageSquareText className="h-3 w-3 text-amber-500" />
            <span className="text-[10px] font-medium text-amber-600">
              社内メモ — {senderName}
            </span>
          </div>
          <p className="text-[12px] leading-relaxed text-amber-900/70">
            {content}
          </p>
          <p className="mt-1 text-[10px] text-amber-400">{timestamp}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-2.5",
        isInbound ? "justify-start" : "justify-end"
      )}
    >
      {isInbound && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground mt-5">
          {senderName.charAt(0)}
        </div>
      )}

      <div
        className={cn(
          "max-w-[70%] space-y-1",
          !isInbound && "items-end"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-1.5",
            !isInbound && "justify-end"
          )}
        >
          <span className="text-[10px] font-medium text-muted-foreground">
            {senderName}
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            {timestamp}
          </span>
        </div>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed",
            isInbound
              ? "rounded-tl-sm bg-secondary text-secondary-foreground"
              : "rounded-tr-sm bg-foreground text-background"
          )}
        >
          {content.split("\n").map((line, i) => (
            <span key={i}>
              {line}
              {i < content.split("\n").length - 1 && <br />}
            </span>
          ))}
        </div>
      </div>

      {!isInbound && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-medium text-background mt-5">
          {senderName.charAt(0)}
        </div>
      )}
    </div>
  );
}
