"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { contacts as initialContacts, conversations, contactGroups as initialGroups } from "@/data/mock";
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
  X,
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
  const [contacts, setContacts] = useState(initialContacts);
  const [groups, setGroups] = useState(initialGroups);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("grp-all");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [filterChannel, setFilterChannel] = useState<Channel | "">("");

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? groups[0];

  const groupContacts = useMemo(() => {
    if (selectedGroupId === "grp-all") return contacts;
    const group = groups.find((g) => g.id === selectedGroupId);
    if (!group) return contacts;
    return contacts.filter((c) => group.contactIds.includes(c.id));
  }, [selectedGroupId, contacts, groups]);

  const filtered = useMemo(() => {
    let list = groupContacts;
    if (filterChannel) {
      list = list.filter((c) => c.channels.some((ch) => ch.channel === filterChannel));
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
    );
  }, [searchQuery, groupContacts, filterChannel]);

  const selected = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) ?? null,
    [selectedContactId, contacts]
  );

  const handleAddContact = (name: string, email: string) => {
    const newId = `ct${Date.now()}`;
    const newContact: Contact = {
      id: newId,
      name,
      email: email || undefined,
      channels: email ? [{ channel: "email", handle: email }] : [],
      conversationIds: [],
      createdAt: new Date().toISOString().split("T")[0],
    };
    setContacts((prev) => [...prev, newContact]);
    if (selectedGroupId !== "grp-all") {
      setGroups((prev) =>
        prev.map((g) =>
          g.id === selectedGroupId
            ? { ...g, contactIds: [...g.contactIds, newId] }
            : g
        )
      );
    }
    setGroups((prev) =>
      prev.map((g) =>
        g.id === "grp-all"
          ? { ...g, contactIds: [...g.contactIds, newId] }
          : g
      )
    );
    setShowAddContact(false);
    setSelectedContactId(newId);
  };

  const handleAddGroup = (name: string) => {
    const newGroup: ContactGroup = {
      id: `grp-${Date.now()}`,
      name,
      contactIds: [],
    };
    setGroups((prev) => [...prev, newGroup]);
    setShowAddGroup(false);
    setSelectedGroupId(newGroup.id);
  };

  const handleUpdateGroup = (id: string, name: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, name } : g))
    );
    setEditingGroupId(null);
  };

  return (
    <div className="flex h-full">
      {/* Layer 2: Groups (220px) */}
      <div className="flex h-full w-[220px] shrink-0 flex-col border-r bg-background">
        <div className="shrink-0 px-3 pt-4 pb-2">
          <div className="mb-2 flex items-center justify-between px-2">
            <h2 className="text-[13px] font-semibold">グループ</h2>
            <button
              onClick={() => setShowAddGroup(true)}
              className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2">
          <div className="space-y-0.5">
            {groups.map((group) => {
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
                    setEditingGroupId(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <FolderOpen className="h-[16px] w-[16px] shrink-0" />
                  <span className="flex-1 truncate text-left">{group.name}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground/60">
                    {memberCount}
                  </span>
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
            <div className="flex items-center gap-2">
              <h3 className="text-[12px] font-semibold text-muted-foreground">
                {selectedGroup.name}
              </h3>
              {selectedGroupId !== "grp-all" && (
                <button
                  onClick={() => setEditingGroupId(selectedGroupId)}
                  className="cursor-pointer rounded p-0.5 text-muted-foreground/50 hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
            <Button
              size="sm"
              className="h-6 gap-1 bg-brand hover:bg-brand/90 text-[10px] px-2"
              onClick={() => setShowAddContact(true)}
            >
              <Plus className="h-3 w-3" />
              顧客追加
            </Button>
          </div>

          {/* Edit group inline */}
          {editingGroupId && (
            <EditGroupInline
              group={groups.find((g) => g.id === editingGroupId)!}
              onSave={handleUpdateGroup}
              onCancel={() => setEditingGroupId(null)}
            />
          )}

          <div className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="名前、メールで検索"
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

          {showFilter && (
            <div className="mt-2 rounded-md border p-2.5">
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
              {filterChannel && (
                <button
                  onClick={() => setFilterChannel("")}
                  className="mt-1 cursor-pointer text-[10px] text-brand hover:underline"
                >
                  クリア
                </button>
              )}
            </div>
          )}
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
        <ContactDetail
          contact={selected}
          groups={groups}
          onUpdateContact={(updated) => {
            setContacts((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            );
          }}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Users className="mx-auto mb-3 h-10 w-10 opacity-20" />
            <p className="text-[13px]">顧客を選択してください</p>
          </div>
        </div>
      )}

      {/* Add contact modal */}
      {showAddContact && (
        <AddContactModal
          onAdd={handleAddContact}
          onClose={() => setShowAddContact(false)}
        />
      )}

      {/* Add group modal */}
      {showAddGroup && (
        <AddGroupModal
          onAdd={handleAddGroup}
          onClose={() => setShowAddGroup(false)}
        />
      )}
    </div>
  );
}

/* ─── Edit Group Inline ──────────────────── */

function EditGroupInline({
  group,
  onSave,
  onCancel,
}: {
  group: ContactGroup;
  onSave: (id: string, name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(group.name);

  return (
    <div className="mb-2 flex items-center gap-1.5 rounded-md border bg-accent/30 px-2 py-1.5">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 bg-transparent text-[12px] outline-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) onSave(group.id, name.trim());
          if (e.key === "Escape") onCancel();
        }}
      />
      <button
        onClick={() => name.trim() && onSave(group.id, name.trim())}
        className="cursor-pointer rounded bg-brand px-2 py-0.5 text-[10px] font-medium text-white"
      >
        保存
      </button>
      <button
        onClick={onCancel}
        className="cursor-pointer text-[10px] text-muted-foreground hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/* ─── Contact Detail ─────────────────────── */

function ContactDetail({
  contact,
  groups,
  onUpdateContact,
}: {
  contact: Contact;
  groups: ContactGroup[];
  onUpdateContact: (updated: Contact) => void;
}) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteValue, setNoteValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(contact.name);
  const [editEmail, setEditEmail] = useState(contact.email ?? "");
  const [editPhone, setEditPhone] = useState(contact.phone ?? "");
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const contactConversations = conversations.filter((c) =>
    contact.conversationIds.includes(c.id)
  );

  const memberGroups = groups.filter(
    (g) => g.id !== "grp-all" && g.contactIds.includes(contact.id)
  );

  // Close note on outside click
  useEffect(() => {
    if (!showNoteInput) return;
    function handleClickOutside(e: MouseEvent) {
      if (noteRef.current && !noteRef.current.contains(e.target as Node)) {
        if (!noteValue.trim()) {
          setShowNoteInput(false);
        } else {
          onUpdateContact({ ...contact, note: noteValue });
          setShowNoteInput(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNoteInput, noteValue, contact, onUpdateContact]);

  const handleSaveEdit = () => {
    onUpdateContact({
      ...contact,
      name: editName,
      email: editEmail || undefined,
      phone: editPhone || undefined,
    });
    setIsEditing(false);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-xl px-8 py-8">
        {/* Profile */}
        <div className="mb-6 flex items-center justify-between">
          {isEditing ? (
            <div className="flex-1 space-y-2">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full text-[18px] font-semibold outline-none border-b border-brand/30 pb-1"
              />
              <input
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="メールアドレス"
                className="w-full text-[13px] outline-none border-b border-border pb-1"
              />
              <input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="電話番号"
                className="w-full text-[13px] outline-none border-b border-border pb-1"
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-6 text-[10px] bg-brand hover:bg-brand/90" onClick={handleSaveEdit}>
                  保存
                </Button>
                <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setIsEditing(false)}>
                  キャンセル
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-[18px] font-semibold">{contact.name}</h2>
              <button
                onClick={() => {
                  setEditName(contact.name);
                  setEditEmail(contact.email ?? "");
                  setEditPhone(contact.phone ?? "");
                  setIsEditing(true);
                }}
                className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </>
          )}
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

          {/* Groups */}
          <section>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              所属グループ
            </h3>
            {memberGroups.length === 0 ? (
              <p className="text-[12px] text-muted-foreground/60">
                所属グループなし
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {memberGroups.map((g) => (
                  <span
                    key={g.id}
                    className="rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-medium text-foreground/70"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            )}
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
                  const acc = conv.accountId === "acc-email"
                    ? "info@myshop.jp"
                    : conv.accountId === "acc-line"
                      ? "@myshop_official"
                      : "@myshop.style";
                  return (
                    <div
                      key={conv.id}
                      className="flex items-start gap-3 rounded-md border px-3 py-2.5"
                    >
                      <div
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5",
                          s.bg
                        )}
                      >
                        <Icon className={cn("h-3 w-3", s.text)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium">
                          {conv.subject || conv.lastMessage}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">
                          To: {acc}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          2026-03-01 14:32
                        </p>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-px text-[9px] font-medium shrink-0",
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

          {/* Notes */}
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
                onClick={() => {
                  setShowNoteInput(true);
                  setNoteValue("");
                }}
                className="cursor-pointer rounded-md border border-dashed px-3 py-2 text-[12px] text-muted-foreground hover:border-brand/30 hover:text-brand transition-colors w-full text-left"
              >
                + メモを追加
              </button>
            ) : (
              <div>
                <textarea
                  ref={noteRef}
                  autoFocus
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  placeholder="この顧客についてのメモを追加..."
                  rows={3}
                  className="w-full resize-none rounded-md border bg-background px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/50 focus:border-brand/30"
                />
                <div className="mt-1 flex justify-end gap-1.5">
                  <button
                    onClick={() => {
                      setShowNoteInput(false);
                      setNoteValue("");
                    }}
                    className="cursor-pointer rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => {
                      if (noteValue.trim()) {
                        onUpdateContact({ ...contact, note: noteValue });
                      }
                      setShowNoteInput(false);
                    }}
                    className="cursor-pointer rounded bg-brand px-2 py-0.5 text-[10px] font-medium text-white"
                  >
                    保存
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ─── Modals ─────────────────────────────── */

function AddContactModal({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, email: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[380px] rounded-xl bg-background p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">顧客を追加</h2>
          <button onClick={onClose} className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-medium text-muted-foreground">名前 *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-medium text-muted-foreground">メールアドレス</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand/40"
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="cursor-pointer rounded-lg border px-4 py-2 text-[13px] font-medium hover:bg-accent">
            キャンセル
          </button>
          <button
            onClick={() => name.trim() && onAdd(name.trim(), email.trim())}
            disabled={!name.trim()}
            className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}

function AddGroupModal({
  onAdd,
  onClose,
}: {
  onAdd: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[380px] rounded-xl bg-background p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">グループを追加</h2>
          <button onClick={onClose} className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-medium text-muted-foreground">グループ名 *</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-[13px] outline-none focus:border-brand/40"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) onAdd(name.trim());
            }}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="cursor-pointer rounded-lg border px-4 py-2 text-[13px] font-medium hover:bg-accent">
            キャンセル
          </button>
          <button
            onClick={() => name.trim() && onAdd(name.trim())}
            disabled={!name.trim()}
            className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand/90 disabled:opacity-50"
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
