export type Channel = "instagram" | "line" | "email" | "facebook";
export type Status = "open" | "completed" | "no_action";

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
  isAutoLinked?: boolean;
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

export interface Attachment {
  id: string;
  name: string;
  type: "image" | "pdf" | "file";
  url: string;
  size?: string;
  mimeType?: string;
}

export interface Message {
  id: string;
  content: string;
  timestamp: string;
  isInbound: boolean;
  senderName: string;
  isInternal?: boolean;
  emailHeader?: EmailHeader;
  attachments?: Attachment[];
}

export interface Conversation {
  id: string;
  messageNumber: number;
  accountId: string;
  contactId: string;
  contactName: string;
  channel: Channel;
  status: Status;
  assignees: TeamMember[];
  subject?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isRead?: boolean;
  messages: Message[];
  isFavorite?: boolean;
  linkedConversationIds?: string[];
  linkedContactId?: string;
  typingUser?: { id: string; name: string } | null;
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

export interface ComposeTemplate {
  id: string;
  name: string;
  subject?: string;
  body: string;
}
