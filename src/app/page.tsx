"use client";

import { useState, useMemo, useCallback } from "react";
import { Sidebar } from "@/components/inbox/sidebar";
import { ConversationList } from "@/components/inbox/conversation-list";
import { ConversationDetail } from "@/components/inbox/conversation-detail";
import { EmptyState } from "@/components/inbox/empty-state";
import { conversations as initialConversations } from "@/data/mock";
import type { Status } from "@/data/types";

export default function InboxPage() {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  );
  const [filter, setFilter] = useState<Status | "all">("all");

  const counts = useMemo(() => {
    return {
      all: conversations.length,
      open: conversations.filter((c) => c.status === "open").length,
      pending: conversations.filter((c) => c.status === "pending").length,
      resolved: conversations.filter((c) => c.status === "resolved").length,
    };
  }, [conversations]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const handleStatusChange = useCallback(
    (id: string, status: Status) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status } : c))
      );
    },
    []
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        currentFilter={filter}
        onFilterChange={setFilter}
        counts={counts}
      />
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        filter={filter}
      />
      {selectedConversation ? (
        <ConversationDetail
          conversation={selectedConversation}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
