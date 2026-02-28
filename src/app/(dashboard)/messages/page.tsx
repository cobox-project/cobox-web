"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { accounts, conversations } from "@/data/mock";
import type { Channel } from "@/data/types";
import {
  Instagram,
  MessageCircle,
  Mail,
  Facebook,
  ArrowRight,
  CircleDot,
} from "lucide-react";

const channelConfig: Record<
  Channel,
  {
    icon: React.ElementType;
    bg: string;
    text: string;
    border: string;
    label: string;
  }
> = {
  instagram: {
    icon: Instagram,
    bg: "bg-channel-instagram/8",
    text: "text-channel-instagram",
    border: "border-channel-instagram/15",
    label: "Instagram",
  },
  line: {
    icon: MessageCircle,
    bg: "bg-channel-line/8",
    text: "text-channel-line",
    border: "border-channel-line/15",
    label: "LINE",
  },
  email: {
    icon: Mail,
    bg: "bg-channel-email/8",
    text: "text-channel-email",
    border: "border-channel-email/15",
    label: "Email",
  },
  facebook: {
    icon: Facebook,
    bg: "bg-channel-facebook/8",
    text: "text-channel-facebook",
    border: "border-channel-facebook/15",
    label: "Facebook",
  },
};

export default function MessagesPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-8">
        <div className="mb-6">
          <h1 className="text-[18px] font-semibold text-foreground">
            メッセージ
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            アカウントを選択して会話を確認
          </p>
        </div>

        <div className="grid gap-3">
          {accounts.map((account) => {
            const config = channelConfig[account.channel];
            const Icon = config.icon;
            const convs = conversations.filter(
              (c) => c.accountId === account.id
            );
            const unread = convs.reduce((sum, c) => sum + c.unreadCount, 0);
            const open = convs.filter((c) => c.status === "open").length;
            const pending = convs.filter(
              (c) => c.status === "pending"
            ).length;

            return (
              <Link
                key={account.id}
                href={`/messages/${account.id}`}
                className={cn(
                  "group flex items-center gap-4 rounded-lg border p-4 transition-all hover:shadow-sm",
                  config.border,
                  "hover:border-foreground/15"
                )}
              >
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    config.bg
                  )}
                >
                  <Icon className={cn("h-5 w-5", config.text)} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-medium text-foreground">
                      {account.name}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-px text-[10px] font-medium",
                        config.bg,
                        config.text
                      )}
                    >
                      {config.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {account.description}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-3 text-[12px]">
                    <span className="text-muted-foreground">
                      {convs.length}件
                    </span>
                    {open > 0 && (
                      <span className="flex items-center gap-1 text-status-open">
                        <CircleDot className="h-3 w-3" />
                        {open}
                      </span>
                    )}
                    {pending > 0 && (
                      <span className="text-status-pending">
                        保留 {pending}
                      </span>
                    )}
                    {unread > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-semibold text-background">
                        {unread}
                      </span>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
