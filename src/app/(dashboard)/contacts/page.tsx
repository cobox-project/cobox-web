"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  contacts as initialContacts,
  conversations,
  contactGroups as initialGroups,
} from "@/data/mock";
import type { Channel, Contact, ContactGroup } from "@/data/types";
import { Button } from "@/components/ui/button";
import {
  Search,
  Instagram,
  MessageCircle,
  Mail,
  Facebook,
  Plus,
  FolderOpen,
  X,
  Trash2,
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
  const router = useRouter();
  const [contacts, setContacts] = useState(initialContacts);
  const [groups, setGroups] = useState(initialGroups);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const groupContacts = useMemo(() => {
    if (!selectedGroupId) return contacts;
    const group = groups.find((g) => g.id === selectedGroupId);
    if (!group) return contacts;
    return contacts.filter((c) => group.contactIds.includes(c.id));
  }, [selectedGroupId, contacts, groups]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return groupContacts;
    const q = searchQuery.toLowerCase();
    return groupContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.company?.toLowerCase().includes(q)
    );
  }, [searchQuery, groupContacts]);

  const selected = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) ?? null,
    [selectedContactId, contacts]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const idx = filtered.findIndex((c) => c.id === selectedContactId);
        if (e.key === "ArrowDown" && idx < filtered.length - 1) {
          setSelectedContactId(filtered[idx + 1].id);
          setIsEditing(false);
        } else if (e.key === "ArrowUp" && idx > 0) {
          setSelectedContactId(filtered[idx - 1].id);
          setIsEditing(false);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selectedContactId]);

  const handleAddContact = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm("未保存の変更があります。破棄しますか？")) return;
    }
    const newId = `ct${Date.now()}`;
    const newContact: Contact = {
      id: newId,
      name: "",
      channels: [],
      conversationIds: [],
      createdAt: new Date().toISOString().split("T")[0],
      isManuallyCreated: true,
    };
    setContacts((prev) => [...prev, newContact]);
    setSelectedContactId(newId);
    setIsEditing(true);
    setHasUnsavedChanges(false);
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

  const handleUpdateGroupName = (id: string, name: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === id ? { ...g, name } : g))
    );
  };

  const handleDeleteContact = (contactId: string) => {
    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;
    if (contact.conversationIds.length > 0) {
      if (!window.confirm("この連絡先にはメッセージ履歴があります。本当に削除しますか？")) return;
    }
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    if (selectedContactId === contactId) {
      setSelectedContactId(null);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Layer 2: Group navigation (220px) */}
      <div className="flex h-full w-[220px] shrink-0 flex-col border-r bg-background">
        <div className="shrink-0 px-3 pt-4 pb-2">
          <h2 className="px-2 text-[15px] font-semibold text-foreground">連絡先</h2>
        </div>

        <nav className="flex-1 overflow-y-auto px-2">
          <button
            onClick={() => {
              setSelectedGroupId(null);
              setSelectedContactId(null);
              setIsEditing(false);
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[8px] text-[15px] font-medium transition-colors cursor-pointer",
              selectedGroupId === null
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <FolderOpen className="h-[16px] w-[16px] shrink-0" />
            <span className="flex-1 truncate text-left">すべての連絡先</span>
            <span className="text-[12px] tabular-nums text-muted-foreground/60">
              {contacts.length}
            </span>
          </button>

          <div className="mt-5">
            <div className="mb-1 flex items-center justify-between px-2">
              <h3 className="text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
                グループ
              </h3>
              <button
                onClick={() => setShowAddGroup(true)}
                className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {groups.map((group) => (
                <GroupItem
                  key={group.id}
                  group={group}
                  isActive={selectedGroupId === group.id}
                  onClick={() => {
                    setSelectedGroupId(group.id);
                    setSelectedContactId(null);
                    setIsEditing(false);
                  }}
                  onRename={(name) => handleUpdateGroupName(group.id, name)}
                />
              ))}
            </div>
          </div>
        </nav>
      </div>

      {/* Layer 3: Contact list (280px) */}
      <div className="flex h-full w-[280px] shrink-0 flex-col border-r bg-background">
        <div className="shrink-0 px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="連絡先を検索..."
              className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          {selectedGroupId === null && (
            <button
              onClick={handleAddContact}
              className="mt-2 w-full rounded-xl border border-border/60 bg-accent/30 px-3 py-2.5 text-[14px] text-muted-foreground hover:bg-accent/60 transition-colors cursor-pointer text-center"
            >
              連絡先を追加する
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((contact) => (
            <button
              key={contact.id}
              onClick={() => {
                if (hasUnsavedChanges) {
                  if (!window.confirm("未保存の変更があります。破棄しますか？")) return;
                }
                setSelectedContactId(contact.id);
                setIsEditing(false);
                setHasUnsavedChanges(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 border-b px-4 py-3 text-left transition-colors cursor-pointer",
                selectedContactId === contact.id
                  ? "bg-brand/8"
                  : "hover:bg-accent/40"
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-medium">
                    {contact.name || "（新規連絡先）"}
                  </span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {contact.channels.map((ch) => {
                      const Icon = channelIcons[ch.channel];
                      const s = channelStyles[ch.channel];
                      return (
                        <div
                          key={ch.channel + ch.handle}
                          className={cn("flex h-5 w-5 items-center justify-center rounded", s.bg)}
                        >
                          <Icon className={cn("h-3 w-3", s.text)} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected ? (
        <ContactDetail
          key={selected.id + (isEditing ? "-edit" : "")}
          contact={selected}
          groups={groups}
          isEditing={isEditing}
          onStartEdit={() => setIsEditing(true)}
          onCancelEdit={() => {
            setIsEditing(false);
            setHasUnsavedChanges(false);
            // If it's a new empty contact, remove it
            if (selected.isManuallyCreated && !selected.name) {
              setContacts((prev) => prev.filter((c) => c.id !== selected.id));
              setSelectedContactId(null);
            }
          }}
          onUpdateContact={(updated) => {
            setContacts((prev) =>
              prev.map((c) => (c.id === updated.id ? updated : c))
            );
            setIsEditing(false);
            setHasUnsavedChanges(false);
          }}
          onUnsavedChange={() => setHasUnsavedChanges(true)}
          onUpdateGroups={(updatedGroups) => setGroups(updatedGroups)}
          onDelete={() => {
            if (selected.isManuallyCreated) {
              handleDeleteContact(selected.id);
            }
          }}
          onNavigateToThread={(convId) => {
            router.push(`/messages?thread=${convId}`);
          }}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Search className="mx-auto mb-3 h-10 w-10 opacity-20" />
            <p className="text-[15px]">連絡先を選択してください</p>
          </div>
        </div>
      )}

      {showAddGroup && (
        <AddGroupModal onAdd={handleAddGroup} onClose={() => setShowAddGroup(false)} />
      )}
    </div>
  );
}

/* ─── Group Item ─────────────────────────── */
function GroupItem({
  group,
  isActive,
  onClick,
  onRename,
}: {
  group: ContactGroup;
  isActive: boolean;
  onClick: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <div className="px-2.5 py-[6px]">
        <input
          ref={inputRef}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={() => {
            if (editName.trim()) onRename(editName.trim());
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && editName.trim()) {
              onRename(editName.trim());
              setEditing(false);
            }
            if (e.key === "Escape") {
              setEditName(group.name);
              setEditing(false);
            }
          }}
          className="w-full rounded-md border px-2 py-1 text-[14px] outline-none focus:border-brand/40"
        />
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      onDoubleClick={() => {
        setEditName(group.name);
        setEditing(true);
      }}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-[8px] text-[15px] font-medium transition-colors cursor-pointer",
        isActive
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
      title="ダブルクリックで名前を変更"
    >
      <FolderOpen className="h-[16px] w-[16px] shrink-0" />
      <span className="flex-1 truncate text-left">{group.name}</span>
      <span className="text-[12px] tabular-nums text-muted-foreground/60">
        {group.contactIds.length}
      </span>
    </button>
  );
}

/* ─── Contact Detail ─────────────────────── */
function ContactDetail({
  contact,
  groups,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onUpdateContact,
  onUnsavedChange,
  onUpdateGroups,
  onDelete,
  onNavigateToThread,
}: {
  contact: Contact;
  groups: ContactGroup[];
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onUpdateContact: (updated: Contact) => void;
  onUnsavedChange: () => void;
  onUpdateGroups: (groups: ContactGroup[]) => void;
  onDelete: () => void;
  onNavigateToThread: (convId: string) => void;
}) {
  const [editName, setEditName] = useState(contact.name);
  const [editNameFurigana, setEditNameFurigana] = useState(contact.nameFurigana ?? "");
  const [editCompany, setEditCompany] = useState(contact.company ?? "");
  const [editCompanyFurigana, setEditCompanyFurigana] = useState(contact.companyFurigana ?? "");
  const [editPhone, setEditPhone] = useState(contact.phone ?? "");
  const [editEmail, setEditEmail] = useState(contact.email ?? "");
  const [editNote, setEditNote] = useState(contact.note ?? "");
  const [editChannels, setEditChannels] = useState(contact.channels);
  const [editGroupIds, setEditGroupIds] = useState<string[]>(
    groups.filter((g) => g.contactIds.includes(contact.id)).map((g) => g.id)
  );

  const contactConversations = conversations.filter((c) =>
    contact.conversationIds.includes(c.id)
  );
  const memberGroups = groups.filter((g) => g.contactIds.includes(contact.id));

  const handleSave = () => {
    const updated: Contact = {
      ...contact,
      name: editName,
      nameFurigana: editNameFurigana || undefined,
      company: editCompany || undefined,
      companyFurigana: editCompanyFurigana || undefined,
      phone: editPhone || undefined,
      email: editEmail || undefined,
      note: editNote || undefined,
      channels: editChannels,
    };
    onUpdateContact(updated);
    const updatedGroups = groups.map((g) => {
      const shouldContain = editGroupIds.includes(g.id);
      const contains = g.contactIds.includes(contact.id);
      if (shouldContain && !contains) return { ...g, contactIds: [...g.contactIds, contact.id] };
      if (!shouldContain && contains) return { ...g, contactIds: g.contactIds.filter((id) => id !== contact.id) };
      return g;
    });
    onUpdateGroups(updatedGroups);
  };

  const markChanged = () => onUnsavedChange();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-xl px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-[19px] font-semibold">
            {isEditing ? "連絡先を編集" : (contact.name || "（新規連絡先）")}
          </h2>
          {!isEditing && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-9 text-[14px] px-4" onClick={onStartEdit}>
                編集
              </Button>
              {contact.isManuallyCreated && (
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="mb-4 text-[12px] text-muted-foreground">ID: {contact.id}</div>

        {isEditing ? (
          <div className="space-y-8">
            <section>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[13px] text-muted-foreground">氏名</label>
                  <input value={editName} onChange={(e) => { setEditName(e.target.value); markChanged(); }}
                    className="w-full rounded-md border px-3 py-2.5 text-[15px] outline-none focus:border-brand/40" autoFocus />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] text-muted-foreground">氏名フリガナ</label>
                  <input value={editNameFurigana} onChange={(e) => { setEditNameFurigana(e.target.value); markChanged(); }}
                    className="w-full rounded-md border px-3 py-2.5 text-[15px] outline-none focus:border-brand/40" placeholder="ヤマダ タロウ" />
                </div>
              </div>
            </section>

            <section>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[13px] text-muted-foreground">会社名</label>
                  <input value={editCompany} onChange={(e) => { setEditCompany(e.target.value); markChanged(); }}
                    className="w-full rounded-md border px-3 py-2.5 text-[15px] outline-none focus:border-brand/40" />
                </div>
                <div>
                  <label className="mb-1 block text-[13px] text-muted-foreground">会社名フリガナ</label>
                  <input value={editCompanyFurigana} onChange={(e) => { setEditCompanyFurigana(e.target.value); markChanged(); }}
                    className="w-full rounded-md border px-3 py-2.5 text-[15px] outline-none focus:border-brand/40" />
                </div>
              </div>
            </section>

            <section>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[13px] text-muted-foreground">電話番号</label>
                  <input value={editPhone} onChange={(e) => { setEditPhone(e.target.value); markChanged(); }}
                    className="w-full rounded-md border px-3 py-2.5 text-[15px] outline-none focus:border-brand/40" />
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-2 text-[13px] text-muted-foreground">
                    メールアドレス
                    {editChannels.some((ch) => ch.channel === "email" && ch.isAutoLinked) && (
                      <span className="text-[11px] text-brand bg-brand/10 px-1.5 py-0.5 rounded">自動連携</span>
                    )}
                  </label>
                  <input value={editEmail} onChange={(e) => { setEditEmail(e.target.value); markChanged(); }}
                    disabled={editChannels.some((ch) => ch.channel === "email" && ch.isAutoLinked)}
                    className="w-full rounded-md border px-3 py-2.5 text-[15px] outline-none focus:border-brand/40 disabled:bg-accent/30 disabled:text-muted-foreground" />
                </div>
                {(["instagram", "line", "facebook"] as Channel[]).map((channel) => {
                  const existing = editChannels.find((ch) => ch.channel === channel);
                  const Icon = channelIcons[channel];
                  const isAutoLinked = existing?.isAutoLinked;
                  return (
                    <div key={channel}>
                      <label className="mb-1 flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                        {channel === "instagram" ? "Instagram" : channel === "line" ? "LINE" : "Facebook"}
                        {isAutoLinked && <span className="text-[11px] text-brand bg-brand/10 px-1.5 py-0.5 rounded">自動連携</span>}
                      </label>
                      <input
                        value={existing?.handle ?? ""}
                        onChange={(e) => {
                          markChanged();
                          if (existing) {
                            setEditChannels((prev) => prev.map((ch) => ch.channel === channel ? { ...ch, handle: e.target.value } : ch));
                          } else if (e.target.value) {
                            setEditChannels((prev) => [...prev, { channel, handle: e.target.value }]);
                          }
                        }}
                        disabled={!!isAutoLinked}
                        className="w-full rounded-md border px-3 py-2.5 text-[15px] outline-none focus:border-brand/40 disabled:bg-accent/30 disabled:text-muted-foreground"
                        placeholder={isAutoLinked ? "" : "@handle"}
                      />
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="space-y-2">
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" checked={editGroupIds.includes(g.id)}
                      onChange={(e) => {
                        markChanged();
                        setEditGroupIds((prev) => e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id));
                      }}
                      className="h-4 w-4 rounded accent-brand" />
                    <span className="text-[15px]">{g.name}</span>
                  </label>
                ))}
              </div>
            </section>

            <section>
              <textarea value={editNote} onChange={(e) => { setEditNote(e.target.value); markChanged(); }}
                placeholder="メモを入力..." rows={4}
                className="w-full resize-none rounded-md border px-3 py-2.5 text-[15px] outline-none focus:border-brand/40 placeholder:text-muted-foreground/50" />
            </section>

            <div className="pt-4 pb-8 flex gap-3">
              <Button variant="outline" className="flex-1 h-12 text-[16px] font-medium" onClick={onCancelEdit}>
                キャンセル
              </Button>
              <Button className="flex-1 h-12 bg-brand hover:bg-brand/90 text-[16px] font-medium" onClick={handleSave}>
                保存
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <p className="text-[16px] font-medium">{contact.name}</p>
              {contact.nameFurigana && <p className="text-[13px] text-muted-foreground">{contact.nameFurigana}</p>}
            </section>

            <section>
              {contact.company ? (
                <>
                  <p className="text-[16px] font-medium">{contact.company}</p>
                  {contact.companyFurigana && <p className="text-[13px] text-muted-foreground">{contact.companyFurigana}</p>}
                </>
              ) : (
                <p className="text-[14px] text-muted-foreground/60">なし</p>
              )}
            </section>

            <section>
              <div className="space-y-2">
                {contact.phone && (
                  <div className="flex items-center gap-2.5 text-[15px]">
                    <span className="text-muted-foreground text-[13px] w-24 shrink-0">電話番号</span>
                    <span>{contact.phone}</span>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-2.5 text-[15px]">
                    <span className="text-muted-foreground text-[13px] w-24 shrink-0">メール</span>
                    <span className={cn(contact.channels.some((ch) => ch.channel === "email" && ch.isAutoLinked) ? "border-b border-dashed border-brand/30" : "")}>
                      {contact.email}
                    </span>
                    {contact.channels.some((ch) => ch.channel === "email" && ch.isAutoLinked) && (
                      <span className="text-[11px] text-brand bg-brand/10 px-1.5 py-0.5 rounded">自動連携</span>
                    )}
                  </div>
                )}
                {contact.channels.filter((ch) => ch.channel !== "email").map((ch) => {
                  const Icon = channelIcons[ch.channel];
                  const s = channelStyles[ch.channel];
                  return (
                    <div key={ch.channel + ch.handle} className="flex items-center gap-2.5 text-[15px]">
                      <span className="text-muted-foreground text-[13px] w-24 shrink-0 flex items-center gap-1">
                        <Icon className={cn("h-3.5 w-3.5", s.text)} />
                        {ch.channel === "instagram" ? "Instagram" : ch.channel === "line" ? "LINE" : "Facebook"}
                      </span>
                      <span className={cn(ch.isAutoLinked ? "border-b border-dashed border-brand/30" : "")}>{ch.handle}</span>
                      {ch.isAutoLinked && <span className="text-[11px] text-brand bg-brand/10 px-1.5 py-0.5 rounded">自動連携</span>}
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              {memberGroups.length === 0 ? (
                <p className="text-[14px] text-muted-foreground/60">なし</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {memberGroups.map((g) => (
                    <span key={g.id} className="rounded-full bg-accent px-3 py-1 text-[15px] font-medium text-foreground/70">{g.name}</span>
                  ))}
                </div>
              )}
            </section>

            <section>
              <p className="text-[15px] leading-relaxed text-foreground/80">{contact.note || "なし"}</p>
            </section>

            <section>
              {contactConversations.length === 0 ? (
                <p className="text-[14px] text-muted-foreground">履歴はありません</p>
              ) : (
                <div className="space-y-1.5">
                  {contactConversations.map((conv) => {
                    const CIcon = channelIcons[conv.channel];
                    const s = channelStyles[conv.channel];
                    return (
                      <button key={conv.id} onClick={() => onNavigateToThread(conv.id)}
                        className="flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left hover:bg-accent/30 transition-colors cursor-pointer">
                        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5", s.bg)}>
                          <CIcon className={cn("h-3.5 w-3.5", s.text)} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium">{conv.subject || conv.lastMessage}</p>
                          <p className="text-[12px] text-muted-foreground">{conv.lastMessageAt}</p>
                        </div>
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0 bg-foreground/6 text-foreground/50">
                          {conv.status === "open" ? "未対応" : conv.status === "pending" ? "保留中" : "完了"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Add Group Modal ────────────────────── */
function AddGroupModal({ onAdd, onClose }: { onAdd: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[380px] rounded-xl bg-background p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">グループを追加</h2>
          <button onClick={onClose} className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>
        <div>
          <label className="mb-1 block text-[13px] font-medium text-muted-foreground">グループ名 *</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border px-3 py-2.5 text-[15px] outline-none focus:border-brand/40"
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onAdd(name.trim()); }} />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="cursor-pointer rounded-lg border px-4 py-2.5 text-[14px] font-medium hover:bg-accent">キャンセル</button>
          <button onClick={() => name.trim() && onAdd(name.trim())} disabled={!name.trim()}
            className="cursor-pointer rounded-lg bg-brand px-4 py-2.5 text-[14px] font-medium text-white hover:bg-brand/90 disabled:opacity-50">追加</button>
        </div>
      </div>
    </div>
  );
}
