"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { contacts, conversations, contactGroups } from "@/data/mock";
import type { Channel, Contact, ContactGroup } from "@/data/types";
import { Button } from "@/components/ui/button";
import {
  Search,
  Instagram,
  MessageCircle,
  Mail,
  Facebook,
  Phone,
  AtSign,
  Users,
  Plus,
  SlidersHorizontal,
  FolderOpen,
  Pencil,
  ChevronRight,
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

export default function ContactsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("grp-all");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);

  const selectedGroup = contactGroups.find((g) => g.id === selectedGroupId) ?? contactGroups[0];

  const groupContacts = useMemo(() => {
    if (selectedGroupId === "grp-all") return contacts;
    const group = contactGroups.find((g) => g.id === selectedGroupId);
    if (!group) return contacts;
    return contacts.filter((c) => group.contactIds.includes(c.id));
  }, [selectedGroupId]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return groupContacts;
    const q = searchQuery.toLowerCase();
    return groupContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
    );
  }, [searchQuery, groupContacts]);

  const selected = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) ?? null,
    [selectedContactId]
  );

  return (
    <div className="flex h-full">
      {/* Layer 2: Groups (220px) */}
      <div className="flex h-full w-[220px] shrink-0 flex-col border-r bg-background">
        <div className="shrink-0 px-3 pt-4 pb-2">
          <div className="mb-2 flex items-center justify-between px-2">
            <h2 className="text-[13px] font-semibold">グループ</h2>
            <button className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2">
          <div className="space-y-0.5">
            {contactGroups.map((group) => {
              const isActive = selectedGroupId === group.id;
              const memberCount = group.id === "grp-all"
                ? contacts.length
                : group.contactIds.length;

              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setSelectedContactId(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors cursor-pointer group",
                    isActive
                      ? "bg-brand/10 text-brand"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <FolderOpen
                    className={cn(
                      "h-[16px] w-[16px] shrink-0",
                      isActive ? "text-brand" : ""
                    )}
                  />
                  <span className="flex-1 truncate text-left">{group.name}</span>
                  <span className={cn(
                    "text-[11px] tabular-nums",
                    isActive ? "text-brand/70" : "text-muted-foreground/60"
                  )}>
                    {memberCount}
                  </span>
                  {group.id !== "grp-all" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingGroup(group.id);
                      }}
                      className="hidden cursor-pointer rounded p-0.5 text-muted-foreground/50 hover:text-foreground group-hover:block"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Layer 3: Contact list (280px) */}
      <div className="flex h-full w-[280px] shrink-0 flex-col border-r bg-background">
        <div className="shrink-0 px-3 pt-3 pb-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-[12px] font-semibold text-muted-foreground">
              {selectedGroup.name}
            </h3>
            <Button size="sm" className="h-6 gap-1 bg-brand hover:bg-brand/90 text-[10px] px-2">
              <Plus className="h-3 w-3" />
              顧客追加
            </Button>
          </div>
          <div className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="名前、メールで検索"
              className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground/50"
            />
            <button className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((contact) => (
            <button
              key={contact.id}
              onClick={() => setSelectedContactId(contact.id)}
              className={cn(
                "flex w-full items-center gap-2.5 border-b px-4 py-3 text-left transition-colors cursor-pointer",
                selectedContactId === contact.id
                  ? "bg-brand/8"
                  : "hover:bg-accent/40"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-[13px] font-medium">
                    {contact.name}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1">
                  {contact.channels.map((ch) => {
                    const Icon = channelIcons[ch.channel];
                    const s = channelStyles[ch.channel];
                    return (
                      <div
                        key={ch.channel}
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded",
                          s.bg
                        )}
                      >
                        <Icon className={cn("h-3 w-3", s.text)} />
                      </div>
                    );
                  })}
                  {contact.email && (
                    <span className="ml-1 truncate text-[10px] text-muted-foreground">
                      {contact.email}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected ? (
        <ContactDetail contact={selected} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Users className="mx-auto mb-3 h-10 w-10 opacity-20" />
            <p className="text-[13px]">顧客を選択してください</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactDetail({ contact }: { contact: Contact }) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const contactConversations = conversations.filter((c) =>
    contact.conversationIds.includes(c.id)
  );

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-xl px-8 py-8">
        {/* Profile */}
        <div className="mb-6">
          <h2 className="text-[18px] font-semibold">{contact.name}</h2>
        </div>

        {/* Contact info */}
        <div className="space-y-4">
          <section>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              連絡先情報
            </h3>
            <div className="space-y-2">
              {contact.email && (
                <div className="flex items-center gap-2.5 text-[13px]">
                  <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                  {contact.email}
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2.5 text-[13px]">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {contact.phone}
                </div>
              )}
            </div>
          </section>

          {/* Channels */}
          <section>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              チャネル
            </h3>
            <div className="space-y-1.5">
              {contact.channels.map((ch) => {
                const Icon = channelIcons[ch.channel];
                const s = channelStyles[ch.channel];
                return (
                  <div
                    key={ch.channel}
                    className="flex items-center gap-2.5 rounded-md border px-3 py-2"
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md",
                        s.bg
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5", s.text)} />
                    </div>
                    <span className="text-[13px]">{ch.handle}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Conversation history */}
          <section>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              会話履歴
            </h3>
            {contactConversations.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                会話はありません
              </p>
            ) : (
              <div className="space-y-1.5">
                {contactConversations.map((conv) => {
                  const Icon = channelIcons[conv.channel];
                  const s = channelStyles[conv.channel];
                  return (
                    <div
                      key={conv.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2.5"
                    >
                      <div
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                          s.bg
                        )}
                      >
                        <Icon className={cn("h-3 w-3", s.text)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium">
                          {conv.subject || conv.lastMessage}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {conv.lastMessageAt}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-px text-[9px] font-medium",
                          "bg-foreground/6 text-foreground/50"
                        )}
                      >
                        {conv.status === "open"
                          ? "未対応"
                          : conv.status === "pending"
                            ? "保留中"
                            : "完了"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Notes - display first, then add on click */}
          <section>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              メモ
            </h3>
            {contact.note ? (
              <p className="text-[13px] leading-relaxed text-foreground/80">
                {contact.note}
              </p>
            ) : !showNoteInput ? (
              <button
                onClick={() => setShowNoteInput(true)}
                className="cursor-pointer rounded-md border border-dashed px-3 py-2 text-[12px] text-muted-foreground hover:border-brand/30 hover:text-brand transition-colors w-full text-left"
              >
                + メモを追加
              </button>
            ) : (
              <textarea
                autoFocus
                placeholder="この顧客についてのメモを追加..."
                rows={3}
                className="w-full resize-none rounded-md border bg-background px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/50 focus:border-brand/30"
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
