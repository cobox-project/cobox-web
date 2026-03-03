"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Check,
  CircleDashed,
  MessageSquareText,
  ChevronDown,
  ChevronRight,
  Search,
  Inbox,
  X,
  Trash2,
  Star,
  Ban,
  AlertTriangle,
  AtSign,
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

type FolderFilter = "all" | "mine" | "mentioned" | "resolved" | "favorite" | "spam";

function getAccountName(accountId: string): string {
  return accounts.find((a) => a.id === accountId)?.name ?? "";
}

function isUnread(conv: Conversation): boolean {
  return conv.isRead === false || conv.unreadCount > 0;
}

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState(allConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    allConversations[0]?.id ?? null
  );
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = conversations;

    if (folderFilter !== "spam") {
      list = list.filter((c) => !c.isSpam);
    }

    // Account filter
    if (accountFilter) {
      list = list.filter((c) => c.accountId === accountFilter);
    }

    // Group filter
    if (groupFilter) {
      const group = contactGroups.find((g) => g.id === groupFilter);
      if (group) {
        list = list.filter((c) => group.contactIds.includes(c.contactId));
      }
    }

    switch (folderFilter) {
      case "all":
        break;
      case "mine":
        list = list.filter((c) => c.assignee?.id === currentUser.id);
        break;
      case "mentioned":
        list = list.filter((c) => c.messages.some((m) => m.isInternal && m.content.includes(`@${currentUser.name}`)));
        break;
      case "resolved":
        list = list.filter((c) => c.status === "resolved");
        break;
      case "favorite":
        list = list.filter((c) => c.isFavorite);
        break;
      case "spam":
        list = list.filter((c) => c.isSpam);
        break;
    }

    if (unreadOnly) {
      list = list.filter(isUnread);
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
  }, [conversations, folderFilter, accountFilter, groupFilter, searchQuery, unreadOnly]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const handleStatusChange = useCallback((id: string, status: Status) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const updated = { ...c, status };
        // If resolved, remove assignee
        if (status === "resolved") {
          return { ...updated, assignee: undefined, needsAction: false };
        }
        return updated;
      })
    );
  }, []);

  const handleAssigneeChange = useCallback(
    (id: string, assigneeId: string | null) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          return {
            ...c,
            assignee: assigneeId
              ? teamMembers.find((m) => m.id === assigneeId)
              : undefined,
            // Auto set needsAction when assigned
            needsAction: assigneeId ? true : c.needsAction,
          };
        })
      );
    },
    []
  );

  const handleToggleFavorite = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
      )
    );
  }, []);

  const handleMarkSpam = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, isSpam: true } : c
      )
    );
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
    setDeleteConfirmId(null);
  }, [selectedId]);

  const handleToggleNeedsAction = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, needsAction: !c.needsAction } : c
      )
    );
  }, []);

  const handleMarkUnread = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, isRead: false, unreadCount: Math.max(1, c.unreadCount) } : c
      )
    );
  }, []);

  const handleSendMessage = useCallback((id: string, content: string, isInternal: boolean) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const newMsg: Message = {
          id: `msg-${Date.now()}`,
          content,
          timestamp: "今",
          isInbound: false,
          senderName: currentUser.name,
          isInternal,
        };
        return {
          ...c,
          messages: [...c.messages, newMsg],
          lastMessage: isInternal ? c.lastMessage : content,
          lastMessageAt: "今",
        };
      })
    );
  }, []);

  // Track which conversation was viewed, mark as read when navigating away
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    // Mark the previously viewed conversation as read when selection changes
    if (prevSelectedRef.current && prevSelectedRef.current !== selectedId) {
      const prevId = prevSelectedRef.current;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === prevId ? { ...c, isRead: true, unreadCount: 0 } : c
        )
      );
    }
    prevSelectedRef.current = selectedId;
  }, [selectedId]);

  const counts = useMemo(() => {
    const nonSpam = conversations.filter((c) => !c.isSpam);
    return {
      all: nonSpam.length,
      mine: nonSpam.filter((c) => c.assignee?.id === currentUser.id).length,
      mentioned: nonSpam.filter((c) => c.messages.some((m) => m.isInternal && m.content.includes(`@${currentUser.name}`))).length,
      resolved: nonSpam.filter((c) => c.status === "resolved").length,
      favorite: nonSpam.filter((c) => c.isFavorite).length,
      spam: conversations.filter((c) => c.isSpam).length,
    };
  }, [conversations]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = filtered.findIndex((c) => c.id === selectedId);
        if (e.key === "ArrowDown" && idx < filtered.length - 1) {
          setSelectedId(filtered[idx + 1].id);
        } else if (e.key === "ArrowUp" && idx > 0) {
          setSelectedId(filtered[idx - 1].id);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selectedId]);

  const detailContact = detailContactId
    ? contacts.find((c) => c.id === detailContactId) ?? null
    : null;

  return (
    <div className="flex h-full overflow-x-auto">
      {/* ── Layer 2: Folders (220px) ── */}
      <div className="flex h-full w-[220px] shrink-0 flex-col border-r bg-background">
        <div className="shrink-0 px-3 pt-4 pb-2">
          <h2 className="px-2 text-[15px] font-semibold text-foreground">
            メッセージ
          </h2>
        </div>

        <nav className="flex-1 overflow-y-auto px-2">
          <div className="space-y-0.5">
            <FolderItem icon={Inbox} label="すべて" count={counts.all}
              isActive={folderFilter === "all" && !accountFilter && !groupFilter}
              onClick={() => { setFolderFilter("all"); setAccountFilter(null); setGroupFilter(null); }} />
            <FolderItemWithAvatar label="自分のアサイン分" count={counts.mine}
              isActive={folderFilter === "mine"}
              onClick={() => { setFolderFilter("mine"); setAccountFilter(null); setGroupFilter(null); }} />
            <FolderItem icon={AtSign} label="メンションされた" count={counts.mentioned}
              isActive={folderFilter === "mentioned"}
              onClick={() => { setFolderFilter("mentioned"); setAccountFilter(null); setGroupFilter(null); }} />
            <FolderItem icon={Check} label="解決済み" count={counts.resolved}
              isActive={folderFilter === "resolved"}
              onClick={() => { setFolderFilter("resolved"); setAccountFilter(null); setGroupFilter(null); }} />
            <FolderItem icon={Star} label="お気に入り" count={counts.favorite}
              isActive={folderFilter === "favorite"}
              onClick={() => { setFolderFilter("favorite"); setAccountFilter(null); setGroupFilter(null); }} />
            <FolderItem icon={Ban} label="スパム" count={counts.spam}
              isActive={folderFilter === "spam"}
              onClick={() => { setFolderFilter("spam"); setAccountFilter(null); setGroupFilter(null); }} />
          </div>

          {/* Accounts section */}
          <div className="mt-5">
            <h3 className="mb-1 px-2 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
              アカウント
            </h3>
            <div className="space-y-0.5">
              {accounts.map((account) => {
                const Icon = channelIcons[account.channel];
                const nonSpam = conversations.filter((c) => !c.isSpam && c.accountId === account.id);
                return (
                  <FolderItem key={account.id} icon={Icon} label={account.name} count={nonSpam.length}
                    isActive={accountFilter === account.id}
                    onClick={() => { setAccountFilter(account.id); setFolderFilter("all"); setGroupFilter(null); }}
                    iconColor={channelStyles[account.channel].text} />
                );
              })}
            </div>
          </div>

          {/* Groups section */}
          <div className="mt-5">
            <h3 className="mb-1 px-2 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
              グループ
            </h3>
            <div className="space-y-0.5">
              {contactGroups.map((group) => {
                const groupConvCount = conversations.filter(
                  (c) => !c.isSpam && group.contactIds.includes(c.contactId)
                ).length;
                return (
                  <FolderItem key={group.id} icon={Inbox} label={group.name} count={groupConvCount}
                    isActive={groupFilter === group.id}
                    onClick={() => { setGroupFilter(group.id); setFolderFilter("all"); setAccountFilter(null); }} />
                );
              })}
            </div>
          </div>
        </nav>
      </div>

      {/* ── Layer 3: Thread list (320px) ── */}
      <div className="flex h-full w-[320px] shrink-0 flex-col border-r bg-background">
        <div className="shrink-0 px-3 pt-3 pb-2 space-y-2">
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="スレッドを検索..."
              className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/50" />
          </div>

          {/* Unread only - prominent button style */}
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[14px] font-medium transition-colors cursor-pointer",
              unreadOnly
                ? "bg-brand text-white border-brand"
                : "bg-accent/40 text-muted-foreground border-border/60 hover:bg-accent/60"
            )}
          >
            <input type="checkbox" checked={unreadOnly} readOnly
              className="h-4 w-4 rounded accent-brand pointer-events-none" />
            未読のみ
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Inbox className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-[14px]">該当するスレッドがありません</p>
            </div>
          ) : (
            filtered.map((conv) => (
              <ConversationItem key={conv.id} conversation={conv}
                isSelected={conv.id === selectedId}
                onSelect={() => setSelectedId(conv.id)} />
            ))
          )}
        </div>
      </div>

      {/* ── Layer 4: Thread detail ── */}
      {selectedConversation ? (
        <ConversationDetail
          conversation={selectedConversation}
          conversations={conversations}
          onStatusChange={handleStatusChange}
          onAssigneeChange={handleAssigneeChange}
          onOpenContactDetail={(contactId) => setDetailContactId(contactId)}
          onToggleFavorite={handleToggleFavorite}
          onMarkSpam={handleMarkSpam}
          onRequestDelete={(id) => setDeleteConfirmId(id)}
          onToggleNeedsAction={handleToggleNeedsAction}
          onMarkUnread={handleMarkUnread}
          onSendMessage={handleSendMessage}
          onNavigateToContact={(contactId) => {
            router.push(`/contacts?contact=${contactId}&edit=true`);
          }}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10 opacity-20" />
            <p className="text-[15px]">スレッドを選択してください</p>
          </div>
        </div>
      )}

      {/* Contact detail slide panel */}
      {detailContact && (
        <ContactSlidePanel
          contact={detailContact}
          onClose={() => setDetailContactId(null)}
          onNavigateToContact={(contactId) => {
            router.push(`/contacts?contact=${contactId}&edit=true`);
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirmId(null); }}>
          <div className="w-[380px] rounded-xl bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold">完全に削除しますか？</h3>
                <p className="text-[13px] text-muted-foreground">この操作は取り消せません。</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" className="h-9 px-4 text-[14px]" onClick={() => setDeleteConfirmId(null)}>
                キャンセル
              </Button>
              <Button size="sm" className="h-9 bg-destructive hover:bg-destructive/90 px-4 text-[14px]"
                onClick={() => handleDeleteConversation(deleteConfirmId)}>
                削除する
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Folder Items ───────────────────────────────── */

function FolderItem({ icon: Icon, label, count, isActive, onClick, iconColor }: {
  icon: React.ElementType; label: string; count: number; isActive: boolean;
  onClick: () => void; iconColor?: string;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[8px] text-[15px] font-medium transition-colors cursor-pointer",
        isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}>
      <Icon className={cn("h-[16px] w-[16px] shrink-0", !isActive && iconColor)} />
      <span className="flex-1 truncate text-left">{label}</span>
      {count > 0 && <span className="text-[12px] tabular-nums text-muted-foreground/60">{count}</span>}
    </button>
  );
}

function FolderItemWithAvatar({ label, count, isActive, onClick }: {
  label: string; count: number; isActive: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[8px] text-[15px] font-medium transition-colors cursor-pointer",
        isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}>
      <Avatar src={currentUser.avatar} fallback={currentUser.name} size="sm" className="h-[16px] w-[16px] text-[5px]" />
      <span className="flex-1 truncate text-left">{label}</span>
      {count > 0 && <span className="text-[12px] tabular-nums text-muted-foreground/60">{count}</span>}
    </button>
  );
}

/* ─── Conversation List Item ─────────────────────── */

function ConversationItem({ conversation, isSelected, onSelect }: {
  conversation: Conversation; isSelected: boolean; onSelect: () => void;
}) {
  const { contactName, channel, lastMessage, lastMessageAt, assignee, subject } = conversation;
  const Icon = channelIcons[channel];
  const style = channelStyles[channel];
  const unread = isUnread(conversation);
  // Priority: resolved > unread
  const isResolved = conversation.status === "resolved";

  // Track when unread state changes to animate
  const prevUnreadRef = useRef(unread);
  const [justRead, setJustRead] = useState(false);

  useEffect(() => {
    if (prevUnreadRef.current && !unread) {
      setJustRead(true);
      const timer = setTimeout(() => setJustRead(false), 400);
      return () => clearTimeout(timer);
    }
    prevUnreadRef.current = unread;
  }, [unread]);

  // Display: subject only for email, lastMessage (1 line) for others
  const displayText = channel === "email" && subject ? subject : lastMessage;

  return (
    <button onClick={onSelect}
      className={cn(
        "flex w-full gap-3 border-b px-4 py-3 text-left transition-all duration-300 cursor-pointer",
        justRead && "animate-read-fade",
        isSelected
          ? "bg-brand text-white"
          : isResolved
            ? "bg-background hover:bg-accent/40"
            : unread
              ? "bg-brand/4 hover:bg-brand/8"
              : "bg-background hover:bg-accent/40"
      )}>
      {/* Channel icon */}
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full mt-0.5",
        isSelected ? "bg-white/20" : style.bg
      )}>
        <Icon className={cn("h-[18px] w-[18px]", isSelected ? "text-white" : style.text)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            "truncate text-[15px]",
            isSelected ? "font-semibold text-white" : unread ? "font-semibold text-foreground" : "font-medium text-foreground"
          )}>
            {contactName}
          </span>
          <span className={cn("shrink-0 text-[12px]", isSelected ? "text-white/70" : "text-muted-foreground")}>
            {lastMessageAt}
          </span>
        </div>

        <p className={cn(
          "mt-0.5 truncate text-[13px] leading-relaxed",
          isSelected ? "text-white/70" : "text-muted-foreground"
        )}>
          {displayText}
        </p>

        {/* Assignee */}
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {assignee ? (
              <span className={cn("flex items-center gap-1 truncate text-[12px]",
                isSelected ? "text-white/60" : "text-muted-foreground")}>
                <Avatar src={assignee.avatar} fallback={assignee.name} size="sm" className="h-4 w-4 text-[6px]" />
                {assignee.name}
              </span>
            ) : (
              <span className={cn("flex items-center gap-1 text-[12px] font-medium",
                isSelected ? "text-white/50" : "text-muted-foreground/60")}>
                <CircleDashed className="h-4 w-4" />
                未アサイン
              </span>
            )}
          </div>
          {conversation.isFavorite && (
            <Star className={cn("h-3 w-3 fill-current", isSelected ? "text-white/60" : "text-amber-400")} />
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Conversation Detail ────────────────────────── */

function ConversationDetail({ conversation, conversations: allConvs, onStatusChange, onAssigneeChange,
  onOpenContactDetail, onToggleFavorite, onMarkSpam, onRequestDelete, onToggleNeedsAction,
  onMarkUnread, onSendMessage, onNavigateToContact }: {
  conversation: Conversation; conversations: Conversation[];
  onStatusChange: (id: string, status: Status) => void;
  onAssigneeChange: (id: string, assigneeId: string | null) => void;
  onOpenContactDetail: (contactId: string) => void;
  onToggleFavorite: (id: string) => void;
  onMarkSpam: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onToggleNeedsAction: (id: string) => void;
  onMarkUnread: (id: string) => void;
  onSendMessage: (id: string, content: string, isInternal: boolean) => void;
  onNavigateToContact: (contactId: string) => void;
}) {
  const [replyText, setReplyText] = useState("");
  const [memoText, setMemoText] = useState("");
  const [emailFrom, setEmailFrom] = useState("info@myshop.jp");
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const memoRef = useRef<HTMLTextAreaElement>(null);

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number } | null>(null);
  const mentionStartRef = useRef<number>(-1);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return teamMembers.filter((m) => m.name.toLowerCase().includes(q));
  }, [mentionQuery]);

  const insertMention = useCallback((memberName: string) => {
    const start = mentionStartRef.current;
    const before = memoText.substring(0, start);
    const afterCursor = memoText.substring(memoRef.current?.selectionStart ?? start);
    // Find end of the @query
    const queryEnd = memoRef.current?.selectionStart ?? start;
    const after = memoText.substring(queryEnd);
    const newText = `${before}@${memberName} ${after}`;
    setMemoText(newText);
    setMentionQuery(null);
    setMentionIndex(0);
    mentionStartRef.current = -1;
    // Focus and set cursor position after the inserted mention
    requestAnimationFrame(() => {
      if (memoRef.current) {
        const cursorPos = before.length + memberName.length + 2; // +2 for @ and space
        memoRef.current.focus();
        memoRef.current.setSelectionRange(cursorPos, cursorPos);
      }
    });
  }, [memoText]);

  const handleMemoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMemoText(val);
    const cursorPos = e.target.selectionStart;
    const textBefore = val.substring(0, cursorPos);
    const lastAtIndex = textBefore.lastIndexOf("@");
    if (lastAtIndex >= 0) {
      const charBeforeAt = lastAtIndex > 0 ? textBefore[lastAtIndex - 1] : " ";
      if (charBeforeAt === " " || charBeforeAt === "\n" || lastAtIndex === 0) {
        const query = textBefore.substring(lastAtIndex + 1);
        if (!query.includes(" ") && !query.includes("\n")) {
          mentionStartRef.current = lastAtIndex;
          setMentionQuery(query);
          setMentionIndex(0);
          setMentionPos({ top: 0, left: 0 });
          return;
        }
      }
    }
    setMentionQuery(null);
    setMentionIndex(0);
  };

  const handleMemoKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => Math.min(prev + 1, mentionCandidates.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionCandidates[mentionIndex].name);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSendMemo();
    }
  };

  const Icon = channelIcons[conversation.channel];
  const style = channelStyles[conversation.channel];

  const isEmail = conversation.channel === "email";
  const isSelfAssigned = conversation.assignee?.id === currentUser.id;

  const contactObj = contacts.find((c) => c.id === conversation.contactId);
  const accountObj = accounts.find((a) => a.id === conversation.accountId);
  const channelLabel = conversation.channel === "email" ? "メール" : conversation.channel === "line" ? "LINE" : conversation.channel === "instagram" ? "Instagram" : "Facebook";
  const accountName = accountObj?.name ?? "";

  useEffect(() => {
    if (isEmail) {
      const contactEmail = contactObj?.channels.find((ch) => ch.channel === "email")?.handle ?? "";
      setEmailTo(contactEmail);
      setEmailSubject(conversation.subject ? `Re: ${conversation.subject}` : "");
      setEmailFrom("info@myshop.jp");
      setEmailCc("");
      setEmailBcc("");
    }
  }, [conversation.id, isEmail, contactObj, conversation.subject]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages.length]);

  // Auto-assign on typing
  const handleReplyChange = (text: string) => {
    setReplyText(text);
    if (text.length === 1 && !isSelfAssigned) {
      onAssigneeChange(conversation.id, currentUser.id);
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    onSendMessage(conversation.id, replyText.trim(), false);
    setReplyText("");
  };

  const handleSendMemo = () => {
    if (!memoText.trim()) return;
    onSendMessage(conversation.id, memoText.trim(), true);
    setMemoText("");
  };

  return (
    <div className="flex h-full min-w-[400px] flex-1 flex-col bg-background">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b px-5 py-3">
        <button onClick={() => onOpenContactDetail(conversation.contactId)}
          className="flex min-w-0 items-center gap-3 cursor-pointer rounded-lg px-2 py-1.5 -ml-2 transition-colors hover:bg-accent active:bg-accent/80">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", style.bg)}>
            <Icon className={cn("h-4 w-4", style.text)} />
          </div>
          <div className="min-w-0 text-left">
            <p className="truncate text-[16px] font-semibold leading-tight">{conversation.contactName}</p>
            {contactObj?.company && (
              <p className="truncate text-[13px] leading-tight text-muted-foreground">{contactObj.company}</p>
            )}
          </div>
        </button>

        <div className="flex items-center gap-1.5">
          {/* Favorite */}
          <Tooltip content="お気に入り" side="bottom">
            <Button variant="ghost" size="icon-sm" className="h-8 w-8"
              onClick={() => onToggleFavorite(conversation.id)}>
              <Star className={cn("h-4 w-4",
                conversation.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
            </Button>
          </Tooltip>

          {/* Assign */}
          <div className="flex items-center rounded-lg border">
            <Button variant="ghost" size="sm"
              className={cn("h-9 gap-1.5 rounded-r-none border-r text-[14px] px-3",
                isSelfAssigned && "text-destructive hover:text-destructive")}
              onClick={() => onAssigneeChange(conversation.id, isSelfAssigned ? null : currentUser.id)}>
              {isSelfAssigned ? "アサインを解除" : "自分にアサイン"}
            </Button>
            <Dropdown align="right"
              trigger={
                <Button variant="ghost" size="sm" className="h-9 gap-1 rounded-l-none text-[14px] px-3">
                  {conversation.assignee ? (
                    <>
                      <Avatar src={conversation.assignee.avatar} fallback={conversation.assignee.name} size="sm" className="h-4 w-4 text-[6px]" />
                      {conversation.assignee.name}
                    </>
                  ) : (
                    <span className="flex items-center gap-1">
                      <CircleDashed className="h-3.5 w-3.5" />
                      未アサイン
                    </span>
                  )}
                  <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
                </Button>
              }>
              <DropdownItem active={!conversation.assignee} onClick={() => onAssigneeChange(conversation.id, null)}>
                <CircleDashed className="h-3.5 w-3.5" /> 未アサイン
              </DropdownItem>
              {teamMembers.map((m) => (
                <DropdownItem key={m.id} active={conversation.assignee?.id === m.id}
                  onClick={() => onAssigneeChange(conversation.id, m.id)}>
                  <Avatar src={m.avatar} fallback={m.name} size="sm" className="h-4 w-4 text-[6px]" />
                  {m.name}
                </DropdownItem>
              ))}
            </Dropdown>
          </div>

          {/* Needs action / Resolve */}
          {conversation.needsAction ? (
            <Dropdown align="right"
              trigger={
                <Button size="sm"
                  className="h-9 gap-1.5 text-[14px] px-4 bg-amber-500 hover:bg-amber-600">
                  要対応
                  <ChevronDown className="h-3 w-3" />
                </Button>
              }>
              <DropdownItem onClick={() => onToggleNeedsAction(conversation.id)}>
                要対応を解除する
              </DropdownItem>
              <DropdownItem onClick={() => { onStatusChange(conversation.id, "resolved"); }}>
                解決済みにする
              </DropdownItem>
            </Dropdown>
          ) : conversation.status === "resolved" ? (
            <Dropdown align="right"
              trigger={
                <Button size="sm"
                  className="h-9 gap-1.5 text-[14px] px-4 bg-foreground/10 text-foreground hover:bg-foreground/15">
                  解決済み
                  <ChevronDown className="h-3 w-3" />
                </Button>
              }>
              <DropdownItem onClick={() => onStatusChange(conversation.id, "open")}>
                未対応にもどす
              </DropdownItem>
              <DropdownItem onClick={() => { onStatusChange(conversation.id, "open"); onToggleNeedsAction(conversation.id); }}>
                要対応にする
              </DropdownItem>
            </Dropdown>
          ) : (
            <Button size="sm"
              className="h-9 gap-1.5 text-[14px] px-4 bg-brand hover:bg-brand/90"
              onClick={() => onToggleNeedsAction(conversation.id)}>
              要対応にする
            </Button>
          )}

          {/* More options */}
          <Dropdown align="right"
            trigger={<Button variant="ghost" size="icon-sm" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>}>
            <DropdownItem onClick={() => onMarkUnread(conversation.id)}>
              <Mail className="h-3.5 w-3.5" /> 未読にする
            </DropdownItem>
            <DropdownItem onClick={() => onMarkSpam(conversation.id)}>
              <Ban className="h-3.5 w-3.5" /> スパムとして報告
            </DropdownItem>
            <DropdownItem className="text-destructive" onClick={() => onRequestDelete(conversation.id)}>
              <Trash2 className="h-3.5 w-3.5" /> 完全に削除
            </DropdownItem>
          </Dropdown>
        </div>
      </header>

      {/* Messages + inline reply */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto max-w-2xl space-y-4">
          {conversation.messages.map((message) => (
            <MessageBubble key={message.id} message={message} channel={conversation.channel} contactEmail={contactObj?.email} />
          ))}

          {/* Inline reply input - after last message */}
          <div ref={messagesEndRef} />

          {/* Reply input - right-aligned, with channel header attached */}
          <div className="flex justify-end">
            <div className="w-[70%] rounded-lg border bg-background focus-within:border-brand/30 overflow-hidden">
              {/* Channel reply header */}
              <ReplyHeader
                channel={conversation.channel}
                channelLabel={channelLabel}
                accountName={accountName}
                isEmail={isEmail}
                emailFrom={emailFrom} setEmailFrom={setEmailFrom}
                emailTo={emailTo} setEmailTo={setEmailTo}
                emailCc={emailCc} setEmailCc={setEmailCc}
                emailBcc={emailBcc} setEmailBcc={setEmailBcc}
                emailSubject={emailSubject} setEmailSubject={setEmailSubject}
              />
              <textarea value={replyText} onChange={(e) => handleReplyChange(e.target.value)}
                placeholder="メッセージを入力..."
                rows={3}
                className="w-full resize-none bg-transparent px-3 pt-2.5 pb-0 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/50"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleSendReply();
                  }
                }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 160) + "px";
                }} />
              <div className="flex items-center justify-between px-3 pb-2">
                <Tooltip content="ファイルを添付" side="top">
                  <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-muted-foreground">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </Tooltip>
                <Button size="sm" className="h-8 rounded-md bg-brand hover:bg-brand/90 px-4 text-[14px]"
                  disabled={!replyText.trim()} onClick={handleSendReply}>
                  <Send className="h-3 w-3 mr-1" /> 送信
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Team memo */}
      <div className="border-t px-5 py-3">
        <div className="mx-auto max-w-2xl">
          <div className="relative rounded-lg border border-amber-200/50 bg-amber-50/30">
            <div className="flex items-center gap-2.5 px-3 py-3">
              <MessageSquareText className="h-4 w-4 shrink-0 text-amber-500" />
              <textarea value={memoText} onChange={handleMemoChange}
                placeholder="チーム内メモを入力（@でメンション）"
                rows={1}
                className="flex-1 resize-none bg-transparent text-[14px] leading-normal outline-none placeholder:text-amber-400/60"
                style={{ height: "auto", minHeight: "24px", maxHeight: "80px", overflow: "auto" }}
                onKeyDown={handleMemoKeyDown}
                ref={(el) => {
                  (memoRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = Math.min(el.scrollHeight, 80) + "px";
                  }
                }} />
            </div>
            {memoText.trim() && (
              <div className="flex justify-end px-3 pb-2.5">
                <Button size="sm" className="h-7 rounded-md bg-amber-500 hover:bg-amber-600 px-3 text-[14px]"
                  onClick={handleSendMemo}>
                  保存
                </Button>
              </div>
            )}

            {/* @mention suggestions popup */}
            {mentionQuery !== null && mentionCandidates.length > 0 && mentionPos && (
              <div
                className="absolute bottom-full left-8 mb-1 w-[200px] rounded-lg border bg-popover p-1 shadow-lg z-[300]"
              >
                {mentionCandidates.map((member, i) => (
                  <button
                    key={member.id}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] transition-colors cursor-pointer",
                      i === mentionIndex ? "bg-accent text-foreground" : "text-foreground hover:bg-accent/50"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(member.name);
                    }}
                    onMouseEnter={() => setMentionIndex(i)}
                  >
                    <Avatar src={member.avatar} fallback={member.name} size="sm" className="h-6 w-6 text-[8px]" />
                    <span className="font-medium">{member.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Message Bubble ─────────────────────────────── */

function MessageBubble({ message, channel, contactEmail }: { message: Message; channel: Channel; contactEmail?: string }) {
  const { content, timestamp, isInbound, senderName, isInternal, emailHeader } = message;
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

  if (isInternal) {
    return (
      <div className="flex justify-center">
        <div className="min-w-[340px] max-w-md rounded-lg border border-amber-200/60 bg-amber-50/40 px-4 py-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <MessageSquareText className="h-3 w-3 text-amber-500" />
            <span className="text-[12px] font-medium text-amber-600">チーム内メモ</span>
          </div>
          <p className="text-[14px] leading-relaxed text-amber-900/70">{content}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <Avatar src={teamMembers.find((m) => m.name === senderName)?.avatar} fallback={senderName} size="sm" className="h-4 w-4 text-[5px]" />
            <span className="text-[12px] text-muted-foreground">{senderName}</span>
            <span className="text-[12px] text-muted-foreground/50">{timestamp}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2.5", isInbound ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[70%] space-y-1", !isInbound && "items-end")}>
        <div className={cn("flex items-center gap-1.5", !isInbound && "justify-end")}>
          <span className="text-[13px] font-medium text-muted-foreground">{senderName}</span>
          <span className="text-[13px] text-muted-foreground/50">{timestamp}</span>
        </div>

        {channel === "email" && emailHeader ? (
          <div className={cn(
            "overflow-hidden rounded-2xl border bg-background",
            isInbound ? "rounded-tl-sm" : "rounded-tr-sm"
          )}>
            <div className="border-b bg-accent/20 px-3 py-2">
              <button onClick={() => setHeaderExpanded(!headerExpanded)}
                className="flex cursor-pointer items-center gap-2 text-[14px] text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="h-4 w-4 text-channel-email" />
                <span className="font-medium">{emailHeader.subject}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", headerExpanded && "rotate-180")} />
              </button>
              {headerExpanded && (
                <div className="mt-2 space-y-1 text-[14px] text-muted-foreground">
                  {isInbound && (contactEmail || senderName) && (
                    <div className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-right font-medium text-[13px]">From</span>
                      <span>{contactEmail || senderName}</span>
                    </div>
                  )}
                  {emailHeader.to && (
                    <div className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-right font-medium text-[13px]">To</span>
                      <span>{emailHeader.to}</span>
                    </div>
                  )}
                  {emailHeader.cc && (
                    <div className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-right font-medium text-[13px]">CC</span>
                      <span>{emailHeader.cc}</span>
                    </div>
                  )}
                  {emailHeader.bcc && (
                    <div className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-right font-medium text-[13px]">BCC</span>
                      <span>{emailHeader.bcc}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-3.5 py-2 text-[15px] leading-relaxed">
              {content.split("\n").map((line, i) => (
                <span key={i}>{line}{i < content.split("\n").length - 1 && <br />}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className={cn(
            "rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed",
            isInbound ? "rounded-tl-sm bg-secondary text-secondary-foreground" : "rounded-tr-sm bg-brand text-brand-foreground"
          )}>
            {content.split("\n").map((line, i) => (
              <span key={i}>{line}{i < content.split("\n").length - 1 && <br />}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Reply Header (channel-aware, attached to input) ── */

function ReplyHeader({ channel, channelLabel, accountName, isEmail,
  emailFrom, setEmailFrom, emailTo, setEmailTo,
  emailCc, setEmailCc, emailBcc, setEmailBcc, emailSubject, setEmailSubject }: {
  channel: Channel; channelLabel: string; accountName: string; isEmail: boolean;
  emailFrom: string; setEmailFrom: (v: string) => void;
  emailTo: string; setEmailTo: (v: string) => void;
  emailCc: string; setEmailCc: (v: string) => void;
  emailBcc: string; setEmailBcc: (v: string) => void;
  emailSubject: string; setEmailSubject: (v: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const CIcon = channelIcons[channel];
  const cStyle = channelStyles[channel];

  return (
    <div className="border-b bg-accent/20 px-3 py-2">
      <button onClick={() => isEmail ? setExpanded(!expanded) : undefined}
        className={cn(
          "flex items-center gap-2 text-[14px] text-muted-foreground",
          isEmail && "cursor-pointer hover:text-foreground transition-colors"
        )}>
        <CIcon className={cn("h-4 w-4", cStyle.text)} />
        <span className="font-medium">{channelLabel} {accountName} として返信</span>
        {isEmail && <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />}
      </button>
      {isEmail && expanded && (
        <div className="mt-2 space-y-1 text-[14px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right font-medium text-[13px]">From</span>
            <input value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)}
              className="flex-1 rounded bg-transparent px-1.5 py-0.5 outline-none text-[14px] hover:text-muted-foreground focus:text-foreground transition-colors" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right font-medium text-[13px]">To</span>
            <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)}
              className="flex-1 rounded bg-transparent px-1.5 py-0.5 outline-none text-[14px] hover:text-muted-foreground focus:text-foreground transition-colors" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right font-medium text-[13px]">CC</span>
            <input value={emailCc} onChange={(e) => setEmailCc(e.target.value)} placeholder="任意"
              className="flex-1 rounded bg-transparent px-1.5 py-0.5 outline-none text-[14px] hover:text-muted-foreground focus:text-foreground transition-colors placeholder:text-muted-foreground/30" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right font-medium text-[13px]">BCC</span>
            <input value={emailBcc} onChange={(e) => setEmailBcc(e.target.value)} placeholder="任意"
              className="flex-1 rounded bg-transparent px-1.5 py-0.5 outline-none text-[14px] hover:text-muted-foreground focus:text-foreground transition-colors placeholder:text-muted-foreground/30" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right font-medium text-[13px]">件名</span>
            <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
              className="flex-1 rounded bg-transparent px-1.5 py-0.5 outline-none text-[14px] hover:text-muted-foreground focus:text-foreground transition-colors" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Contact Slide Panel ────────────────────────── */

function ContactSlidePanel({ contact, onClose, onNavigateToContact }: {
  contact: Contact; onClose: () => void; onNavigateToContact: (id: string) => void;
}) {
  const contactConversations = allConversations.filter((c) =>
    contact.conversationIds.includes(c.id)
  );
  const memberGroups = contactGroups.filter(
    (g) => g.contactIds.includes(contact.id)
  );

  return (
    <div className="flex h-full w-[320px] min-w-[260px] max-w-[400px] shrink-0 flex-col border-l bg-background animate-slide-in-right">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="text-[16px] font-semibold">連絡先</h3>
        <button onClick={onClose}
          className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {/* 氏名 */}
          <section>
            <p className="text-[16px] font-semibold">{contact.name}</p>
            {contact.nameFurigana && <p className="text-[13px] text-muted-foreground">{contact.nameFurigana}</p>}
          </section>

          {/* 会社名 */}
          <section>
            {contact.company ? (
              <>
                <p className="text-[15px] font-medium">{contact.company}</p>
                {contact.companyFurigana && <p className="text-[13px] text-muted-foreground">{contact.companyFurigana}</p>}
              </>
            ) : (
              <p className="text-[14px] text-muted-foreground/60">なし</p>
            )}
          </section>

          {/* 連絡先 */}
          <section>
            <h4 className="mb-1.5 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">連絡先</h4>
            <div className="space-y-1.5 text-[14px]">
              {contact.phone && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">電話番号</span>
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.email && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">メール</span>
                  <span className="text-right break-all">{contact.email}</span>
                </div>
              )}
              {contact.channels.filter((ch) => ch.channel !== "email").map((ch) => {
                const CIcon = channelIcons[ch.channel];
                const s = channelStyles[ch.channel];
                return (
                  <div key={ch.channel} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground shrink-0 flex items-center gap-1">
                      <CIcon className={cn("h-3.5 w-3.5", s.text)} />
                      {ch.channel === "instagram" ? "Instagram" : ch.channel === "line" ? "LINE" : "Facebook"}
                    </span>
                    <span className="text-right break-all">{ch.handle}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* グループ */}
          <section>
            <h4 className="mb-1.5 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">グループ</h4>
            {memberGroups.length === 0 ? (
              <p className="text-[13px] text-muted-foreground/60">なし</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {memberGroups.map((g) => (
                  <span key={g.id} className="rounded-full bg-accent px-2.5 py-0.5 text-[13px] font-medium text-foreground/70">{g.name}</span>
                ))}
              </div>
            )}
          </section>

          {/* メッセージ履歴 */}
          <section>
            <h4 className="mb-1.5 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">メッセージ履歴</h4>
            {contactConversations.length === 0 ? (
              <p className="text-[13px] text-muted-foreground/60">履歴はありません</p>
            ) : (
              <div className="space-y-1.5">
                {contactConversations.map((conv) => {
                  const CIcon = channelIcons[conv.channel];
                  const s = channelStyles[conv.channel];
                  return (
                    <div key={conv.id} className="flex items-start gap-2.5 rounded-md border px-3 py-2">
                      <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5", s.bg)}>
                        <CIcon className={cn("h-3 w-3", s.text)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{conv.subject || conv.lastMessage}</p>
                        <p className="text-[12px] text-muted-foreground">{conv.lastMessageAt}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* メモ */}
          <section>
            <h4 className="mb-1.5 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">メモ</h4>
            <p className="text-[14px] text-muted-foreground leading-relaxed">{contact.note || "なし"}</p>
          </section>

          {/* Link to contact page */}
          <div className="pt-4 pb-2 flex justify-center">
            <button
              className="text-[14px] text-brand hover:text-brand/80 underline underline-offset-2 cursor-pointer transition-colors"
              onClick={() => { onClose(); onNavigateToContact(contact.id); }}>
              この連絡先へ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
