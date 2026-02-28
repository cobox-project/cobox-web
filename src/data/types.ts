export type Channel = "instagram" | "line" | "email" | "facebook";
export type Status = "open" | "pending" | "resolved";

export interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
}

export interface Message {
  id: string;
  content: string;
  timestamp: string;
  isInbound: boolean;
  senderName: string;
  isInternal?: boolean;
}

export interface Conversation {
  id: string;
  contactName: string;
  contactAvatar?: string;
  contactInitials: string;
  channel: Channel;
  status: Status;
  assignee?: TeamMember;
  subject?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  messages: Message[];
}
