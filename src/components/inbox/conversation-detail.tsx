"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChannelIcon, getChannelLabel } from "./channel-icon";
import type { Conversation, Message, Status } from "@/data/types";
import {
  Send,
  Paperclip,
  MoreHorizontal,
  UserPlus,
  Clock,
  CheckCircle2,
  CircleDot,
  MessageSquare,
  ChevronDown,
} from "lucide-react";

interface ConversationDetailProps {
  conversation: Conversation;
  onStatusChange: (id: string, status: Status) => void;
}

export function ConversationDetail({ conversation, onStatusChange }: ConversationDetailProps) {
  const [replyText, setReplyText] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b px-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <Avatar fallback={conversation.contactInitials} size="md" />
            <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background p-[2px]">
              <ChannelIcon channel={conversation.channel} />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[14px] font-semibold">
                {conversation.contactName}
              </h3>
              <Badge variant={conversation.channel} className="text-[10px]">
                {getChannelLabel(conversation.channel)}
              </Badge>
            </div>
            {conversation.subject && (
              <p className="truncate text-[12px] text-muted-foreground">
                {conversation.subject}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <StatusSelector
            status={conversation.status}
            onChange={(s) => onStatusChange(conversation.id, s)}
          />
          <Button variant="ghost" size="icon-sm">
            <UserPlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-2xl space-y-4">
          {conversation.messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      </div>

      {/* Reply */}
      <div className="border-t px-6 py-3">
        <div className="mx-auto max-w-2xl">
          {/* Internal/External toggle */}
          <div className="mb-2 flex items-center gap-2">
            <button
              onClick={() => setIsInternal(false)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors cursor-pointer",
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
                "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors cursor-pointer",
                isInternal
                  ? "bg-amber-500/10 text-amber-600"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                内部メモ
              </span>
            </button>
          </div>

          <div
            className={cn(
              "flex items-end gap-2 rounded-xl border px-3 py-2 transition-colors",
              isInternal
                ? "border-amber-300/50 bg-amber-50/50"
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
              className="flex-1 resize-none bg-transparent py-1 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground/60"
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 120) + "px";
              }}
            />
            <div className="flex items-center gap-1 pb-0.5">
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                size="icon-sm"
                className={cn(
                  "rounded-lg",
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

function MessageBubble({ message }: { message: Message }) {
  const { content, timestamp, isInbound, senderName, isInternal } = message;

  if (isInternal) {
    return (
      <div className="flex justify-center">
        <div className="max-w-md rounded-lg border border-amber-200/60 bg-amber-50/50 px-4 py-2.5">
          <div className="mb-1 flex items-center gap-2">
            <MessageSquare className="h-3 w-3 text-amber-500" />
            <span className="text-[11px] font-medium text-amber-600">
              内部メモ — {senderName}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed text-amber-900/80">
            {content}
          </p>
          <p className="mt-1 text-[10px] text-amber-500">{timestamp}</p>
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
        <Avatar
          fallback={senderName.slice(0, 2)}
          size="sm"
          className="mt-1"
        />
      )}

      <div
        className={cn(
          "max-w-[75%] space-y-1",
          !isInbound && "items-end"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            {senderName}
          </span>
          <span className="text-[10px] text-muted-foreground/60">
            {timestamp}
          </span>
        </div>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed",
            isInbound
              ? "rounded-tl-md bg-secondary text-secondary-foreground"
              : "rounded-tr-md bg-foreground text-background"
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
        <Avatar
          fallback={senderName.slice(0, 2)}
          size="sm"
          className="mt-1"
        />
      )}
    </div>
  );
}

function StatusSelector({
  status,
  onChange,
}: {
  status: Status;
  onChange: (status: Status) => void;
}) {
  const [open, setOpen] = useState(false);

  const statusConfig: Record<
    Status,
    { label: string; icon: React.ElementType }
  > = {
    open: { label: "未対応", icon: CircleDot },
    pending: { label: "保留中", icon: Clock },
    resolved: { label: "完了", icon: CheckCircle2 },
  };

  const current = statusConfig[status];
  const CurrentIcon = current.icon;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-[12px]"
        onClick={() => setOpen(!open)}
      >
        <CurrentIcon className="h-3.5 w-3.5" />
        {current.label}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border bg-popover p-1 shadow-lg">
            {(Object.keys(statusConfig) as Status[]).map((s) => {
              const conf = statusConfig[s];
              const Icon = conf.icon;
              return (
                <button
                  key={s}
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer",
                    s === status
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {conf.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
