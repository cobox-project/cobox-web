import { cn } from "@/lib/utils";
import { Instagram, MessageCircle, Mail, Facebook } from "lucide-react";
import type { Channel } from "@/data/types";

const channelConfig: Record<
  Channel,
  { icon: React.ElementType; label: string; colorClass: string }
> = {
  instagram: { icon: Instagram, label: "Instagram", colorClass: "text-channel-instagram" },
  line: { icon: MessageCircle, label: "LINE", colorClass: "text-channel-line" },
  email: { icon: Mail, label: "Email", colorClass: "text-channel-email" },
  facebook: { icon: Facebook, label: "Facebook", colorClass: "text-channel-facebook" },
};

interface ChannelIconProps {
  channel: Channel;
  className?: string;
  size?: "sm" | "md";
}

export function ChannelIcon({ channel, className, size = "sm" }: ChannelIconProps) {
  const config = channelConfig[channel];
  const Icon = config.icon;
  const sizeClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <Icon
      className={cn(sizeClass, config.colorClass, className)}
    />
  );
}

export function getChannelLabel(channel: Channel): string {
  return channelConfig[channel].label;
}
