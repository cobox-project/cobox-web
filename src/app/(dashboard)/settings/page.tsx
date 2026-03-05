"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { accounts, teamMembers, memberPermissions as initialPermissions, composeTemplates } from "@/data/mock";
import type { Channel, ComposeTemplate } from "@/data/types";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  Instagram,
  MessageCircle,
  Mail,
  Facebook,

  Link2,
  Users,
  Plus,
  Trash2,
  Shield,
  CreditCard,
  X,
  Check,
  FileText,
  Pencil,
  ArrowLeft,
  GripVertical,
} from "lucide-react";

const tabs = [
  { id: "accounts", label: "チャネル接続", icon: Link2 },
  { id: "team", label: "チーム", icon: Users },
  { id: "templates", label: "テンプレート", icon: FileText },
  { id: "billing", label: "支払い", icon: CreditCard },
] as const;

type TabId = (typeof tabs)[number]["id"];

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

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("accounts");

  return (
    <div className="flex h-full">
      <div className="w-[220px] shrink-0 border-r bg-background px-3 py-4">
        <h1 className="mb-4 px-2.5 text-[15px] font-semibold">管理</h1>
        <nav className="space-y-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[15px] font-medium transition-colors cursor-pointer",
                  activeTab === tab.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}>
                <Icon className="h-[15px] w-[15px] shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-8 py-6">
          {activeTab === "accounts" && <AccountsSettings />}
          {activeTab === "team" && <TeamSettings />}
          {activeTab === "templates" && <TemplateSettings />}
          {activeTab === "billing" && <BillingSettings />}
        </div>
      </div>
    </div>
  );
}

/* ─── Accounts Settings ─────────────────── */

function AccountsSettings() {
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-semibold">チャネル接続</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">メッセージを受信するチャネルを管理</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-[13px] bg-brand hover:bg-brand/90"
          onClick={() => setShowAddModal(true)}>
          <Plus className="h-3.5 w-3.5" />
          追加
        </Button>
      </div>

      <div className="space-y-2">
        {accounts.map((account) => {
          const Icon = channelIcons[account.channel];
          const s = channelStyles[account.channel];
          return (
            <div key={account.id} className="flex items-center gap-3 rounded-lg border px-4 py-3.5">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", s.bg)}>
                <Icon className={cn("h-5 w-5", s.text)} />
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-medium">{account.name}</p>
                <p className="text-[13px] text-muted-foreground">{channelLabels[account.channel]} · {account.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[12px] font-medium text-brand">接続中</span>
                <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="w-[520px] rounded-xl bg-background p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[19px] font-semibold">チャネルを追加</h2>
              <button onClick={() => setShowAddModal(false)}
                className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", channelStyles.email.bg)}>
                    <Mail className={cn("h-5 w-5", channelStyles.email.text)} />
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold">メール</p>
                    <p className="text-[13px] text-muted-foreground">メールアカウントを接続</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <button className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left hover:bg-accent/30 transition-colors cursor-pointer">
                    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <div>
                      <p className="text-[14px] font-medium">Google アカウントで連携</p>
                      <p className="text-[12px] text-muted-foreground">Gmail / Google Workspace</p>
                    </div>
                  </button>
                  <button className="flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left hover:bg-accent/30 transition-colors cursor-pointer">
                    <svg className="h-5 w-5 shrink-0" viewBox="0 0 23 23">
                      <rect fill="#f25022" x="1" y="1" width="10" height="10"/>
                      <rect fill="#00a4ef" x="1" y="12" width="10" height="10"/>
                      <rect fill="#7fba00" x="12" y="1" width="10" height="10"/>
                      <rect fill="#ffb900" x="12" y="12" width="10" height="10"/>
                    </svg>
                    <div>
                      <p className="text-[14px] font-medium">Microsoft アカウントで連携</p>
                      <p className="text-[12px] text-muted-foreground">Outlook / Microsoft 365</p>
                    </div>
                  </button>
                  <button className="flex w-full items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-left hover:bg-accent/30 transition-colors cursor-pointer">
                    <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[14px] font-medium text-muted-foreground">その他のメールサーバー</p>
                      <p className="text-[12px] text-muted-foreground">SMTP / IMAP 手動設定</p>
                    </div>
                  </button>
                </div>
              </div>

              <button className="flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-left hover:bg-accent/30 transition-colors cursor-pointer">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", channelStyles.line.bg)}>
                  <MessageCircle className={cn("h-5 w-5", channelStyles.line.text)} />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-medium">LINE</p>
                  <p className="text-[13px] text-muted-foreground">LINE公式アカウントを接続</p>
                </div>
              </button>

              <button className="flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-left hover:bg-accent/30 transition-colors cursor-pointer">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", channelStyles.instagram.bg)}>
                  <Instagram className={cn("h-5 w-5", channelStyles.instagram.text)} />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-medium">Instagram</p>
                  <p className="text-[13px] text-muted-foreground">Meta Business連携</p>
                </div>
              </button>

              <button className="flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-left hover:bg-accent/30 transition-colors cursor-pointer">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", channelStyles.facebook.bg)}>
                  <Facebook className={cn("h-5 w-5", channelStyles.facebook.text)} />
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-medium">Facebook Messenger</p>
                  <p className="text-[13px] text-muted-foreground">Meta Business連携</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Team Settings ─────────────────────── */

function TeamSettings() {
  const [teamName, setTeamName] = useState("My Shop");
  const [permissions, setPermissions] = useState(initialPermissions);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const handlePermissionChange = (memberId: string, accountId: string, field: "canView" | "canReply", value: boolean) => {
    setPermissions((prev) =>
      prev.map((mp) => {
        if (mp.memberId !== memberId) return mp;
        return {
          ...mp,
          permissions: mp.permissions.map((p) => {
            if (p.accountId !== accountId) return p;
            const updated = { ...p, [field]: value };
            if (field === "canView" && !value) updated.canReply = false;
            return updated;
          }),
        };
      })
    );
  };

  return (
    <div>
      <h2 className="text-[17px] font-semibold mb-1">チーム</h2>
      <p className="mb-5 text-[13px] text-muted-foreground">チームメンバーとチャネル権限を管理</p>

      <div className="mb-8">
        <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">チーム名</label>
        <div className="flex gap-2">
          <input value={teamName} onChange={(e) => setTeamName(e.target.value)}
            className="flex-1 rounded-md border px-3 py-2.5 text-[15px] outline-none focus:border-brand/40" />
          <Button className="bg-brand hover:bg-brand/90 text-[13px] h-10">保存</Button>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">メンバー</h3>
        <Button size="sm" className="h-8 gap-1.5 text-[13px] bg-brand hover:bg-brand/90">
          <Plus className="h-3.5 w-3.5" />
          招待
        </Button>
      </div>

      <div className="rounded-lg border">
        {teamMembers.map((member, i) => {
          const memberPerms = permissions.find((p) => p.memberId === member.id);
          const isExpanded = expandedMember === member.id;
          return (
            <div key={member.id} className={cn(i < teamMembers.length - 1 && "border-b")}>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Avatar src={member.avatar} fallback={member.name} size="sm" className="h-9 w-9" />
                <div className="flex-1">
                  <p className="text-[15px] font-medium">{member.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  {member.role === "admin" && (
                    <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-[12px] font-medium text-brand">
                      <Shield className="h-3 w-3" />
                      管理者
                    </span>
                  )}
                  <button onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                    className={cn("cursor-pointer rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                      isExpanded ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}>
                    権限設定
                  </button>
                </div>
              </div>
              {isExpanded && memberPerms && (
                <div className="border-t bg-accent/20 px-4 py-4">
                  <p className="text-[13px] font-medium text-muted-foreground mb-3">チャネル別権限</p>
                  <div className="space-y-2">
                    {accounts.map((account) => {
                      const perm = memberPerms.permissions.find((p) => p.accountId === account.id);
                      if (!perm) return null;
                      const Icon = channelIcons[account.channel];
                      const s = channelStyles[account.channel];
                      return (
                        <div key={account.id} className="flex items-center gap-3 rounded-lg bg-background border px-4 py-3">
                          <div className={cn("flex h-8 w-8 items-center justify-center rounded-md", s.bg)}>
                            <Icon className={cn("h-4 w-4", s.text)} />
                          </div>
                          <span className="flex-1 text-[14px] font-medium truncate">{account.name}</span>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input type="checkbox" checked={perm.canView}
                                onChange={(e) => handlePermissionChange(member.id, account.id, "canView", e.target.checked)}
                                className="h-4 w-4 rounded accent-brand" />
                              <span className="text-[13px] text-muted-foreground">閲覧</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input type="checkbox" checked={perm.canReply} disabled={!perm.canView}
                                onChange={(e) => handlePermissionChange(member.id, account.id, "canReply", e.target.checked)}
                                className="h-4 w-4 rounded accent-brand disabled:opacity-30" />
                              <span className="text-[13px] text-muted-foreground">返信</span>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Template Settings ─────────────────── */

function TemplateSettings() {
  const [templates, setTemplates] = useState<ComposeTemplate[]>([...composeTemplates]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", subject: "", body: "" });

  const [editForm, setEditForm] = useState<{ name: string; subject: string; body: string }>({
    name: "",
    subject: "",
    body: "",
  });

  // Drag & drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const startEditing = (tpl: ComposeTemplate) => {
    setEditingId(tpl.id);
    setEditForm({ name: tpl.name, subject: tpl.subject ?? "", body: tpl.body });
  };

  const saveEdit = () => {
    if (!editingId) return;
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === editingId
          ? { ...t, name: editForm.name, subject: editForm.subject || undefined, body: editForm.body }
          : t
      )
    );
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const deleteTemplate = (id: string) => {
    if (!window.confirm("このテンプレートを削除しますか？")) return;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const addTemplate = () => {
    const newTpl: ComposeTemplate = {
      id: `tpl_${Date.now()}`,
      name: addForm.name,
      subject: addForm.subject || undefined,
      body: addForm.body,
    };
    setTemplates((prev) => [...prev, newTpl]);
    setAddForm({ name: "", subject: "", body: "" });
    setShowAddModal(false);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setTemplates((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(dragIndex, 1);
      copy.splice(index, 0, item);
      return copy;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Edit page view
  if (editingId) {
    const tpl = templates.find((t) => t.id === editingId);
    if (!tpl) return null;

    return (
      <div>
        <div className="mb-6 flex items-center gap-3">
          <button onClick={cancelEdit}
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-[17px] font-semibold">テンプレートを編集</h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">テンプレート名</label>
            <input
              value={editForm.name}
              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-md border px-3 py-2.5 text-[14px] outline-none focus:border-brand/40"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">件名</label>
              <div className="flex items-center gap-1.5">
                {["姓", "名", "会社名"].map((v) => (
                  <button key={v}
                    onClick={() => setEditForm((prev) => ({ ...prev, subject: prev.subject + `{{${v}}}` }))}
                    className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-0.5 text-[12px] font-medium text-brand hover:bg-brand/10 transition-colors cursor-pointer">
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <input
              value={editForm.subject}
              onChange={(e) => setEditForm((prev) => ({ ...prev, subject: e.target.value }))}
              className="w-full rounded-md border px-3 py-2.5 text-[14px] outline-none focus:border-brand/40"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">本文</label>
              <div className="flex items-center gap-1.5">
                {["姓", "名", "会社名"].map((v) => (
                  <button key={v}
                    onClick={() => setEditForm((prev) => ({ ...prev, body: prev.body + `{{${v}}}` }))}
                    className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-0.5 text-[12px] font-medium text-brand hover:bg-brand/10 transition-colors cursor-pointer">
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={editForm.body}
              onChange={(e) => setEditForm((prev) => ({ ...prev, body: e.target.value }))}
              rows={12}
              className="w-full rounded-md border px-3 py-2.5 text-[14px] outline-none focus:border-brand/40 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="h-9 px-4 text-[13px]" onClick={cancelEdit}>
              キャンセル
            </Button>
            <Button size="sm" className="h-9 px-4 text-[13px] bg-brand hover:bg-brand/90" onClick={saveEdit}>
              保存
            </Button>
          </div>

          {/* Delete button at bottom */}
          <div className="border-t pt-6 mt-8">
            <button onClick={() => deleteTemplate(editingId)}
              className="flex items-center gap-2 text-[14px] text-destructive hover:text-destructive/80 cursor-pointer transition-colors">
              <Trash2 className="h-4 w-4" />
              このテンプレートを削除
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-semibold">メッセージテンプレート</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">メッセージ作成時に使用するテンプレートを管理</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-[13px] bg-brand hover:bg-brand/90"
          onClick={() => setShowAddModal(true)}>
          <Plus className="h-3.5 w-3.5" />
          追加
        </Button>
      </div>

      {/* Template list - clickable to edit, drag & drop reorder */}
      <div className="space-y-2">
        {templates.map((tpl, index) => (
          <div key={tpl.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "rounded-lg border transition-all cursor-pointer hover:bg-accent/20",
              dragOverIndex === index && dragIndex !== index && "border-brand border-dashed",
              dragIndex === index && "opacity-50"
            )}
            onClick={() => startEditing(tpl)}
          >
            <div className="flex items-start gap-3 px-4 py-4">
              <div className="flex items-center shrink-0 pt-1 text-muted-foreground/40 cursor-grab active:cursor-grabbing"
                onClick={(e) => e.stopPropagation()}>
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium">{tpl.name}</p>
                {tpl.subject && (
                  <p className="text-[13px] text-muted-foreground truncate">{tpl.subject}</p>
                )}
                <p className="text-[13px] text-muted-foreground truncate mt-0.5 line-clamp-2" style={{ minHeight: "2.5em" }}>
                  {tpl.body.length > 120 ? tpl.body.slice(0, 120) + "…" : tpl.body}
                </p>
              </div>
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="text-[14px] text-muted-foreground">テンプレートがありません</p>
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="w-[520px] rounded-xl bg-background p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[19px] font-semibold">テンプレートを追加</h2>
              <button onClick={() => setShowAddModal(false)}
                className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">テンプレート名</label>
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="例: 新商品のお知らせ"
                  className="w-full rounded-md border px-3 py-2.5 text-[14px] outline-none focus:border-brand/40"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-medium text-muted-foreground">件名</label>
                  <div className="flex items-center gap-1.5">
                    {["姓", "名", "会社名"].map((v) => (
                      <button key={v}
                        onClick={() => setAddForm((prev) => ({ ...prev, subject: prev.subject + `{{${v}}}` }))}
                        className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-0.5 text-[12px] font-medium text-brand hover:bg-brand/10 transition-colors cursor-pointer">
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  value={addForm.subject}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, subject: e.target.value }))}
                  placeholder="例: 【ご案内】{{姓}}様へ"
                  className="w-full rounded-md border px-3 py-2.5 text-[14px] outline-none focus:border-brand/40"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-medium text-muted-foreground">本文</label>
                  <div className="flex items-center gap-1.5">
                    {["姓", "名", "会社名"].map((v) => (
                      <button key={v}
                        onClick={() => setAddForm((prev) => ({ ...prev, body: prev.body + `{{${v}}}` }))}
                        className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-0.5 text-[12px] font-medium text-brand hover:bg-brand/10 transition-colors cursor-pointer">
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  value={addForm.body}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, body: e.target.value }))}
                  rows={10}
                  placeholder="テンプレートの本文を入力..."
                  className="w-full rounded-md border px-3 py-2.5 text-[14px] outline-none focus:border-brand/40 resize-none"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" className="h-9 text-[13px]" onClick={() => setShowAddModal(false)}>
                キャンセル
              </Button>
              <Button className="h-9 text-[13px] bg-brand hover:bg-brand/90" onClick={addTemplate}
                disabled={!addForm.name.trim()}>
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Billing Settings ──── */

function BillingSettings() {
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("starter");

  const plans = [
    {
      id: "free",
      name: "フリー",
      price: "¥0",
      priceNum: 0,
      desc: "無料",
      members: "1名",
      features: [
        "1チャネルのみ",
        "LINE連携不可",
        "データ保存: 30日",
        "クレカ登録不要",
      ],
      channelNote: "Email / Instagram / Facebook",
    },
    {
      id: "starter",
      name: "スターター",
      price: "¥980",
      priceNum: 980,
      desc: "小規模チーム向け",
      members: "1〜5名",
      features: [
        "5チャネルまで",
        "LINE無料枠: 200通/月",
        "超過: 3円/通",
        "データ保存: 180日",
      ],
      channelNote: "全チャネル対応",
    },
    {
      id: "pro",
      name: "プロ",
      price: "¥2,980",
      priceNum: 2980,
      desc: "成長中のチーム向け",
      members: "6名以上",
      features: [
        "無制限チャネル",
        "LINE無料枠: 1,000通/月",
        "超過: 3円/通",
        "データ保存: 無制限",
      ],
      channelNote: "全チャネル対応",
      recommended: true,
    },
  ];

  const currentPlanData = plans.find((p) => p.id === currentPlan)!;

  return (
    <div>
      <h2 className="text-[17px] font-semibold mb-1">支払い</h2>
      <p className="mb-5 text-[13px] text-muted-foreground">プランと請求情報を管理</p>

      <section className="mb-8">
        <h3 className="text-[15px] font-medium mb-3">現在のプラン</h3>
        <div className="rounded-lg border px-5 py-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[17px] font-semibold">{currentPlanData.name}プラン</p>
              <p className="text-[13px] text-muted-foreground">月額 {currentPlanData.price}（税別）</p>
            </div>
            <Button variant="outline" size="sm" className="h-9 text-[13px] px-4" onClick={() => setShowPlanModal(true)}>
              プラン変更
            </Button>
          </div>
          <div className="flex gap-6 text-[13px]">
            <div>
              <span className="text-muted-foreground">メンバー数: </span>
              <span className="font-medium">{teamMembers.length}人 / {currentPlanData.members}</span>
            </div>
            <div>
              <span className="text-muted-foreground">次回請求日: </span>
              <span className="font-medium">2026/04/01</span>
            </div>
          </div>
        </div>
      </section>

      {currentPlan !== "free" && (
        <section className="mb-8">
          <h3 className="text-[15px] font-medium mb-3">お支払い方法</h3>
          <div className="rounded-lg border px-5 py-4 flex items-center gap-4">
            <div className="flex h-10 w-16 items-center justify-center rounded-md bg-accent text-[14px] font-bold text-muted-foreground">
              VISA
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-medium">**** **** **** 4242</p>
              <p className="text-[13px] text-muted-foreground">有効期限: 12/2027</p>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-[13px]">変更</Button>
          </div>
        </section>
      )}

      <section>
        <h3 className="text-[15px] font-medium mb-3">請求履歴</h3>
        <div className="rounded-lg border">
          <div className="grid grid-cols-5 gap-4 border-b px-4 py-2.5 text-[13px] font-medium text-muted-foreground">
            <span>日付</span>
            <span>内容</span>
            <span className="text-right">金額</span>
            <span className="text-right">ステータス</span>
            <span className="text-right">領収書</span>
          </div>
          {[
            { date: "2026/03/01", desc: "スタータープラン", amount: "¥1,078", status: "支払済" },
            { date: "2026/02/01", desc: "スタータープラン", amount: "¥1,078", status: "支払済" },
            { date: "2026/01/01", desc: "スタータープラン + LINE超過 50通", amount: "¥1,228", status: "支払済" },
          ].map((item, i) => (
            <div key={i} className="grid grid-cols-5 gap-4 border-b last:border-0 px-4 py-3 items-center">
              <span className="text-[14px]">{item.date}</span>
              <span className="text-[14px]">{item.desc}</span>
              <span className="text-[14px] text-right font-medium">{item.amount}</span>
              <span className="text-right">
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[12px] font-medium text-brand">{item.status}</span>
              </span>
              <span className="text-right">
                <button className="text-[13px] text-brand hover:text-brand/80 underline underline-offset-2 cursor-pointer transition-colors">
                  ダウンロード
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      {showPlanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPlanModal(false); }}>
          <div className="w-[800px] rounded-xl bg-background p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[19px] font-semibold">プランを選択</h2>
              <button onClick={() => setShowPlanModal(false)}
                className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-4 text-[13px] text-muted-foreground">
              Email / Instagram / Facebook: 全プラン無制限・無料
            </p>

            <div className="grid grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div key={plan.id} className={cn(
                  "relative rounded-lg border-2 p-5 transition-colors",
                  currentPlan === plan.id ? "border-brand bg-brand/5" : "border-border hover:border-brand/30"
                )}>
                  {plan.recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-0.5 text-[11px] font-medium text-white">
                      おすすめ
                    </div>
                  )}
                  <p className="text-[16px] font-semibold">{plan.name}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{plan.desc}</p>
                  <p className="mt-3 text-[24px] font-bold">
                    {plan.price}
                    <span className="text-[13px] font-normal text-muted-foreground">/月</span>
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">{plan.members}</p>
                  <ul className="mt-4 space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-[13px]">
                        <Check className="h-3.5 w-3.5 text-brand shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={cn(
                      "mt-5 w-full h-10 text-[14px] font-medium",
                      currentPlan === plan.id ? "bg-foreground/10 text-foreground hover:bg-foreground/15" : "bg-brand hover:bg-brand/90"
                    )}
                    onClick={() => { setCurrentPlan(plan.id); setShowPlanModal(false); }}
                    disabled={currentPlan === plan.id}>
                    {currentPlan === plan.id ? "現在のプラン" : "このプランにする"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
