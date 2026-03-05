"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { contacts, contactGroups, composeTemplates, accounts } from "@/data/mock";
import type { Contact } from "@/data/types";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Send,
  Save,
  X,
  Users,
  User,
  Search,
  FileText,
  Mail,
  ChevronDown,
  FileStack,
} from "lucide-react";

const variableButtons = [
  { label: "姓", variable: "{{姓}}" },
  { label: "名", variable: "{{名}}" },
  { label: "会社名", variable: "{{会社名}}" },
];

const emailAccounts = accounts.filter((a) => a.channel === "email");

export default function ComposePage() {
  return (
    <Suspense fallback={<div className="flex h-full items-center justify-center text-muted-foreground">読み込み中...</div>}>
      <ComposePageInner />
    </Suspense>
  );
}

function ComposePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientType, setRecipientType] = useState<"group" | "individual">("group");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [previewContactId, setPreviewContactId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmailAccountId, setSelectedEmailAccountId] = useState(emailAccounts[0]?.id ?? "");
  const [showDraftModal, setShowDraftModal] = useState(false);

  // Pre-select group from query param
  useEffect(() => {
    const groupId = searchParams.get("group");
    if (groupId) {
      setRecipientType("group");
      setSelectedGroupIds([groupId]);
    }
  }, [searchParams]);

  // Resolved recipients
  const resolvedContacts = useMemo(() => {
    const ids = new Set<string>();
    if (recipientType === "group") {
      selectedGroupIds.forEach((gid) => {
        const group = contactGroups.find((g) => g.id === gid);
        if (group) group.contactIds.forEach((cid) => ids.add(cid));
      });
    } else {
      selectedContactIds.forEach((id) => ids.add(id));
    }
    return contacts.filter((c) => ids.has(c.id));
  }, [recipientType, selectedGroupIds, selectedContactIds]);

  const previewContact = previewContactId
    ? contacts.find((c) => c.id === previewContactId)
    : resolvedContacts[0];

  // Replace variables in body for preview
  const resolveVariables = (text: string, contact?: Contact) => {
    if (!contact) return text;
    const nameParts = contact.name.split(/\s+/);
    return text
      .replace(/\{\{姓\}\}/g, nameParts[0] ?? "")
      .replace(/\{\{名\}\}/g, nameParts[1] ?? "")
      .replace(/\{\{会社名\}\}/g, contact.company ?? "");
  };

  const insertVariable = (variable: string) => {
    setBody((prev) => prev + variable);
  };

  const handleLoadTemplate = (templateId: string) => {
    const tpl = composeTemplates.find((t) => t.id === templateId);
    if (tpl) {
      if (tpl.subject) setSubject(tpl.subject);
      setBody(tpl.body);
    }
    setShowTemplatePicker(false);
  };

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const toggleContact = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/messages")}
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-[17px] font-semibold">新規メッセージ作成</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-[14px] px-4"
            onClick={() => setShowDraftModal(true)}>
            <FileStack className="h-3.5 w-3.5" />
            下書き
          </Button>
          <Button size="sm" className="h-9 gap-1.5 text-[14px] px-4 bg-brand hover:bg-brand/90"
            disabled={resolvedContacts.length === 0 || !body.trim()}>
            <Send className="h-3.5 w-3.5" />
            送信する
          </Button>
        </div>
      </header>

      {/* Main content - split layout: editor left, preview right */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor pane */}
        <div className="w-1/2 overflow-y-auto border-r">
          <div className="max-w-lg mx-auto px-8 py-6 space-y-5">
            {/* Email account selector */}
            <section>
              <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">送信元メールアカウント</label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-channel-email shrink-0" />
                <select
                  value={selectedEmailAccountId}
                  onChange={(e) => setSelectedEmailAccountId(e.target.value)}
                  className="flex-1 rounded-lg border px-3 pr-8 py-2.5 text-[15px] outline-none focus:border-brand/40 bg-background"
                >
                  {emailAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
            </section>

            {/* Recipient type */}
            <section>
              <label className="mb-2 block text-[13px] font-medium text-muted-foreground">宛先</label>
              <div className="flex rounded-lg border overflow-hidden mb-3">
                <button
                  onClick={() => setRecipientType("individual")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[14px] font-medium transition-colors cursor-pointer border-r",
                    recipientType === "individual" ? "bg-brand text-white" : "bg-background text-muted-foreground hover:bg-accent"
                  )}>
                  <User className="h-3.5 w-3.5" />
                  個別
                </button>
                <button
                  onClick={() => setRecipientType("group")}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-[14px] font-medium transition-colors cursor-pointer",
                    recipientType === "group" ? "bg-brand text-white" : "bg-background text-muted-foreground hover:bg-accent"
                  )}>
                  <Users className="h-3.5 w-3.5" />
                  グループ
                </button>
              </div>

              {recipientType === "group" ? (
                <div className="space-y-1.5">
                  {contactGroups.map((group) => (
                    <label key={group.id}
                      className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer select-none hover:bg-accent/30 transition-colors">
                      <input type="checkbox"
                        checked={selectedGroupIds.includes(group.id)}
                        onChange={() => toggleGroup(group.id)}
                        className="h-4 w-4 rounded accent-brand" />
                      <div className="flex-1">
                        <span className="text-[14px] font-medium">{group.name}</span>
                        <span className="ml-2 text-[12px] text-muted-foreground">{group.contactIds.length}名</span>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2 mb-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="連絡先を検索..."
                      className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/50" />
                  </div>
                  <div className="max-h-[200px] overflow-y-auto rounded-lg border">
                    {filteredContacts.map((contact) => (
                      <label key={contact.id}
                        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none hover:bg-accent/30 transition-colors border-b last:border-0">
                        <input type="checkbox"
                          checked={selectedContactIds.includes(contact.id)}
                          onChange={() => toggleContact(contact.id)}
                          className="h-4 w-4 rounded accent-brand" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[14px] font-medium">{contact.name}</span>
                          {contact.company && <span className="ml-2 text-[12px] text-muted-foreground">{contact.company}</span>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {resolvedContacts.length > 0 && (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  {resolvedContacts.length}名に送信されます
                </p>
              )}
            </section>

            {/* Subject */}
            <section>
              <label className="mb-1.5 block text-[13px] font-medium text-muted-foreground">件名</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="件名を入力..."
                className="w-full rounded-lg border px-3 py-2.5 text-[15px] outline-none focus:border-brand/40 placeholder:text-muted-foreground/50" />
            </section>

            {/* Body */}
            <section>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[13px] font-medium text-muted-foreground">本文</label>
                <div className="flex items-center gap-2">
                  {variableButtons.map((v) => (
                    <button key={v.variable}
                      onClick={() => insertVariable(v.variable)}
                      className="rounded-full border border-brand/30 bg-brand/5 px-2.5 py-0.5 text-[12px] font-medium text-brand hover:bg-brand/10 transition-colors cursor-pointer">
                      {v.label}
                    </button>
                  ))}
                  <button onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                    className="flex items-center gap-1 text-[13px] text-brand hover:text-brand/80 cursor-pointer transition-colors">
                    <FileText className="h-3.5 w-3.5" />
                    テンプレート
                  </button>
                </div>
              </div>

              {showTemplatePicker && (
                <div className="mb-3 rounded-lg border bg-accent/20 p-3 space-y-1.5">
                  <p className="text-[12px] font-medium text-muted-foreground mb-2">テンプレートを選択</p>
                  {composeTemplates.map((tpl) => (
                    <button key={tpl.id}
                      onClick={() => handleLoadTemplate(tpl.id)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[14px] text-left hover:bg-accent transition-colors cursor-pointer">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {tpl.name}
                    </button>
                  ))}
                </div>
              )}

              <textarea value={body} onChange={(e) => setBody(e.target.value)}
                placeholder="メッセージ本文を入力..."
                rows={12}
                className="w-full resize-none rounded-lg border px-3 py-2.5 text-[15px] leading-relaxed outline-none focus:border-brand/40 placeholder:text-muted-foreground/50" />
            </section>
          </div>
        </div>

        {/* Live preview pane (always visible on right) */}
        <div className="w-1/2 overflow-y-auto bg-accent/5">
          <div className="px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold">プレビュー</h3>
              {resolvedContacts.length > 0 && (
                <select
                  value={previewContactId ?? ""}
                  onChange={(e) => setPreviewContactId(e.target.value || null)}
                  className="rounded-md border px-2 pr-8 py-1 text-[13px] outline-none bg-background"
                >
                  {resolvedContacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            {previewContact ? (
              <div className="rounded-lg border bg-background p-5">
                <p className="text-[13px] text-muted-foreground mb-3">
                  宛先: {previewContact.name} ({previewContact.email ?? "メールなし"})
                </p>
                <p className="text-[12px] text-muted-foreground mb-3">
                  送信元: {emailAccounts.find((a) => a.id === selectedEmailAccountId)?.name ?? ""}
                </p>
                {subject && (
                  <p className="text-[15px] font-semibold mb-3 pb-3 border-b">
                    {resolveVariables(subject, previewContact)}
                  </p>
                )}
                <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
                  {resolveVariables(body, previewContact) || (
                    <span className="text-muted-foreground/40">本文を入力するとプレビューが表示されます</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border bg-background p-5">
                <p className="text-[14px] text-muted-foreground text-center py-8">
                  宛先を選択するとプレビューが表示されます
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Draft modal */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold">下書き一覧</h2>
              <button onClick={() => setShowDraftModal(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-[14px] text-muted-foreground">保存された下書きはありません</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
