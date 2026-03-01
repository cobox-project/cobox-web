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
  role?: "admin" | "member";
}

export interface ContactGroup {
  id: string;
  name: string;
  description?: string;
  contactIds: string[];
}

export interface ChannelHandle {
  channel: Channel;
  handle: string;
  isAutoLinked?: boolean; // true if linked from inbound message
}

export interface Contact {
  id: string;
  name: string;
  nameFurigana?: string;
  company?: string;
  companyFurigana?: string;
  email?: string;
  phone?: string;
  note?: string;
  channels: ChannelHandle[];
  conversationIds: string[];
  createdAt: string;
  isManuallyCreated?: boolean;
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
  isRead?: boolean;
  needsAction?: boolean;
  messages: Message[];
  isFavorite?: boolean;
  isSpam?: boolean;
}

export interface AccountPermission {
  accountId: string;
  canView: boolean;
  canReply: boolean;
}

export interface MemberPermissions {
  memberId: string;
  permissions: AccountPermission[];
}
