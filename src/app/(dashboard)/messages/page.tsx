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
import type { Conversation, Message, Status, Channel, Contact, Attachment } from "@/data/types";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Avatar } from "@/components/ui/avatar";
import {
  Instagram,
  MessageCircle,
  MessageCircleMore,
  Mail,
  Facebook,
  Send,
  Paperclip,
  MoreHorizontal,
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
  AtSign,
  Smile,
  Link2,
  FileText,
  Download,
  Image as ImageIcon,
  Plus,
  UserPlus,
  FolderOpen,
  Ban,
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
// LINE stamp labels (displayed as styled placeholders, not emoji)
const lineStampLabels = [
  "OK", "ハート", "にこ", "笑", "お願い", "バイバイ",
  "お祝い", "ガッツ", "泣", "ハグ", "好き", "うるうる",
  "キラキラ", "炎", "桜", "太陽", "バンザイ", "クール",
  "ラブ", "握手", "拍手", "ありがとう", "爆笑", "しくしく",
];
const lineStampIds = lineStampLabels.map((_, i) => `stamp_${i}`);

// folder structure
type FolderFilter =
  | "new"        // 新着（未アサイン）
  | "in_progress" // 対応中（アサイン済み未完了）
  | "completed"   // 完了
  | "no_action"   // 対応なし
  | "mine"        // 自分が担当
  | "mentioned"   // メンションされた
  | "favorite"   // お気に入り
  | "sent";      // 送信済み

function isUnread(conv: Conversation): boolean {
  return conv.isRead === false || conv.unreadCount > 0;
}

function renderMentions(text: string): React.ReactNode {
  const memberNames = teamMembers.map((m) => m.name);
  const pattern = new RegExp(`(@(?:${memberNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "g");
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    part.startsWith("@") && memberNames.some((n) => part === `@${n}`)
      ? <span key={i} className="font-medium text-blue-500">{part}</span>
      : part
  );
}

function formatMessageNumber(n: number): string {
  return `#${String(n).padStart(5, "0")}`;
}

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState(allConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    allConversations[0]?.id ?? null
  );
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("new");
  const [accountFilter, setAccountFilter] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [personalFolderMode, setPersonalFolderMode] = useState<"active" | "all">("active");
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [recentlyReadIds, setRecentlyReadIds] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<{ id: string; unreadCount: number }[]>([]);
  const [accountsExpanded, setAccountsExpanded] = useState(true);
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [showRightPane, setShowRightPane] = useState(true);

  // Image preview modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = conversations;

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

    // Folder filtering logic
    if (!accountFilter && !groupFilter) {
      switch (folderFilter) {
        case "new":
          list = list.filter((c) => c.status === "open" && c.assignees.length === 0);
          break;
        case "in_progress":
          list = list.filter((c) => c.status === "open" && c.assignees.length > 0);
          break;
        case "completed":
          list = list.filter((c) => c.status === "completed");
          break;
        case "no_action":
          list = list.filter((c) => c.status === "no_action");
          break;
        case "mine":
          list = list.filter((c) => c.assignees.some((a) => a.id === currentUser.id));
          if (personalFolderMode === "active") list = list.filter((c) => c.status === "open");
          break;
        case "mentioned":
          list = list.filter((c) => c.messages.some((m) => m.isInternal && m.content.includes(`@${currentUser.name}`)));
          if (personalFolderMode === "active") list = list.filter((c) => c.status === "open");
          break;
        case "favorite":
          list = list.filter((c) => c.isFavorite);
          if (personalFolderMode === "active") list = list.filter((c) => c.status === "open");
          break;
        case "sent":
          list = [];
          break;
      }
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
  }, [conversations, folderFilter, accountFilter, groupFilter, searchQuery, personalFolderMode]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const handleStatusChange = useCallback((id: string, status: Status) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return { ...c, status };
      })
    );
  }, []);

  const handleAssignSelf = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.assignees.some((a) => a.id === currentUser.id)) return c;
        return { ...c, assignees: [...c.assignees, currentUser], status: "open" as Status };
      })
    );
  }, []);

  const handleRemoveAssignee = useCallback((id: string, assigneeId: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return { ...c, assignees: c.assignees.filter((a) => a.id !== assigneeId) };
      })
    );
  }, []);

  const handleSetAssignee = useCallback((id: string, assigneeId: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const member = teamMembers.find((m) => m.id === assigneeId);
        if (!member) return c;
        if (c.assignees.some((a) => a.id === assigneeId)) return c;
        return { ...c, assignees: [...c.assignees, member] };
      })
    );
  }, []);

  const handleToggleFavorite = useCallback((id: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
      )
    );
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) setSelectedId(null);
    setDeleteConfirmId(null);
  }, [selectedId]);

  const handleSendMessage = useCallback((id: string, content: string, isInternal: boolean, attachments?: Attachment[]) => {
    const now = new Date();
    const ts = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const newMsg: Message = {
          id: `msg-${Date.now()}`,
          content,
          timestamp: ts,
          isInbound: false,
          senderName: currentUser.name,
          isInternal,
          attachments: attachments && attachments.length > 0 ? attachments : undefined,
        };
        return {
          ...c,
          messages: [...c.messages, newMsg],
          lastMessage: isInternal ? c.lastMessage : content,
          lastMessageAt: ts,
        };
      })
    );
  }, []);

  // Link conversations
  const handleLinkConversation = useCallback((convId: string, targetId: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === convId) {
          const existing = c.linkedConversationIds ?? [];
          if (existing.includes(targetId)) return c;
          return { ...c, linkedConversationIds: [...existing, targetId] };
        }
        if (c.id === targetId) {
          const existing = c.linkedConversationIds ?? [];
          if (existing.includes(convId)) return c;
          return { ...c, linkedConversationIds: [...existing, convId] };
        }
        return c;
      })
    );
  }, []);

  const handleDeleteMemo = useCallback((convId: string, messageId: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, messages: c.messages.filter((m) => m.id !== messageId) }
          : c
      )
    );
  }, []);

  const handleUnlinkConversation = useCallback((convId: string, targetId: string) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === convId) {
          return { ...c, linkedConversationIds: (c.linkedConversationIds ?? []).filter((id) => id !== targetId) };
        }
        if (c.id === targetId) {
          return { ...c, linkedConversationIds: (c.linkedConversationIds ?? []).filter((id) => id !== convId) };
        }
        return c;
      })
    );
  }, []);

  // Track which conversation was viewed, mark as read when navigating away
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevSelectedRef.current && prevSelectedRef.current !== selectedId) {
      const prevId = prevSelectedRef.current;
      setConversations((prev) => {
        return prev.map((c) =>
          c.id === prevId ? { ...c, isRead: true, unreadCount: 0 } : c
        );
      });
    }
    prevSelectedRef.current = selectedId;
  }, [selectedId]);

  // Counts for folder badges
  const counts = useMemo(() => {
    return {
      new: conversations.filter((c) => c.status === "open" && c.assignees.length === 0).length,
      in_progress: conversations.filter((c) => c.status === "open" && c.assignees.length > 0).length,
      completed: conversations.filter((c) => c.status === "completed").length,
      no_action: conversations.filter((c) => c.status === "no_action").length,
      mine: conversations.filter((c) => c.assignees.some((a) => a.id === currentUser.id)).length,
      mentioned: conversations.filter((c) => c.messages.some((m) => m.isInternal && m.content.includes(`@${currentUser.name}`))).length,
      favorite: conversations.filter((c) => c.isFavorite).length,
    };
  }, [conversations]);

  // Keyboard navigation - scroll into view and move focus
  const conversationListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        const idx = filtered.findIndex((c) => c.id === selectedId);
        let nextIdx = idx;
        if (e.key === "ArrowDown" && idx < filtered.length - 1) {
          nextIdx = idx + 1;
        } else if (e.key === "ArrowUp" && idx > 0) {
          nextIdx = idx - 1;
        }
        if (nextIdx !== idx) {
          setSelectedId(filtered[nextIdx].id);
          // Scroll the item into view and focus it
          const container = conversationListRef.current;
          if (container) {
            const buttons = container.querySelectorAll<HTMLButtonElement>(":scope > button");
            buttons[nextIdx]?.scrollIntoView({ block: "nearest" });
            buttons[nextIdx]?.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selectedId]);

  const detailContact = detailContactId
    ? contacts.find((c) => c.id === detailContactId) ?? null
    : null;

  // Change #8: Also return folder name when no account/group is selected
  const folderLabels: Record<FolderFilter, string> = {
    new: "新着",
    in_progress: "対応中",
    completed: "完了",
    no_action: "対応なし",
    mine: "自分が担当",
    mentioned: "メンションされた",
    favorite: "お気に入り",
    sent: "送信済み",
  };

  const currentSectionLabel = useMemo(() => {
    if (accountFilter) return accounts.find((a) => a.id === accountFilter)?.name ?? null;
    if (groupFilter) return contactGroups.find((g) => g.id === groupFilter)?.name ?? null;
    return folderLabels[folderFilter];
  }, [accountFilter, groupFilter, folderFilter]);

  return (
    <div className="flex h-full overflow-x-auto">
      {/* Layer 2: Folders (220px) */}
      <div className="flex h-full w-[220px] shrink-0 flex-col border-r bg-background">
        {/* Change #2: Add page title and compose button */}
        <div className="shrink-0 px-3 pt-4 pb-2 flex items-center justify-between">
          <h2 className="px-2 text-[15px] font-semibold text-foreground">メッセージ</h2>
          <button onClick={() => router.push("/messages/compose")} className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2">
          {/* Status folders - Change #3: icons, Change #4: no count on completed */}
          <div className="space-y-0.5">
            <FolderItem icon={Inbox} label="新着" count={counts.new}
              isActive={folderFilter === "new" && !accountFilter && !groupFilter}
              onClick={() => { setFolderFilter("new"); setAccountFilter(null); setGroupFilter(null); }} />
            <FolderItem icon={MessageCircleMore} label="対応中" count={counts.in_progress}
              isActive={folderFilter === "in_progress" && !accountFilter && !groupFilter}
              onClick={() => { setFolderFilter("in_progress"); setAccountFilter(null); setGroupFilter(null); }} />
            <FolderItem icon={Check} label="完了"
              count={0}
              isActive={folderFilter === "completed" && !accountFilter && !groupFilter}
              onClick={() => { setFolderFilter("completed"); setAccountFilter(null); setGroupFilter(null); }} />
            <FolderItem icon={Ban} label="対応なし" count={0}
              isActive={folderFilter === "no_action" && !accountFilter && !groupFilter}
              onClick={() => { setFolderFilter("no_action"); setAccountFilter(null); setGroupFilter(null); }} />
            <FolderItem icon={Send} label="送信済み" count={0}
              isActive={folderFilter === "sent" && !accountFilter && !groupFilter}
              onClick={() => { setFolderFilter("sent"); setAccountFilter(null); setGroupFilter(null); }} />
          </div>

          {/* Separator */}
          <div className="my-3 border-t" />

          {/* Personal folders */}
          <div className="space-y-0.5">
            <FolderItemWithAvatar label="自分が担当" count={counts.mine}
              isActive={folderFilter === "mine" && !accountFilter && !groupFilter}
              onClick={() => { setFolderFilter("mine"); setAccountFilter(null); setGroupFilter(null); }} />
            <FolderItem icon={AtSign} label="メンションされた" count={counts.mentioned}
              isActive={folderFilter === "mentioned" && !accountFilter && !groupFilter}
              onClick={() => { setFolderFilter("mentioned"); setAccountFilter(null); setGroupFilter(null); }} />
            <FolderItem icon={Star} label="お気に入り" count={counts.favorite}
              isActive={folderFilter === "favorite" && !accountFilter && !groupFilter}
              onClick={() => { setFolderFilter("favorite"); setAccountFilter(null); setGroupFilter(null); }} />
          </div>

          {/* Change #6: Rename to チャネル, Change #5: no count on account items */}
          <div className="mt-5">
            <button
              onClick={() => setAccountsExpanded(!accountsExpanded)}
              className="mb-1 flex w-full items-center gap-1 px-2 text-[12px] font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
            >
              <ChevronDown className={cn("h-3 w-3 transition-transform", !accountsExpanded && "-rotate-90")} />
              チャネル
            </button>
            {accountsExpanded && (
              <div className="space-y-0.5">
                {accounts.map((account) => {
                  const Icon = channelIcons[account.channel];
                  return (
                    <FolderItem key={account.id} icon={Icon} label={account.name} count={0}
                      isActive={accountFilter === account.id}
                      onClick={() => { setAccountFilter(account.id); setFolderFilter("new"); setGroupFilter(null); }}
                      iconColor={channelStyles[account.channel].text} />
                  );
                })}
              </div>
            )}
          </div>

          {/* Groups section - Change #7: FolderOpen icon, Change #5: no count */}
          <div className="mt-5">
            <button
              onClick={() => setGroupsExpanded(!groupsExpanded)}
              className="mb-1 flex w-full items-center gap-1 px-2 text-[12px] font-medium uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
            >
              <ChevronDown className={cn("h-3 w-3 transition-transform", !groupsExpanded && "-rotate-90")} />
              グループ
            </button>
            {groupsExpanded && (
              <div className="space-y-0.5">
                {contactGroups.map((group) => (
                  <FolderItem key={group.id} icon={FolderOpen} label={group.name} count={0}
                    isActive={groupFilter === group.id}
                    onClick={() => { setGroupFilter(group.id); setFolderFilter("new"); setAccountFilter(null); }} />
                ))}
              </div>
            )}
          </div>
        </nav>
        {/* Change #2: Removed bottom 新規作成 button */}
      </div>

      {folderFilter === "sent" && !accountFilter && !groupFilter ? (
        /* Sent messages view - replaces thread list + detail */
        <SentMessagesView />
      ) : (
        <>
      {/* Layer 3: Thread list (280px) */}
      <div className="flex h-full w-[280px] shrink-0 flex-col border-r bg-background">
        <div className="shrink-0 px-3 pt-3 pb-2 space-y-2">
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="スレッドを検索..."
              className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/50" />
          </div>

          {currentSectionLabel && (
            <div className="px-1 flex items-center justify-between">
              <p className="text-[12px] font-medium text-muted-foreground truncate">{currentSectionLabel}</p>
              {(folderFilter === "mine" || folderFilter === "mentioned" || folderFilter === "favorite") && !accountFilter && !groupFilter && (
                <div className="flex rounded-md border overflow-hidden shrink-0">
                  <button
                    onClick={() => setPersonalFolderMode("active")}
                    className={cn(
                      "px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                      personalFolderMode === "active" ? "bg-brand text-white" : "bg-background text-muted-foreground hover:bg-accent"
                    )}>
                    対応中
                  </button>
                  <button
                    onClick={() => setPersonalFolderMode("all")}
                    className={cn(
                      "px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                      personalFolderMode === "all" ? "bg-brand text-white" : "bg-background text-muted-foreground hover:bg-accent"
                    )}>
                    すべて
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div ref={conversationListRef} className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Inbox className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-[14px]">メッセージがありません</p>
            </div>
          ) : (
            filtered.map((conv) => (
              <ConversationItem key={conv.id} conversation={conv}
                isSelected={conv.id === selectedId}
                isRecentlyRead={recentlyReadIds.has(conv.id)}
                isSelfAssigned={conv.assignees.some((a) => a.id === currentUser.id)}
                folderFilter={folderFilter}
                onSelect={() => setSelectedId(conv.id)}
                onAnimationComplete={() => {
                  setRecentlyReadIds(s => {
                    const next = new Set(s);
                    next.delete(conv.id);
                    return next;
                  });
                }} />
            ))
          )}
        </div>
      </div>

      {/* Layer 4: Thread detail */}
      {selectedConversation ? (
        <ConversationDetail
          key={selectedConversation.id}
          conversation={selectedConversation}
          conversations={conversations}
          onStatusChange={handleStatusChange}
          onAssignSelf={handleAssignSelf}
          onRemoveAssignee={handleRemoveAssignee}
          onSetAssignee={handleSetAssignee}
          onOpenContactDetail={(contactId) => setDetailContactId(contactId)}
          onToggleFavorite={handleToggleFavorite}
          onRequestDelete={(id) => setDeleteConfirmId(id)}
          onSendMessage={handleSendMessage}
          onLinkConversation={handleLinkConversation}
          onUnlinkConversation={handleUnlinkConversation}
          onDeleteMemo={handleDeleteMemo}
          onNavigateToContact={(contactId) => {
            router.push(`/contacts?contact=${contactId}&edit=true`);
          }}
          onSelectConversation={(id) => setSelectedId(id)}
          onPreviewImage={setPreviewImage}
          showRightPane={showRightPane}
          onToggleRightPane={() => setShowRightPane(!showRightPane)}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Inbox className="mx-auto mb-3 h-10 w-10 opacity-20" />
            <p className="text-[15px]">スレッドを選択してください</p>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirmId(null); }}>
          <div className="w-[380px] rounded-xl bg-background p-6 shadow-xl">
            <div className="mb-4">
              <h3 className="text-[16px] font-semibold">完全に削除しますか？</h3>
              <p className="text-[13px] text-muted-foreground mt-1">この操作は取り消せません。</p>
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

      {/* Image preview modal - overlay click to close */}
      {previewImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
          onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 rounded-full bg-white/20 p-2 text-white hover:bg-white/30 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}

/* --- Sent Messages View --- */

function SentMessagesView() {
  const sentItems = [
    {
      id: "sent_1",
      type: "bulk" as const,
      subject: "【春の新商品】特別先行セールのご案内",
      body: "{{名前}}様\n\nいつもご利用いただきありがとうございます。\nこの度、春の新商品ラインナップが完成いたしましたので、お得意様限定の先行セールをご案内いたします。\n\n■ セール期間\n2026年3月10日（火）〜 3月20日（金）\n\n■ 対象商品\n春の新作コレクション全品 20%OFF\n\n■ ご利用方法\nマイページにログイン後、クーポンコード「SPRING2026」をご入力ください。\n\nご不明な点がございましたら、お気軽にお問い合わせください。\n\n今後ともよろしくお願いいたします。",
      recipientCount: 24,
      recipientGroups: ["VIP顧客"],
      recipients: [
        { name: "山田 太郎", email: "yamada@example.com" },
        { name: "佐藤 花子", email: "sato@example.com" },
        { name: "鈴木 一郎", email: "suzuki@example.com" },
        { name: "田村 裕子", email: "tamura@example.com" },
        { name: "中村 健太", email: "nakamura@example.com" },
        { name: "高橋 真一", email: "takahashi@example.com" },
        { name: "伊藤 美穂", email: "ito@example.com" },
        { name: "渡辺 大輔", email: "watanabe@example.com" },
        { name: "小林 さくら", email: "kobayashi@example.com" },
        { name: "加藤 雄介", email: "kato@example.com" },
        { name: "吉田 真理", email: "yoshida@example.com" },
        { name: "松本 翔太", email: "matsumoto@example.com" },
        { name: "井上 美咲", email: "inoue@example.com" },
        { name: "木村 太一", email: "kimura@example.com" },
        { name: "清水 愛", email: "shimizu@example.com" },
        { name: "山本 浩二", email: "yamamoto@example.com" },
        { name: "中島 彩", email: "nakajima@example.com" },
        { name: "前田 誠", email: "maeda@example.com" },
        { name: "岡田 由美", email: "okada@example.com" },
        { name: "藤田 龍", email: "fujita@example.com" },
        { name: "後藤 麻衣", email: "goto@example.com" },
        { name: "長谷川 翼", email: "hasegawa@example.com" },
        { name: "村上 恵", email: "murakami@example.com" },
        { name: "近藤 光", email: "kondo@example.com" },
      ],
      bccEmails: ["archive@example.com"],
      variables: { "名前": "連絡先名", "会社名": "会社名" } as Record<string, string>,
      sentAt: "2026-03-05 14:30",
      sentBy: "田中 美咲",
      channel: "email" as Channel,
      fromEmail: "support@cobox.jp",
    },
    {
      id: "sent_2",
      type: "individual" as const,
      subject: "Re: 商品に関するお問い合わせ",
      body: "山田様\n\nお問い合わせいただきありがとうございます。\nご質問の件について回答いたします。\n\nお問い合わせいただいた商品「プレミアムセット A」の在庫状況ですが、現在在庫がございます。\nご注文いただければ、通常2〜3営業日以内に発送いたします。\n\n配送先やお支払い方法についてご不明点があれば、お気軽にご連絡ください。\n\nよろしくお願いいたします。\n\n田中 美咲\nカスタマーサポート",
      recipientCount: 1,
      recipientName: "山田 太郎",
      recipients: [{ name: "山田 太郎", email: "yamada@example.com" }],
      bccEmails: [],
      sentAt: "2026-03-05 11:15",
      sentBy: "田中 美咲",
      channel: "email" as Channel,
      fromEmail: "support@cobox.jp",
      linkedContactId: "contact_2",
    },
    {
      id: "sent_3",
      type: "bulk" as const,
      subject: "メンテナンスのお知らせ",
      body: "{{名前}}様\n\nいつもご利用いただきありがとうございます。\n下記の日程でシステムメンテナンスを実施いたします。\n\n■ メンテナンス日時\n2026年3月8日（日） 02:00 〜 06:00（予定）\n\n■ 影響範囲\nメンテナンス中はサービス全体がご利用いただけません。\n\n■ ご注意\nメンテナンス前に作業中のデータは必ず保存してください。\n\nご不便をおかけしますが、サービス品質向上のため何卒ご了承ください。\n\n株式会社CoBox\nシステム運営チーム",
      recipientCount: 156,
      recipientGroups: ["全顧客", "パートナー"],
      recipients: [
        { name: "山田 太郎", email: "yamada@example.com" },
        { name: "佐藤 花子", email: "sato@example.com" },
        { name: "鈴木 一郎", email: "suzuki@example.com" },
        { name: "高橋 真一", email: "takahashi@example.com" },
        { name: "伊藤 美穂", email: "ito@example.com" },
      ],
      bccEmails: ["log@example.com"],
      variables: { "名前": "連絡先名" } as Record<string, string>,
      sentAt: "2026-03-04 09:00",
      sentBy: "佐藤 健一",
      channel: "email" as Channel,
      fromEmail: "info@cobox.jp",
    },
    {
      id: "sent_4",
      type: "individual" as const,
      subject: "",
      body: "ありがとうございます！確認いたしました。\n商品の発送手続きを進めさせていただきますので、到着まで少々お待ちください。\n\n何かございましたらお気軽にご連絡ください。",
      recipientCount: 1,
      recipientName: "鈴木 花子",
      recipients: [{ name: "鈴木 花子", email: "" }],
      bccEmails: [],
      sentAt: "2026-03-03 16:45",
      sentBy: "田中 美咲",
      channel: "line" as Channel,
      linkedContactId: "contact_3",
    },
  ];

  const [selectedSent, setSelectedSent] = useState<string | null>(null);
  const [sentSearch, setSentSearch] = useState("");
  const [recipientsExpanded, setRecipientsExpanded] = useState(false);
  const [bodyTab, setBodyTab] = useState<"template" | "preview">("template");
  const [previewRecipientIdx, setPreviewRecipientIdx] = useState(0);
  const selectedItem = sentItems.find((s) => s.id === selectedSent);
  const sentListRef = useRef<HTMLDivElement>(null);

  const filteredSentItems = useMemo(() => {
    if (!sentSearch.trim()) return sentItems;
    const q = sentSearch.toLowerCase();
    return sentItems.filter((item) =>
      item.subject?.toLowerCase().includes(q) ||
      item.body.toLowerCase().includes(q) ||
      (item.recipientName && item.recipientName.toLowerCase().includes(q))
    );
  }, [sentSearch]);

  // Keyboard navigation for sent messages
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = filteredSentItems.findIndex((s) => s.id === selectedSent);
        let nextIdx = idx;
        if (e.key === "ArrowDown" && idx < filteredSentItems.length - 1) nextIdx = idx + 1;
        else if (e.key === "ArrowUp" && idx > 0) nextIdx = idx - 1;
        if (nextIdx !== idx) {
          setSelectedSent(filteredSentItems[nextIdx].id);
          const container = sentListRef.current;
          if (container) {
            const buttons = container.querySelectorAll<HTMLButtonElement>(":scope > button");
            buttons[nextIdx]?.scrollIntoView({ block: "nearest" });
            buttons[nextIdx]?.focus();
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedSent, filteredSentItems]);

  // Resolve variable preview
  const renderPreviewBody = (body: string, variables: Record<string, string>) => {
    let result = body;
    Object.entries(variables).forEach(([key, val]) => {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
    });
    return result;
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sent list - 280px matching other folders */}
      <div className="flex h-full w-[280px] shrink-0 flex-col border-r bg-background">
        <div className="shrink-0 px-3 pt-3 pb-2 space-y-2">
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={sentSearch} onChange={(e) => setSentSearch(e.target.value)}
              placeholder="送信済みを検索..."
              className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/50" />
          </div>
          <div className="px-1">
            <p className="text-[12px] font-medium text-muted-foreground truncate">送信済み</p>
          </div>
        </div>

        <div ref={sentListRef} className="flex-1 overflow-y-auto">
          {filteredSentItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Send className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-[14px]">送信メッセージがありません</p>
            </div>
          ) : (
            filteredSentItems.map((item) => {
              const Icon = channelIcons[item.channel];
              const isSelected = selectedSent === item.id;
              return (
                <button key={item.id}
                  onClick={() => setSelectedSent(item.id)}
                  className={cn(
                    "w-full text-left px-3 py-3 border-b transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset",
                    isSelected ? "bg-brand text-white" : "hover:bg-accent/30"
                  )}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-white/80" : channelStyles[item.channel].text)} />
                    {item.type === "bulk" && (
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", isSelected ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700")}>一括送信済み</span>
                    )}
                    <span className={cn("text-[11px] ml-auto", isSelected ? "text-white/70" : "text-muted-foreground")}>{item.sentAt}</span>
                  </div>
                  <p className={cn("text-[13px] font-medium truncate", isSelected && "text-white")}>
                    {item.subject || item.body.slice(0, 30)}
                  </p>
                  <p className={cn("text-[12px] truncate mt-0.5", isSelected ? "text-white/70" : "text-muted-foreground")}>
                    {item.type === "bulk"
                      ? `${item.recipientCount}名に送信`
                      : item.recipientName}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Sent detail */}
      {selectedItem ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              {(() => { const Icon = channelIcons[selectedItem.channel]; return <Icon className={cn("h-4 w-4", channelStyles[selectedItem.channel].text)} />; })()}
              {selectedItem.type === "bulk" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">一括送信済み</span>
              )}
              <span className="text-[13px] text-muted-foreground">{selectedItem.sentAt}</span>
              <span className="text-[13px] text-muted-foreground">· 送信者: {selectedItem.sentBy}</span>
            </div>

            {selectedItem.subject && (
              <h2 className="text-[18px] font-semibold mb-4">{selectedItem.subject}</h2>
            )}

            {/* Recipients info with email addresses */}
            <div className="rounded-lg border bg-accent/20 p-4 mb-4 space-y-2">
              {selectedItem.channel === "email" && selectedItem.fromEmail && (
                <div className="flex items-start gap-2">
                  <span className="text-[12px] font-medium text-muted-foreground w-12 shrink-0 pt-0.5">From</span>
                  <span className="text-[13px]">{selectedItem.fromEmail}</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-[12px] font-medium text-muted-foreground w-12 shrink-0 pt-0.5">To</span>
                <div className="text-[13px] flex-1 min-w-0">
                  {selectedItem.type === "bulk" && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span>{selectedItem.recipientCount}名</span>
                        {selectedItem.recipientGroups && (
                          <span className="flex items-center gap-1">
                            <FolderOpen className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">{selectedItem.recipientGroups.join(", ")}</span>
                          </span>
                        )}
                      </div>
                      {selectedItem.recipients && selectedItem.recipients.length > 0 && (
                        <div className="space-y-0.5 text-[12px]">
                          {(recipientsExpanded ? selectedItem.recipients : selectedItem.recipients.slice(0, 3)).map((r, i) => (
                            <div key={i} className="truncate">
                              <span>{r.name}</span>
                              {r.email && <span className="text-muted-foreground ml-1">&lt;{r.email}&gt;</span>}
                            </div>
                          ))}
                          {!recipientsExpanded && selectedItem.recipients.length > 3 && (
                            <button onClick={() => setRecipientsExpanded(true)}
                              className="text-brand hover:underline cursor-pointer text-[12px]">
                              他 {selectedItem.recipients.length - 3}名を表示
                            </button>
                          )}
                          {recipientsExpanded && selectedItem.recipients.length > 3 && (
                            <button onClick={() => setRecipientsExpanded(false)}
                              className="text-brand hover:underline cursor-pointer text-[12px]">
                              折りたたむ
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {selectedItem.type === "individual" && selectedItem.recipients && (
                    <div>
                      <span>{selectedItem.recipients[0]?.name}</span>
                      {selectedItem.recipients[0]?.email && (
                        <span className="text-muted-foreground ml-1.5">&lt;{selectedItem.recipients[0].email}&gt;</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {selectedItem.bccEmails && selectedItem.bccEmails.length > 0 && (
                <div className="flex items-start gap-2">
                  <span className="text-[12px] font-medium text-muted-foreground w-12 shrink-0 pt-0.5">BCC</span>
                  <span className="text-[13px] text-muted-foreground">{selectedItem.bccEmails.join(", ")}</span>
                </div>
              )}
            </div>

            {/* Linked contact */}
            {selectedItem.linkedContactId && (() => {
              const contact = contacts.find((c) => c.id === selectedItem.linkedContactId);
              return contact ? (
                <div className="flex items-center gap-2 mb-4 rounded-lg border px-3 py-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[13px]">連絡先: {contact.name}</span>
                  {contact.company && <span className="text-[12px] text-muted-foreground">({contact.company})</span>}
                </div>
              ) : null;
            })()}

            {/* Message body with template/preview tabs for bulk */}
            {selectedItem.type === "bulk" && selectedItem.variables ? (
              <div className="rounded-lg border bg-white">
                <div className="flex border-b">
                  <button onClick={() => setBodyTab("template")}
                    className={cn("flex-1 px-4 py-2.5 text-[13px] font-medium transition-colors cursor-pointer",
                      bodyTab === "template" ? "text-foreground border-b-2 border-brand" : "text-muted-foreground hover:text-foreground"
                    )}>テンプレート本文</button>
                  <button onClick={() => setBodyTab("preview")}
                    className={cn("flex-1 px-4 py-2.5 text-[13px] font-medium transition-colors cursor-pointer",
                      bodyTab === "preview" ? "text-foreground border-b-2 border-brand" : "text-muted-foreground hover:text-foreground"
                    )}>送信プレビュー</button>
                </div>
                {bodyTab === "template" ? (
                  <div className="p-5">
                    <div className="text-[15px] leading-relaxed whitespace-pre-wrap">{selectedItem.body}</div>
                  </div>
                ) : (
                  <div className="p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-[12px] text-muted-foreground">送信先:</span>
                      <select
                        value={previewRecipientIdx}
                        onChange={(e) => setPreviewRecipientIdx(Number(e.target.value))}
                        className="rounded-md border px-2 py-1 text-[13px] outline-none focus:border-brand/40 cursor-pointer">
                        {selectedItem.recipients.map((r, i) => (
                          <option key={i} value={i}>{r.name} &lt;{r.email}&gt;</option>
                        ))}
                      </select>
                    </div>
                    <div className="rounded-md border bg-accent/10 p-4 text-[15px] leading-relaxed whitespace-pre-wrap">
                      {renderPreviewBody(selectedItem.body, {
                        ...selectedItem.variables,
                        ...Object.fromEntries(Object.entries(selectedItem.variables).map(([key]) => {
                          const recipient = selectedItem.recipients[previewRecipientIdx];
                          if (key === "名前") return [key, recipient?.name ?? ""];
                          if (key === "会社名") return [key, "株式会社サンプル"];
                          return [key, selectedItem.variables[key]];
                        }))
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border bg-white p-5">
                <div className="text-[15px] leading-relaxed whitespace-pre-wrap">{selectedItem.body}</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Send className="mx-auto mb-3 h-10 w-10 opacity-20" />
            <p className="text-[15px]">送信メッセージを選択してください</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Folder Items --- */

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
      {count > 0 && (
        <span className={cn(
          "min-w-[20px] text-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none",
          isActive ? "bg-brand text-white" : "bg-foreground/8 text-muted-foreground"
        )}>
          {count}
        </span>
      )}
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
      {count > 0 && (
        <span className={cn(
          "min-w-[20px] text-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none",
          isActive ? "bg-brand text-white" : "bg-foreground/8 text-muted-foreground"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

/* --- Conversation List Item --- */
/* Change #9: added isSelfAssigned prop for green background */

function ConversationItem({ conversation, isSelected, isRecentlyRead, isSelfAssigned, folderFilter, onSelect, onAnimationComplete }: {
  conversation: Conversation; isSelected: boolean; isRecentlyRead?: boolean;
  isSelfAssigned: boolean;
  folderFilter: FolderFilter;
  onSelect: () => void; onAnimationComplete?: () => void;
}) {
  const { contactName, channel, lastMessage, lastMessageAt, assignees, subject } = conversation;
  const Icon = channelIcons[channel];
  const style = channelStyles[channel];
  const unread = isUnread(conversation);
  const isCompleted = conversation.status === "completed";
  const isNoAction = conversation.status === "no_action";

  const displayText = channel === "email" && subject ? subject : lastMessage;

  // Show status labels for 完了/対応なし/自分が担当 folders
  const showStatus = folderFilter === "completed" || folderFilter === "no_action" || folderFilter === "mine";
  const statusLabels: Record<string, string> = { open: "対応中", completed: "完了", no_action: "対応なし" };
  const statusLabel = statusLabels[conversation.status] ?? "新着";
  const statusColor = conversation.status === "completed" ? "text-brand" : conversation.status === "no_action" ? "text-muted-foreground" : "text-foreground";
  const statusIcon = conversation.status === "completed" ? <Check className="h-3.5 w-3.5" /> : conversation.status === "no_action" ? <Ban className="h-3.5 w-3.5" /> : <MessageCircleMore className="h-3.5 w-3.5" />;

  return (
    <button onClick={onSelect}
      onAnimationEnd={() => {
        if (isRecentlyRead && onAnimationComplete) onAnimationComplete();
      }}
      className={cn(
        "flex w-full gap-2.5 border-b px-3 py-2.5 text-left transition-all duration-300 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset",
        isSelected
          ? "bg-brand text-white"
          : isSelfAssigned
            ? "bg-brand/5 hover:bg-brand/10"
            : isCompleted || isNoAction
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

        {/* Assignees / Status */}
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {showStatus ? (
              <span className={cn("flex items-center gap-1 text-[12px] font-medium truncate",
                isSelected ? "text-white/60" : statusColor)}>
                {statusIcon}
                <span className="truncate">{statusLabel}</span>
              </span>
            ) : assignees.length > 0 ? (
              <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                <div className="flex items-center shrink-0">
                  {assignees.map((a) => (
                    <Avatar key={a.id} src={a.avatar} fallback={a.name} size="sm" className="h-4 w-4 text-[6px]" />
                  ))}
                </div>
                <span className={cn("text-[12px] truncate", isSelected ? "text-white/60" : "text-muted-foreground")}>
                  {assignees[0].name}{assignees.length > 1 ? ` +${assignees.length - 1}` : ""}
                </span>
              </div>
            ) : (
              <span className={cn("flex items-center gap-1 text-[12px] font-medium truncate",
                isSelected ? "text-white/50" : "text-muted-foreground/60")}>
                <CircleDashed className="h-4 w-4 shrink-0" />
                <span className="truncate">担当者なし</span>
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

/* --- Assignee Popover (multi-select, focus-out close) --- */

function AssigneePopover({ conversation, isSelfAssigned, roundLeft, onSetAssignee, onRemoveAssignee, onClearAssignees }: {
  conversation: Conversation;
  isSelfAssigned: boolean;
  roundLeft?: boolean;
  onSetAssignee: (id: string, assigneeId: string) => void;
  onRemoveAssignee: (id: string, assigneeId: string) => void;
  onClearAssignees: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isNoOne = conversation.assignees.length === 0;

  return (
    <div ref={ref} className="relative">
      <Button variant={isSelfAssigned ? "ghost" : "outline"} size="sm"
        className={cn(
          "h-9 gap-1 text-[14px] px-3",
          !isSelfAssigned && !roundLeft && "rounded-l-none",
          isSelfAssigned && "border"
        )}
        onClick={() => setOpen(!open)}>
        {conversation.assignees.length > 0 ? (
          <span className="flex items-center gap-1">
            {conversation.assignees.map((a) => (
              <Avatar key={a.id} src={a.avatar} fallback={a.name} size="sm" className="h-4 w-4 text-[6px]" />
            ))}
            {conversation.assignees.length === 1
              ? conversation.assignees[0].name
              : `${conversation.assignees[0].name}+${conversation.assignees.length - 1}`}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground">
            <CircleDashed className="h-3.5 w-3.5" />
            担当者なし
          </span>
        )}
        <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 min-w-[200px] rounded-lg border bg-popover p-1 shadow-md">
          {/* 担当者なし option */}
          <button
            onClick={() => {
              if (!isNoOne) onClearAssignees(conversation.id);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[15px] transition-colors cursor-pointer",
              isNoOne ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}>
            <CircleDashed className="h-4 w-4" />
            担当者なし
            {isNoOne && <Check className="h-3 w-3 ml-auto text-brand" />}
          </button>
          <div className="my-1 border-t" />
          {/* Team members */}
          {teamMembers.map((m) => {
            const isAssigned = conversation.assignees.some((a) => a.id === m.id);
            return (
              <button key={m.id}
                onClick={() => isAssigned ? onRemoveAssignee(conversation.id, m.id) : onSetAssignee(conversation.id, m.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[15px] transition-colors cursor-pointer",
                  isAssigned ? "bg-accent text-foreground font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                <Avatar src={m.avatar} fallback={m.name} size="sm" className="h-4 w-4 text-[6px]" />
                {m.name}
                {isAssigned && <Check className="h-3 w-3 ml-auto text-brand" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* --- Conversation Detail --- */

function ConversationDetail({ conversation, conversations: allConvs, onStatusChange,
  onAssignSelf, onRemoveAssignee, onSetAssignee,
  onOpenContactDetail, onToggleFavorite, onRequestDelete,
  onSendMessage, onLinkConversation, onUnlinkConversation,
  onNavigateToContact, onSelectConversation, onPreviewImage,
  onDeleteMemo,
  showRightPane, onToggleRightPane }: {
  conversation: Conversation; conversations: Conversation[];
  onStatusChange: (id: string, status: Status) => void;
  onAssignSelf: (id: string) => void;
  onRemoveAssignee: (id: string, assigneeId: string) => void;
  onSetAssignee: (id: string, assigneeId: string) => void;
  onOpenContactDetail: (contactId: string) => void;
  onToggleFavorite: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onSendMessage: (id: string, content: string, isInternal: boolean, attachments?: Attachment[]) => void;
  onLinkConversation: (convId: string, targetId: string) => void;
  onUnlinkConversation: (convId: string, targetId: string) => void;
  onNavigateToContact: (contactId: string) => void;
  onSelectConversation: (id: string) => void;
  onPreviewImage: (url: string) => void;
  onDeleteMemo: (convId: string, messageId: string) => void;
  showRightPane: boolean;
  onToggleRightPane: () => void;
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

  // LINE stamp picker state
  const [showStampPicker, setShowStampPicker] = useState(false);
  const [stampPickerPos, setStampPickerPos] = useState({ left: 0, bottom: 0 });
  const stampPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showStampPicker) return;
    const handler = (e: MouseEvent) => {
      if (stampPickerRef.current && !stampPickerRef.current.contains(e.target as Node)) {
        setShowStampPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showStampPicker]);

  // File input ref for attachments
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; size: string; type: string; url: string }[]>([]);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return teamMembers.filter((m) => m.name.toLowerCase().includes(q));
  }, [mentionQuery]);

  const insertMention = useCallback((memberName: string) => {
    const start = mentionStartRef.current;
    const before = memoText.substring(0, start);
    const queryEnd = memoRef.current?.selectionStart ?? start;
    const after = memoText.substring(queryEnd);
    const newText = `${before}@${memberName} ${after}`;
    setMemoText(newText);
    setMentionQuery(null);
    setMentionIndex(0);
    mentionStartRef.current = -1;
    requestAnimationFrame(() => {
      if (memoRef.current) {
        const cursorPos = before.length + memberName.length + 2;
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
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((prev) => Math.min(prev + 1, mentionCandidates.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((prev) => Math.max(prev - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionCandidates[mentionIndex].name); return; }
      if (e.key === "Escape") { e.preventDefault(); setMentionQuery(null); return; }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleSendMemo(); }
  };

  const Icon = channelIcons[conversation.channel];
  const style = channelStyles[conversation.channel];

  const isEmail = conversation.channel === "email";
  const isLine = conversation.channel === "line";
  const isSelfAssigned = conversation.assignees.some((a) => a.id === currentUser.id);

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

  const handleReplyChange = (text: string) => {
    setReplyText(text);
    if (text.length === 1 && !isSelfAssigned) {
      onAssignSelf(conversation.id);
    }
  };

  const handleSendReply = () => {
    if (!replyText.trim() && attachedFiles.length === 0) return;
    const content = replyText.trim() || (attachedFiles.length > 0 ? `[添付ファイル: ${attachedFiles.map(f => f.name).join(", ")}]` : "");
    const msgAttachments: Attachment[] = attachedFiles.map((f, i) => ({
      id: `att-${Date.now()}-${i}`,
      name: f.name,
      type: f.type === "image" ? "image" as const : "file" as const,
      url: f.url,
      size: f.size,
    }));
    onSendMessage(conversation.id, content, false, msgAttachments);
    setReplyText("");
    setAttachedFiles([]);
  };

  const handleSendMemo = () => {
    if (!memoText.trim()) return;
    onSendMessage(conversation.id, memoText.trim(), true);
    setMemoText("");
  };

  // Right pane data
  const linkedContact = conversation.linkedContactId
    ? contacts.find((c) => c.id === conversation.linkedContactId)
    : null;
  const contactConversations = linkedContact
    ? allConvs.filter((c) => c.contactId === linkedContact.id)
    : allConvs.filter((c) => c.contactId === conversation.contactId);
  const linkedIds = conversation.linkedConversationIds ?? [];

  // Change #18: linked conversations data
  const linkedConversations = linkedIds.map((id) => allConvs.find((c) => c.id === id)).filter(Boolean) as Conversation[];

  const headerRef = useRef<HTMLElement>(null);
  const [headerNarrow, setHeaderNarrow] = useState(false);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderNarrow(entry.contentRect.width < 640);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="flex h-full min-w-0 flex-1">
      {/* Main conversation area */}
      <div className="flex h-full min-w-[400px] flex-1 flex-col bg-background">
        {/* Action bar */}
        <header ref={headerRef} className="relative flex shrink-0 items-center justify-between gap-2 border-b px-5 py-3 min-w-0" style={{ minHeight: "70px" }}>
          {/* clicking contact name toggles right pane */}
          <button onClick={onToggleRightPane}
            className="flex min-w-0 items-center gap-3 cursor-pointer rounded-lg px-2 py-1.5 -ml-2 transition-colors hover:bg-accent active:bg-accent/80 shrink-0" style={{ maxWidth: "40%" }}>
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

          <div className="flex items-center gap-1.5 shrink-0 justify-end">
            {/* Assign self + assignee dropdown */}
            <div className="flex items-center">
              {!isSelfAssigned && !headerNarrow && (
                <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[14px] px-3 rounded-r-none border-r-0"
                  onClick={() => onAssignSelf(conversation.id)}>
                  <Avatar src={currentUser.avatar} fallback={currentUser.name} size="sm" className="h-4 w-4 text-[6px]" />
                  担当する
                </Button>
              )}
              <AssigneePopover
                conversation={conversation}
                isSelfAssigned={isSelfAssigned}
                roundLeft={headerNarrow}
                onSetAssignee={onSetAssignee}
                onRemoveAssignee={onRemoveAssignee}
                onClearAssignees={(id) => {
                  conversation.assignees.forEach((a) => onRemoveAssignee(id, a.id));
                }}
              />
            </div>

            {/* Connected toggle button group for 完了 and 対応なし with icons */}
            <div className="flex items-center">
              <Button size="sm"
                variant={conversation.status === "completed" ? "default" : "outline"}
                className={cn(
                  "h-9 text-[14px] px-3 gap-1.5 rounded-r-none border-r-0",
                  conversation.status === "completed" && "bg-brand hover:bg-brand/90"
                )}
                onClick={() => onStatusChange(conversation.id, conversation.status === "completed" ? "open" : "completed")}>
                <Check className="h-3.5 w-3.5" />
                {!headerNarrow && <span>完了</span>}
              </Button>
              <Button size="sm"
                variant={conversation.status === "no_action" ? "default" : "outline"}
                className={cn(
                  "h-9 text-[14px] px-3 gap-1.5 rounded-l-none",
                  conversation.status === "no_action" && "bg-muted-foreground hover:bg-muted-foreground/90"
                )}
                onClick={() => onStatusChange(conversation.id, conversation.status === "no_action" ? "open" : "no_action")}>
                <Ban className="h-3.5 w-3.5" />
                {!headerNarrow && <span>対応なし</span>}
              </Button>
            </div>

            {/* Change #11: More menu without 未読にする and without 対応なし */}
            <Dropdown align="right"
              trigger={<Button variant="ghost" size="icon-sm" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>}>
              <DropdownItem onClick={() => onToggleFavorite(conversation.id)}>
                <Star className={cn("h-3.5 w-3.5", conversation.isFavorite && "fill-amber-400 text-amber-400")} />
                {conversation.isFavorite ? "お気に入りを解除" : "お気に入り"}
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
            {/* Related messages - single line format */}
            {linkedConversations.length > 0 && linkedConversations.some((lc) => new Date(lc.lastMessageAt) <= new Date(conversation.messages[0]?.timestamp ?? "")) && (
              <div className="space-y-1">
                {linkedConversations.filter((lc) => new Date(lc.lastMessageAt) <= new Date(conversation.messages[0]?.timestamp ?? "")).map((lc) => (
                  <button key={lc.id} onClick={() => onSelectConversation(lc.id)}
                    className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors truncate w-full text-left border border-border rounded-lg px-3 py-2 hover:bg-accent">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-brand" />
                    <span className="truncate">関連メッセージ：{lc.channel === "email" ? (lc.subject || lc.lastMessage) : (lc.messages[0]?.content || lc.lastMessage)}</span>
                  </button>
                ))}
              </div>
            )}

            {conversation.messages.map((message) => (
              <MessageBubble key={message.id} message={message} channel={conversation.channel}
                contactEmail={contactObj?.email} onPreviewImage={onPreviewImage}
                onDeleteMemo={(msgId) => onDeleteMemo(conversation.id, msgId)} />
            ))}
            <div ref={messagesEndRef} />

            {/* Reply input */}
            <div className="flex justify-end">
              <div className="w-[70%] rounded-lg border bg-background focus-within:border-brand/30">
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
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); handleSendReply(); }
                  }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = Math.min(el.scrollHeight, 160) + "px";
                  }} />
                {/* Attached files preview */}
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-3 py-2 border-t">
                    {attachedFiles.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border bg-accent/20 px-2.5 py-1.5 text-[13px]">
                        {file.type === "image" ? (
                          <img src={file.url} alt={file.name} className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate max-w-[120px]">{file.name}</span>
                        <span className="text-[11px] text-muted-foreground shrink-0">{file.size}</span>
                        <button onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between px-3 pb-2">
                  <div className="flex items-center gap-1">
                    {/* Attachment button */}
                    <Tooltip content="ファイルを添付" side="right">
                      <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-muted-foreground"
                        onClick={() => fileInputRef.current?.click()}>
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                    <input ref={fileInputRef} type="file" multiple className="hidden"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (!files) return;
                        const newFiles = Array.from(files).map((f) => ({
                          name: f.name,
                          size: f.size < 1024 * 1024 ? `${Math.round(f.size / 1024)}KB` : `${(f.size / (1024 * 1024)).toFixed(1)}MB`,
                          type: f.type.startsWith("image/") ? "image" : "file",
                          url: URL.createObjectURL(f),
                        }));
                        setAttachedFiles((prev) => [...prev, ...newFiles]);
                        e.target.value = "";
                      }} />
                    {/* Change #19: stamp picker with fixed positioning to avoid overflow clipping */}
                    {isLine && (
                      <div ref={stampPickerRef} className="relative">
                        <Tooltip content="スタンプ" side="right">
                          <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-muted-foreground"
                            onClick={(e) => {
                              if (!showStampPicker) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setStampPickerPos({ left: rect.left, bottom: window.innerHeight - rect.top + 8 });
                              }
                              setShowStampPicker(!showStampPicker);
                            }}>
                            <Smile className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        {showStampPicker && (
                          <div className="fixed w-[320px] max-h-[280px] rounded-lg border bg-popover p-3 shadow-lg z-[500] overflow-y-auto"
                            style={{ left: stampPickerPos.left, bottom: stampPickerPos.bottom }}>
                            <p className="mb-2 text-[12px] font-medium text-muted-foreground sticky top-0 bg-popover pb-1">スタンプ</p>
                            <div className="grid grid-cols-4 gap-2">
                              {lineStampLabels.map((label, i) => (
                                <button key={i}
                                  className="flex h-14 items-center justify-center rounded-lg border bg-channel-line/5 text-[13px] font-medium text-channel-line hover:bg-channel-line/15 transition-colors cursor-pointer"
                                  onClick={() => { onSendMessage(conversation.id, `[スタンプ: ${label}]`, false); setShowStampPicker(false); }}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <Button size="sm" className="h-8 rounded-md bg-brand hover:bg-brand/90 px-4 text-[14px]"
                    disabled={!replyText.trim() && attachedFiles.length === 0} onClick={handleSendReply}>
                    <Send className="h-3 w-3 mr-1" /> 送信
                  </Button>
                </div>
              </div>
            </div>

            {/* Related messages at bottom - only newer ones */}
            {linkedConversations.length > 0 && linkedConversations.some((lc) => new Date(lc.lastMessageAt) > new Date(conversation.messages[0]?.timestamp ?? "")) && (
              <div className="space-y-1">
                {linkedConversations.filter((lc) => new Date(lc.lastMessageAt) > new Date(conversation.messages[0]?.timestamp ?? "")).map((lc) => (
                  <button key={lc.id} onClick={() => onSelectConversation(lc.id)}
                    className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors truncate w-full text-left border border-border rounded-lg px-3 py-2 hover:bg-accent">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-brand" />
                    <span className="truncate">関連メッセージ：{lc.channel === "email" ? (lc.subject || lc.lastMessage) : (lc.messages[0]?.content || lc.lastMessage)}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Message ID removed from here - moved to contact pane */}
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
                    if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 80) + "px"; }
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
              {mentionQuery !== null && mentionCandidates.length > 0 && mentionPos && (
                <div className="absolute bottom-full left-8 mb-1 w-[200px] rounded-lg border bg-popover p-1 shadow-lg z-[300]">
                  {mentionCandidates.map((member, i) => (
                    <button key={member.id}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] transition-colors cursor-pointer",
                        i === mentionIndex ? "bg-accent text-foreground" : "text-foreground hover:bg-accent/50"
                      )}
                      onMouseDown={(e) => { e.preventDefault(); insertMention(member.name); }}
                      onMouseEnter={() => setMentionIndex(i)}>
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

      {/* Change #13: Right side pane - toggleable */}
      {showRightPane && (
        <RightSidePane
          conversation={conversation}
          allConversations={allConvs}
          contactConversations={contactConversations}
          linkedContact={linkedContact}
          linkedIds={linkedIds}
          onLinkConversation={onLinkConversation}
          onUnlinkConversation={onUnlinkConversation}
          onNavigateToContact={onNavigateToContact}
          onSelectConversation={onSelectConversation}
          onClose={onToggleRightPane}
        />
      )}
    </div>
  );
}

/* --- Right Side Pane --- */
/* Changes #13, #14, #15, #16, #17 applied here */

function RightSidePane({ conversation, allConversations, contactConversations, linkedContact, linkedIds,
  onLinkConversation, onUnlinkConversation, onNavigateToContact, onSelectConversation, onClose }: {
  conversation: Conversation;
  allConversations: Conversation[];
  contactConversations: Conversation[];
  linkedContact: Contact | null | undefined;
  linkedIds: string[];
  onLinkConversation: (convId: string, targetId: string) => void;
  onUnlinkConversation: (convId: string, targetId: string) => void;
  onNavigateToContact: (contactId: string) => void;
  onSelectConversation: (id: string) => void;
  onClose: () => void;
}) {
  const [showLinkPicker, setShowLinkPicker] = useState(false);

  const contactObj = contacts.find((c) => c.id === conversation.contactId);
  const contactGroups_ = contactGroups.filter((g) => g.contactIds.includes(conversation.contactId));

  return (
    <div className="flex h-full w-[300px] min-w-[260px] shrink-0 flex-col border-l bg-background overflow-y-auto">
      {/* Header with message ID and close button */}
      <div className="shrink-0 px-4 flex items-center justify-between" style={{ height: "70px" }}>
        <span className="text-[13px] font-medium text-muted-foreground">
          メッセージID: {formatMessageNumber(conversation.messageNumber)}
        </span>
        <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Change #14: 連絡先 section - always shown, no toggle */}
        <section className="mb-4">
          <div className="flex w-full items-center gap-1.5 py-1.5 text-[14px] font-semibold text-foreground">
            連絡先
          </div>
          <div className="mt-2 space-y-2">
            {linkedContact || contactObj ? (
              <div>
                {/* Change #15: increased text sizes */}
                <button
                  onClick={() => onNavigateToContact((linkedContact ?? contactObj)!.id)}
                  className="text-[16px] font-medium text-brand hover:text-brand/80 cursor-pointer transition-colors"
                >
                  {(linkedContact ?? contactObj)!.name}
                </button>
                {(linkedContact ?? contactObj)!.company && (
                  <p className="text-[14px] text-muted-foreground">{(linkedContact ?? contactObj)!.company}</p>
                )}

                {/* Channel info */}
                <div className="mt-2 space-y-1">
                  {(linkedContact ?? contactObj)!.channels.map((ch) => {
                    const CIcon = channelIcons[ch.channel];
                    const s = channelStyles[ch.channel];
                    return (
                      <div key={ch.channel + ch.handle} className="flex items-center gap-2 text-[14px]">
                        <CIcon className={cn("h-3.5 w-3.5", s.text)} />
                        <span className="text-muted-foreground">{ch.handle}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Groups */}
                {contactGroups_.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {contactGroups_.map((g) => (
                      <span key={g.id} className="rounded-full bg-accent px-2 py-0.5 text-[12px] font-medium text-foreground/70">{g.name}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button className="flex items-center gap-1.5 text-[14px] text-brand hover:text-brand/80 transition-colors cursor-pointer">
                <Plus className="h-3.5 w-3.5" />
                連絡先と紐づける
              </button>
            )}
          </div>
        </section>

        {/* Change #14: メッセージ履歴 section - always shown, no toggle */}
        <section>
          <div className="flex w-full items-center gap-1.5 py-1.5 text-[14px] font-semibold text-foreground">
            メッセージ履歴
          </div>
          <div className="mt-2 space-y-1.5">
            {contactConversations.length === 0 ? (
              <p className="text-[14px] text-muted-foreground/60">履歴はありません</p>
            ) : (
              contactConversations.map((conv) => {
                const CIcon = channelIcons[conv.channel];
                const s = channelStyles[conv.channel];
                const isLinked = linkedIds.includes(conv.id);
                const isCurrent = conv.id === conversation.id;
                return (
                  <ThreadHistoryItem
                    key={conv.id}
                    conv={conv}
                    CIcon={CIcon}
                    channelStyle={s}
                    isLinked={isLinked}
                    isCurrent={isCurrent}
                    currentConvId={conversation.id}
                    onSelect={() => onSelectConversation(conv.id)}
                    onLink={() => onLinkConversation(conversation.id, conv.id)}
                    onUnlink={() => onUnlinkConversation(conversation.id, conv.id)}
                  />
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/* --- Thread History Item (with link menu) --- */
/* Change #15: increased text sizes, Change #17: clickable to navigate */

function ThreadHistoryItem({ conv, CIcon, channelStyle, isLinked, isCurrent, currentConvId, onSelect, onLink, onUnlink }: {
  conv: Conversation;
  CIcon: React.ElementType;
  channelStyle: { bg: string; text: string };
  isLinked: boolean;
  isCurrent: boolean;
  currentConvId: string;
  onSelect: () => void;
  onLink: () => void;
  onUnlink: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-md px-2.5 py-2 transition-colors",
        isCurrent ? "border-2" : "border",
        !isCurrent && (isLinked ? "border-brand/20" : "hover:bg-accent/30"),
        !isCurrent && "cursor-pointer"
      )}
      style={isCurrent ? { borderColor: "var(--brand)" } : undefined}
      onClick={() => !isCurrent && onSelect()}
    >
      <div className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", channelStyle.bg)}>
        <CIcon className={cn("h-2.5 w-2.5", channelStyle.text)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{conv.subject || conv.messages?.[0]?.content || conv.lastMessage}</p>
        <p className="text-[12px] text-muted-foreground">{conv.lastMessageAt}</p>
      </div>

      {/* Link icon + menu */}
      {!isCurrent && (
        <div className="relative shrink-0 flex items-center gap-0.5" ref={menuRef}>
          {isLinked ? (
            /* Linked: show link icon always, click opens unlink popover */
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="flex h-7 w-7 items-center justify-center rounded text-brand hover:bg-accent cursor-pointer"
            >
              <Link2 className="h-4 w-4" />
            </button>
          ) : (
            /* Not linked: show ... on hover or when menu open */
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className={cn("h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent cursor-pointer self-center",
                showMenu ? "flex" : "hidden group-hover:flex"
              )}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
          {showMenu && (
            <div className="absolute right-0 top-8 z-[200] w-auto rounded-lg border bg-popover p-1 shadow-lg">
              {isLinked ? (
                <button onClick={(e) => { e.stopPropagation(); onUnlink(); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[14px] text-left text-foreground hover:bg-accent transition-colors cursor-pointer">
                  <Link2 className="h-3.5 w-3.5 text-destructive shrink-0" />
                  関連づけを解除する
                </button>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); onLink(); setShowMenu(false); }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[14px] text-left text-foreground hover:bg-accent transition-colors cursor-pointer whitespace-nowrap">
                  <Link2 className="h-3.5 w-3.5 text-brand shrink-0" />
                  このメッセージと関連づける
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* --- Message Bubble --- */

function MessageBubble({ message, channel, contactEmail, onPreviewImage, onDeleteMemo }: {
  message: Message; channel: Channel; contactEmail?: string;
  onPreviewImage: (url: string) => void;
  onDeleteMemo?: (messageId: string) => void;
}) {
  const { content, timestamp, isInbound, senderName, isInternal, emailHeader, attachments } = message;
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [showMemoMenu, setShowMemoMenu] = useState(false);
  const memoMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMemoMenu) return;
    const handler = (e: MouseEvent) => {
      if (memoMenuRef.current && !memoMenuRef.current.contains(e.target as Node)) {
        setShowMemoMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMemoMenu]);

  if (isInternal) {
    return (
      <div className="flex justify-center">
        <div className="group/memo relative min-w-[340px] max-w-md rounded-lg border border-amber-200/60 bg-amber-50/40 px-4 py-2.5">
          {/* Hover dots menu for delete */}
          <div className="absolute top-2 right-2" ref={memoMenuRef}>
            <button
              onClick={() => setShowMemoMenu(!showMemoMenu)}
              className="hidden group-hover/memo:flex h-6 w-6 items-center justify-center rounded text-amber-400 hover:bg-amber-100 cursor-pointer"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {showMemoMenu && (
              <div className="absolute right-0 top-7 z-[200] min-w-[140px] rounded-lg border bg-popover p-1 shadow-lg">
                <button onClick={() => { onDeleteMemo?.(message.id); setShowMemoMenu(false); }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[14px] text-destructive hover:bg-accent transition-colors cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" />
                  削除
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <MessageSquareText className="h-3 w-3 text-amber-500" />
            <span className="text-[12px] font-medium text-amber-600">チーム内メモ</span>
          </div>
          <p className="text-[14px] leading-relaxed text-amber-900/70">{renderMentions(content)}</p>
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
          <span className="text-[12px] font-medium text-muted-foreground">{senderName}</span>
          <span className="text-[12px] text-muted-foreground/50">{timestamp}</span>
        </div>

        {channel === "email" && emailHeader ? (
          <div className={cn(
            "overflow-hidden rounded-2xl border bg-background",
            isInbound ? "rounded-tl-sm" : "rounded-tr-sm"
          )}>
            <div className="border-b bg-accent/20 px-3 py-2">
              <button onClick={() => setHeaderExpanded(!headerExpanded)}
                className="flex w-full cursor-pointer items-center gap-2 text-[14px] text-left text-muted-foreground hover:text-foreground transition-colors">
                <Mail className="h-4 w-4 text-channel-email shrink-0" />
                <span className="font-medium">{emailHeader.subject}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", headerExpanded && "rotate-180")} />
              </button>
              {headerExpanded && (
                <div className="mt-2 space-y-1 text-[14px] text-muted-foreground">
                  {(contactEmail || senderName) && (
                    <div className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-right font-medium text-[13px]">From</span>
                      <span>{isInbound ? (contactEmail || senderName) : senderName}</span>
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
            {/* Attachments in email */}
            {attachments && attachments.length > 0 && (
              <div className="border-t px-3.5 py-2">
                <AttachmentList attachments={attachments} onPreviewImage={onPreviewImage} />
              </div>
            )}
          </div>
        ) : content.trim().startsWith("[スタンプ:") ? (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-channel-line/10 border border-channel-line/20">
            <span className="text-[14px] font-medium text-channel-line">{content.replace(/^\[スタンプ:\s*/, "").replace(/\]$/, "")}</span>
          </div>
        ) : (
          <div>
            <div className={cn(
              "rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed",
              isInbound ? "rounded-tl-sm bg-secondary text-secondary-foreground" : "rounded-tr-sm bg-brand text-brand-foreground"
            )}>
              {content.split("\n").map((line, i) => (
                <span key={i}>{line}{i < content.split("\n").length - 1 && <br />}</span>
              ))}
            </div>
            {/* Attachments in non-email */}
            {attachments && attachments.length > 0 && (
              <div className="mt-1.5">
                <AttachmentList attachments={attachments} onPreviewImage={onPreviewImage} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* --- Attachment List --- */

function AttachmentList({ attachments, onPreviewImage }: {
  attachments: Attachment[];
  onPreviewImage: (url: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {attachments.map((att) => {
        if (att.type === "image") {
          return (
            <button key={att.id}
              onClick={() => onPreviewImage(att.url)}
              className="block cursor-pointer rounded-lg overflow-hidden border hover:opacity-90 transition-opacity">
              <img src={att.url} alt={att.name} className="max-w-[200px] max-h-[150px] object-cover" />
              <div className="flex items-center gap-1.5 px-2 py-1 bg-accent/30">
                <ImageIcon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground truncate">{att.name}</span>
                {att.size && <span className="text-[11px] text-muted-foreground/60 shrink-0">{att.size}</span>}
              </div>
            </button>
          );
        }
        return (
          <a key={att.id} href={att.url} download={att.name}
            className="flex items-center gap-2.5 rounded-lg border px-3 py-2 hover:bg-accent/30 transition-colors">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{att.name}</p>
              {att.size && <p className="text-[11px] text-muted-foreground">{att.size}</p>}
            </div>
            <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </a>
        );
      })}
    </div>
  );
}

/* --- Reply Header --- */

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
      <button onClick={isEmail ? () => setExpanded(!expanded) : undefined}
        className={cn(
          "flex items-center gap-2 text-[14px] text-muted-foreground w-full text-left",
          isEmail && "cursor-pointer hover:text-foreground transition-colors"
        )}>
        <CIcon className={cn("h-4 w-4 shrink-0", cStyle.text)} />
        <span className="font-medium">{channelLabel} {accountName} として返信</span>
        {isEmail && <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />}
      </button>
      {isEmail && expanded && (
        <div className="mt-2 space-y-1 text-[14px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right font-medium text-[13px]">From</span>
            <span className="flex-1 rounded-md bg-accent/40 px-2 py-0.5 text-[14px] text-muted-foreground">{emailFrom}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right font-medium text-[13px]">To</span>
            <span className="flex-1 rounded-md bg-accent/40 px-2 py-0.5 text-[14px] text-muted-foreground">{emailTo}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right font-medium text-[13px]">CC</span>
            <input value={emailCc} onChange={(e) => setEmailCc(e.target.value)} placeholder="任意"
              className="flex-1 rounded-md bg-transparent px-2 py-0.5 outline-none text-[14px] border border-transparent hover:border-border focus:border-brand/30 transition-colors placeholder:text-muted-foreground/30" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right font-medium text-[13px]">BCC</span>
            <input value={emailBcc} onChange={(e) => setEmailBcc(e.target.value)} placeholder="任意"
              className="flex-1 rounded-md bg-transparent px-2 py-0.5 outline-none text-[14px] border border-transparent hover:border-border focus:border-brand/30 transition-colors placeholder:text-muted-foreground/30" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right font-medium text-[13px]">件名</span>
            <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
              className="flex-1 rounded-md bg-transparent px-2 py-0.5 outline-none text-[14px] border border-transparent hover:border-border focus:border-brand/30 transition-colors" />
          </div>
        </div>
      )}
    </div>
  );
}
