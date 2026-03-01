export type Channel = "instagram" | "line" | "email" | "facebook";
export type Status = "open" | "pending" | "resolved";

export interface Account {
  id: string;
  channel: Channel;
  name: string;
  description: string;
}

export interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
}

export interface ContactGroup {
  id: string;
  name: string;
  description?: string;
  contactIds: string[];
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  note?: string;
  channels: { channel: Channel; handle: string }[];
  conversationIds: string[];
  createdAt: string;
}

export interface EmailHeader {
  subject: string;
  to?: string;
  cc?: string;
  bcc?: string;
}

export interface Message {
  id: string;
  content: string;
  timestamp: string;
  isInbound: boolean;
  senderName: string;
  isInternal?: boolean;
  emailHeader?: EmailHeader;
}

export interface Conversation {
  id: string;
  accountId: string;
  contactId: string;
  contactName: string;
  channel: Channel;
  status: Status;
  assignee?: TeamMember;
  subject?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  messages: Message[];
}
