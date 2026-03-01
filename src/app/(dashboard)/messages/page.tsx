"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  accounts,
  conversations as allConversations,
  teamMembers,
  currentUser,
  contacts,
  contactGroups,
} from "@/data/mock";
import type { Conversation, Message, Status, Channel, Contact } from "@/data/types";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { Avatar } from "@/components/ui/avatar";
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
  Check,
  CircleDashed,
  MessageSquareText,
  ChevronDown,
  ChevronRight,
  Search,
  Inbox,
  SlidersHorizontal,
  X,
  Trash2,
  User,
} from "lucide-react";

const channelIcons: Record<Channel, React.ElementType> = {
  instagram: Instagram,
  line: MessageCircle,
  email: Mail,
  facebook: Facebook,
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
  open: { label: "未対応", icon: CircleDashed },
  pending: { label: "保留中", icon: Clock },
  resolved: { label: "完了", icon: Check },
};

type FolderFilter = "all" | "open" | "pending" | "resolved" | "mine" | string;

function getContactHandle(conversation: Conversation): string | null {
  const contact = contacts.find((c) => c.id === conversation.contactId);
  if (!contact) return null;
  const ch = contact.channels.find((c) => c.channel === conversation.channel);
  return ch?.handle ?? null;
}

function getAccountName(accountId: string): string {
  return accounts.find((a) => a.id === accountId)?.name ?? "";
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState(allConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    allConversations[0]?.id ?? null
  );
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Status | "">("");
  const [filterChannel, setFilterChannel] = useState<Channel | "">("");

  const filtered = useMemo(() => {
    let list = conversations;

    switch (folderFilter) {
      case "all":
        break;
      case "open":
        list = list.filter((c) => c.status === "open");
        break;
      case "pending":
        list = list.filter((c) => c.status === "pending");
        break;
      case "resolved":
        list = list.filter((c) => c.status === "resolved");
        break;
      case "mine":
        list = list.filter((c) => c.assignee?.id === currentUser.id);
        break;
      default:
        list = list.filter((c) => c.accountId === folderFilter);
        break;
    }

    if (filterStatus) {
      list = list.filter((c) => c.status === filterStatus);
    }
    if (filterChannel) {
      list = list.filter((c) => c.channel === filterChannel);
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
  }, [conversations, folderFilter, searchQuery, filterStatus, filterChannel]);

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
    return {
      all: conversations.length,
      open: conversations.filter((c) => c.status === "open").length,
      pending: conversations.filter((c) => c.status === "pending").length,
      resolved: conversations.filter((c) => c.status === "resolved").length,
      mine: conversations.filter((c) => c.assignee?.id === currentUser.id)
        .length,
    };
  }, [conversations]);

  const accountCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const acc of accounts) {
      map[acc.id] = conversations.filter((c) => c.accountId === acc.id).length;
    }
    return map;
  }, [conversations]);

  const detailContact = detailContactId
    ? contacts.find((c) => c.id === detailContactId) ?? null
    : null;

  return (
    <div className="flex h-full">
      {/* ── Layer 2: Folders / Accounts (220px) ── */}
      <div className="flex h-full w-[220px] shrink-0 flex-col border-r bg-background">
        <div className="shrink-0 px-3 pt-4 pb-2">
          <h2 className="px-2 text-[13px] font-semibold text-foreground">
            受信トレイ
          </h2>
        </div>

        <nav className="flex-1 overflow-y-auto px-2">
          {/* Status folders */}
          <div className="space-y-0.5">
            <FolderItem
              icon={Inbox}
              label="すべて"
              count={counts.all}
              isActive={folderFilter === "all"}
              onClick={() => setFolderFilter("all")}
            />
            <FolderItem
              icon={CircleDashed}
              label="未対応"
              count={counts.open}
              isActive={folderFilter === "open"}
              onClick={() => setFolderFilter("open")}
            />
            <FolderItem
              icon={Clock}
              label="保留中"
              count={counts.pending}
              isActive={folderFilter === "pending"}
              onClick={() => setFolderFilter("pending")}
            />
            <FolderItem
              icon={Check}
              label="完了"
              count={counts.resolved}
              isActive={folderFilter === "resolved"}
              onClick={() => setFolderFilter("resolved")}
            />
            <FolderItemWithAvatar
              label="自分の担当"
              count={counts.mine}
              isActive={folderFilter === "mine"}
              onClick={() => setFolderFilter("mine")}
            />
          </div>

          {/* Accounts section */}
          <div className="mt-5">
            <h3 className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              アカウント
            </h3>
            <div className="space-y-0.5">
              {accounts.map((account) => {
                const Icon = channelIcons[account.channel];
                return (
                  <FolderItem
                    key={account.id}
                    icon={Icon}
                    label={account.name}
                    count={accountCounts[account.id]}
                    isActive={folderFilter === account.id}
                    onClick={() => setFolderFilter(account.id)}
                    iconColor={channelStyles[account.channel].text}
                  />
                );
              })}
            </div>
          </div>
        </nav>
      </div>

      {/* ── Layer 3: Thread list (320px) ── */}
      <div className="flex h-full w-[320px] shrink-0 flex-col border-r bg-background">
        {/* Search */}
        <div className="shrink-0 px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="スレッドを検索..."
              className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/50"
            />
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={cn(
                "cursor-pointer rounded p-0.5 transition-colors",
                showFilter
                  ? "bg-brand/10 text-brand"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Filter panel */}
          {showFilter && (
            <div className="mt-2 space-y-2 rounded-md border p-2.5">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">ステータス</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as Status | "")}
                  className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-[11px] outline-none"
                >
                  <option value="">すべて</option>
                  <option value="open">未対応</option>
                  <option value="pending">保留中</option>
                  <option value="resolved">完了</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground">チャネル</label>
                <select
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value as Channel | "")}
                  className="mt-0.5 w-full rounded border bg-background px-2 py-1 text-[11px] outline-none"
                >
                  <option value="">すべて</option>
                  <option value="email">Email</option>
                  <option value="line">LINE</option>
                  <option value="instagram">Instagram</option>
                </select>
              </div>
              {(filterStatus || filterChannel) && (
                <button
                  onClick={() => { setFilterStatus(""); setFilterChannel(""); }}
                  className="cursor-pointer text-[10px] text-brand hover:underline"
                >
                  フィルターをクリア
                </button>
              )}
            </div>
          )}
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Inbox className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-[12px]">該当するスレッドがありません</p>
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

      {/* ── Layer 4: Thread detail ── */}
      {selectedConversation ? (
        <ConversationDetail
          conversation={selectedConversation}
          onStatusChange={handleStatusChange}
          onAssigneeChange={handleAssigneeChange}
          onOpenContactDetail={(contactId) => setDetailContactId(contactId)}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10 opacity-20" />
            <p className="text-[13px]">スレッドを選択してください</p>
          </div>
        </div>
      )}

      {/* ── Layer 5: Contact detail slide panel ── */}
      {detailContact && (
        <ContactSlidePanel
          contact={detailContact}
          onClose={() => setDetailContactId(null)}
        />
      )}
    </div>
  );
}

/* ─── Folder Item ─────────────────────────────────────── */

function FolderItem({
  icon: Icon,
  label,
  count,
  isActive,
  onClick,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  iconColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors cursor-pointer",
        isActive
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-[16px] w-[16px] shrink-0",
          !isActive && iconColor
        )}
      />
      <span className="flex-1 truncate text-left">{label}</span>
      {count > 0 && (
        <span className="text-[11px] tabular-nums text-muted-foreground/60">
          {count}
        </span>
      )}
    </button>
  );
}

function FolderItemWithAvatar({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors cursor-pointer",
        isActive
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <Avatar
        src={currentUser.avatar}
        fallback={currentUser.name}
        size="sm"
        className="h-[16px] w-[16px] text-[5px]"
      />
      <span className="flex-1 truncate text-left">{label}</span>
      {count > 0 && (
        <span className="text-[11px] tabular-nums text-muted-foreground/60">
          {count}
        </span>
      )}
    </button>
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
  const handle = getContactHandle(conversation);
  const StatusIcon = statusConfig[status].icon;

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full gap-3 border-b px-4 py-3 text-left transition-colors cursor-pointer",
        isSelected
          ? "bg-brand/12"
          : unreadCount > 0
            ? "bg-brand/4"
            : "bg-background hover:bg-accent/40"
      )}
    >
      {/* Channel icon */}
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full mt-0.5",
          style.bg
        )}
      >
        <Icon className={cn("h-[18px] w-[18px]", style.text)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
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

        {handle && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
            {handle}
          </p>
        )}

        {subject && (
          <p className="mt-0.5 truncate text-[11px] font-medium text-foreground/70">
            {subject}
          </p>
        )}

        <p className="mt-0.5 truncate text-[11px] leading-relaxed text-muted-foreground">
          {lastMessage}
        </p>

        {/* Assignee (left) + Status (right) */}
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {assignee ? (
              <span className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                <Avatar
                  src={assignee.avatar}
                  fallback={assignee.name}
                  size="sm"
                  className="h-4 w-4 text-[6px]"
                />
                {assignee.name}
              </span>
            ) : (
              <span className="text-[10px] font-medium text-muted-foreground/60">
                未アサイン
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-[9px] font-medium text-muted-foreground/60">
            <StatusIcon className="h-3 w-3" />
            {statusConfig[status].label}
          </span>
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
  onOpenContactDetail,
}: {
  conversation: Conversation;
  onStatusChange: (id: string, status: Status) => void;
  onAssigneeChange: (id: string, assigneeId: string | null) => void;
  onOpenContactDetail: (contactId: string) => void;
}) {
  const [replyText, setReplyText] = useState("");
  const [memoText, setMemoText] = useState("");
  const [emailFrom, setEmailFrom] = useState("info@myshop.jp");
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");

  const Icon = channelIcons[conversation.channel];
  const style = channelStyles[conversation.channel];
  const handle = getContactHandle(conversation);

  // Initialize email fields from conversation data
  const isEmail = conversation.channel === "email";
  const isSelfAssigned = conversation.assignee?.id === currentUser.id;
  const isUnassigned = !conversation.assignee;

  useEffect(() => {
    if (isEmail) {
      const contactObj = contacts.find((c) => c.id === conversation.contactId);
      const contactEmail = contactObj?.channels.find((ch) => ch.channel === "email")?.handle ?? "";
      setEmailTo(contactEmail);
      setEmailSubject(conversation.subject ? `Re: ${conversation.subject}` : "");
      setEmailFrom("info@myshop.jp");
      setEmailCc("");
      setEmailBcc("");
    }
  }, [conversation.id, isEmail, conversation.contactId, conversation.subject]);

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      {/* Header */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              style.bg
            )}
          >
            <Icon className={cn("h-4 w-4", style.text)} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenContactDetail(conversation.contactId)}
                className="cursor-pointer truncate text-[14px] font-semibold hover:text-brand transition-colors"
              >
                {conversation.contactName}
              </button>
            </div>
            {handle && (
              <p className="truncate text-[11px] text-muted-foreground">
                {handle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Assignee dropdown (left) */}
          <Dropdown
            align="right"
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-[11px]"
              >
                {conversation.assignee ? (
                  <>
                    <Avatar
                      src={conversation.assignee.avatar}
                      fallback={conversation.assignee.name}
                      size="sm"
                      className="h-4 w-4 text-[6px]"
                    />
                    {conversation.assignee.name}
                  </>
                ) : (
                  <>
                    <User className="h-3 w-3" />
                    未アサイン
                  </>
                )}
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
                <Avatar
                  src={m.avatar}
                  fallback={m.name}
                  size="sm"
                  className="h-4 w-4 text-[6px]"
                />
                {m.name}
              </DropdownItem>
            ))}
          </Dropdown>

          {/* Status dropdown (right) */}
          <Dropdown
            align="right"
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-[11px]"
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

          {/* More options - always visible */}
          <Dropdown
            align="right"
            trigger={
              <Button variant="ghost" size="icon-sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          >
            <DropdownItem onClick={() => onOpenContactDetail(conversation.contactId)}>
              連絡先を表示
            </DropdownItem>
            <DropdownItem>会話をアーカイブ</DropdownItem>
            <DropdownItem className="text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
              削除
            </DropdownItem>
          </Dropdown>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto max-w-2xl space-y-4">
          {conversation.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              channel={conversation.channel}
            />
          ))}
        </div>
      </div>

      {/* Reply + Memo area */}
      <div className="border-t">
        {/* Input control overlay */}
        {!isSelfAssigned && (
          <div className="relative">
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-[1px] rounded-t-lg">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-8 gap-1.5 bg-brand hover:bg-brand/90 text-[12px]"
                  onClick={() => onAssigneeChange(conversation.id, currentUser.id)}
                >
                  自分にアサイン
                </Button>
                <Dropdown
                  align="right"
                  trigger={
                    <Button variant="outline" size="sm" className="h-8 text-[12px]">
                      他の人をアサイン
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  }
                >
                  {teamMembers.filter((m) => m.id !== currentUser.id).map((m) => (
                    <DropdownItem
                      key={m.id}
                      onClick={() => onAssigneeChange(conversation.id, m.id)}
                    >
                      <Avatar
                        src={m.avatar}
                        fallback={m.name}
                        size="sm"
                        className="h-4 w-4 text-[6px]"
                      />
                      {m.name}
                    </DropdownItem>
                  ))}
                </Dropdown>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 py-3">
          <div className="mx-auto max-w-2xl space-y-2">
            {/* Email header fields */}
            {isEmail && isSelfAssigned && (
              <div className="space-y-1 rounded-lg border bg-accent/20 px-3 py-2">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-10 shrink-0 text-right font-medium text-muted-foreground">From</span>
                  <input value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} className="flex-1 bg-transparent outline-none text-[11px]" />
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-10 shrink-0 text-right font-medium text-muted-foreground">To</span>
                  <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} className="flex-1 bg-transparent outline-none text-[11px]" />
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-10 shrink-0 text-right font-medium text-muted-foreground">CC</span>
                  <input value={emailCc} onChange={(e) => setEmailCc(e.target.value)} className="flex-1 bg-transparent outline-none text-[11px]" placeholder="任意" />
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-10 shrink-0 text-right font-medium text-muted-foreground">BCC</span>
                  <input value={emailBcc} onChange={(e) => setEmailBcc(e.target.value)} className="flex-1 bg-transparent outline-none text-[11px]" placeholder="任意" />
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="w-10 shrink-0 text-right font-medium text-muted-foreground">件名</span>
                  <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className="flex-1 bg-transparent outline-none text-[11px]" />
                </div>
              </div>
            )}

            {/* Reply input - Slack style */}
            <div className="rounded-lg border bg-background focus-within:border-brand/30">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="メッセージを入力..."
                rows={3}
                disabled={!isSelfAssigned}
                className="w-full resize-none bg-transparent px-3 pt-2.5 pb-0 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground/50 disabled:opacity-40"
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 160) + "px";
                }}
              />
              <div className="flex items-center justify-between px-3 pb-2">
                <Tooltip content="ファイルを添付" side="top">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    disabled={!isSelfAssigned}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </Tooltip>
                <Button
                  size="sm"
                  className="h-7 rounded-md bg-brand hover:bg-brand/90 px-3 text-[11px]"
                  disabled={!replyText.trim() || !isSelfAssigned}
                >
                  <Send className="h-3 w-3 mr-1" />
                  送信
                </Button>
              </div>
            </div>

            {/* Internal memo input - full width, icon only centered */}
            <div className="rounded-lg border border-amber-200/50 bg-amber-50/30">
              <div className="flex items-center justify-center py-1">
                <MessageSquareText className="h-4 w-4 text-amber-500" />
              </div>
              <textarea
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                placeholder="社内メモを入力"
                rows={1}
                className="w-full resize-none bg-transparent px-3 pb-1 text-[12px] leading-relaxed outline-none placeholder:text-amber-400/60"
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 80) + "px";
                }}
              />
              {memoText.trim() && (
                <div className="flex justify-end px-3 pb-2">
                  <Button
                    size="icon-sm"
                    className="rounded-md bg-amber-500 hover:bg-amber-600"
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Message Bubble ─────────────────────────────────── */

function MessageBubble({
  message,
  channel,
}: {
  message: Message;
  channel: Channel;
}) {
  const { content, timestamp, isInbound, senderName, isInternal, emailHeader } = message;
  const [headerExpanded, setHeaderExpanded] = useState(false);

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

        {/* Email header (collapsible) */}
        {channel === "email" && emailHeader && (
          <div className="mb-1">
            <button
              onClick={() => setHeaderExpanded(!headerExpanded)}
              className="flex cursor-pointer items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <ChevronRight className={cn("h-3 w-3 transition-transform", headerExpanded && "rotate-90")} />
              <span className="font-medium">{emailHeader.subject}</span>
            </button>
            {headerExpanded && (
              <div className="ml-4 mt-1 space-y-0.5 text-[10px] text-muted-foreground/60">
                {emailHeader.to && (
                  <p><span className="font-medium">To:</span> {emailHeader.to}</p>
                )}
                {emailHeader.cc && (
                  <p><span className="font-medium">CC:</span> {emailHeader.cc}</p>
                )}
                {emailHeader.bcc && (
                  <p><span className="font-medium">BCC:</span> {emailHeader.bcc}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed",
            isInbound
              ? "rounded-tl-sm bg-secondary text-secondary-foreground"
              : "rounded-tr-sm bg-brand text-brand-foreground"
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
    </div>
  );
}

/* ─── Contact Slide Panel (Layer 5) ──────────────────── */

function ContactSlidePanel({
  contact,
  onClose,
}: {
  contact: Contact;
  onClose: () => void;
}) {
  const contactConversations = allConversations.filter((c) =>
    contact.conversationIds.includes(c.id)
  );

  const memberGroups = contactGroups.filter(
    (g) => g.id !== "grp-all" && g.contactIds.includes(contact.id)
  );

  return (
    <div className="flex h-full w-[320px] min-w-[260px] max-w-[400px] shrink-0 flex-col border-l bg-background animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-[14px] font-semibold">連絡先詳細</h3>
        <div className="flex items-center gap-1">
          <Dropdown
            align="right"
            trigger={
              <button className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            }
          >
            <DropdownItem className="text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
              削除
            </DropdownItem>
          </Dropdown>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Profile */}
        <div className="mb-5 flex items-center gap-3">
          <Avatar fallback={contact.name} size="lg" />
          <div>
            <p className="text-[15px] font-semibold">{contact.name}</p>
            {contact.email && (
              <p className="text-[11px] text-muted-foreground">
                {contact.email}
              </p>
            )}
          </div>
        </div>

        {/* Basic info */}
        <div className="space-y-4">
          <section>
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              基本情報
            </h4>
            <div className="space-y-1.5 text-[12px]">
              {contact.email && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">メール</span>
                  <span>{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">電話番号</span>
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.channels.map((ch) => (
                <div key={ch.channel} className="flex items-center justify-between">
                  <span className="text-muted-foreground capitalize">{ch.channel}</span>
                  <span>{ch.handle}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Groups */}
          <section>
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              所属グループ
            </h4>
            {memberGroups.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/60">所属グループなし</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {memberGroups.map((g) => (
                  <span
                    key={g.id}
                    className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-foreground/70"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Conversation history */}
          <section>
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              過去の会話
            </h4>
            <div className="space-y-1.5">
              {contactConversations.map((conv) => {
                const CIcon = channelIcons[conv.channel];
                const s = channelStyles[conv.channel];
                const accName = getAccountName(conv.accountId);
                return (
                  <div
                    key={conv.id}
                    className="flex items-start gap-2.5 rounded-md border px-3 py-2"
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5",
                        s.bg
                      )}
                    >
                      <CIcon className={cn("h-3 w-3", s.text)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium">
                        {conv.subject || conv.lastMessage}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        To: {accName}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {conv.lastMessageAt}
                      </p>
                    </div>
                    <Badge variant={conv.status} className="text-[9px] px-1.5 py-0 shrink-0">
                      {statusConfig[conv.status].label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Notes */}
          {contact.note && (
            <section>
              <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                メモ
              </h4>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {contact.note}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
