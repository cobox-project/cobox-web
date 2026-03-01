import type { Account, Contact, ContactGroup, Conversation, TeamMember } from "./types";

export const currentUser: TeamMember = {
  id: "u1",
  name: "田中 美咲",
  avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Misaki&backgroundColor=e8f5e9",
};

export const teamMembers: TeamMember[] = [
  currentUser,
  {
    id: "u2",
    name: "佐藤 健太",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Kenta&backgroundColor=e8f5e9",
  },
  {
    id: "u3",
    name: "鈴木 花",
    avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=Hana&backgroundColor=e8f5e9",
  },
];

export const accounts: Account[] = [
  {
    id: "acc-email",
    channel: "email",
    name: "info@myshop.jp",
    description: "メインの問い合わせ用",
  },
  {
    id: "acc-line",
    channel: "line",
    name: "@myshop_official",
    description: "LINE公式アカウント",
  },
  {
    id: "acc-ig",
    channel: "instagram",
    name: "@myshop.style",
    description: "ショップ公式",
  },
];

export const contactGroups: ContactGroup[] = [
  {
    id: "grp-all",
    name: "すべてのグループ",
    description: "全顧客を表示",
    contactIds: ["ct1", "ct2", "ct3", "ct4", "ct5", "ct6", "ct7", "ct8", "ct9", "ct10"],
  },
  {
    id: "grp-vip",
    name: "VIP顧客",
    description: "重要顧客",
    contactIds: ["ct3", "ct5", "ct7"],
  },
  {
    id: "grp-conf",
    name: "今年のカンファレンス協賛企業",
    description: "2025年カンファレンス関連",
    contactIds: ["ct1", "ct9"],
  },
  {
    id: "grp-lead",
    name: "リード",
    description: "見込み顧客",
    contactIds: ["ct2", "ct4", "ct8"],
  },
];

export const contacts: Contact[] = [
  {
    id: "ct1",
    name: "山田 太郎",
    email: "yamada@example.com",
    channels: [{ channel: "instagram", handle: "@yamada_t" }],
    conversationIds: ["c8"],
    createdAt: "2024-12-01",
  },
  {
    id: "ct2",
    name: "佐々木 リナ",
    phone: "090-1234-5678",
    channels: [{ channel: "line", handle: "rina_sasaki" }],
    conversationIds: ["c5"],
    createdAt: "2024-11-15",
  },
  {
    id: "ct3",
    name: "鈴木 一郎",
    email: "ichiro.suzuki@example.com",
    channels: [{ channel: "email", handle: "ichiro.suzuki@example.com" }],
    conversationIds: ["c1"],
    createdAt: "2024-10-20",
  },
  {
    id: "ct4",
    name: "高橋 あいり",
    channels: [{ channel: "instagram", handle: "@airi_takahashi" }],
    conversationIds: ["c9"],
    createdAt: "2024-09-10",
  },
  {
    id: "ct5",
    name: "中村 健二",
    email: "kenji.n@example.com",
    channels: [
      { channel: "email", handle: "kenji.n@example.com" },
      { channel: "instagram", handle: "@kenji_nakamura" },
    ],
    conversationIds: ["c4", "c11"],
    createdAt: "2024-08-05",
  },
  {
    id: "ct6",
    name: "木村 さくら",
    phone: "080-9876-5432",
    channels: [{ channel: "line", handle: "sakura_kimura" }],
    conversationIds: ["c6"],
    createdAt: "2024-11-01",
  },
  {
    id: "ct7",
    name: "渡辺 大輔",
    email: "d.watanabe@example.com",
    channels: [{ channel: "email", handle: "d.watanabe@example.com" }],
    conversationIds: ["c2"],
    createdAt: "2024-07-15",
  },
  {
    id: "ct8",
    name: "伊藤 まり",
    channels: [{ channel: "instagram", handle: "@mari_ito" }],
    conversationIds: ["c10"],
    createdAt: "2024-12-10",
  },
  {
    id: "ct9",
    name: "松本 真一",
    email: "s.matsumoto@example.com",
    channels: [{ channel: "email", handle: "s.matsumoto@example.com" }],
    conversationIds: ["c3"],
    createdAt: "2025-01-05",
  },
  {
    id: "ct10",
    name: "小林 あやか",
    phone: "070-1111-2222",
    channels: [{ channel: "line", handle: "ayaka_kobayashi" }],
    conversationIds: ["c7"],
    createdAt: "2025-01-20",
  },
];

export const conversations: Conversation[] = [
  // ── Email (acc-email) ─────────────────────────
  {
    id: "c1",
    accountId: "acc-email",
    contactId: "ct3",
    contactName: "鈴木 一郎",
    channel: "email",
    status: "pending",
    assignee: teamMembers[0],
    subject: "請求書の再発行について",
    lastMessage:
      "先月分の請求書を再発行していただくことは可能でしょうか。経理処理の都合上、宛名を変更したいです。",
    lastMessageAt: "1時間前",
    unreadCount: 0,
    messages: [
      {
        id: "m1",
        content:
          "お世話になっております。\n\n先月分の請求書を再発行していただくことは可能でしょうか。\n経理処理の都合上、宛名を変更したいです。\n\n宛名：株式会社スズキ商事\n\nお手数ですがよろしくお願いいたします。",
        timestamp: "今日 12:30",
        isInbound: true,
        senderName: "鈴木 一郎",
        emailHeader: {
          subject: "請求書の再発行について",
          to: "info@myshop.jp",
          cc: "keiri@suzuki-shoji.co.jp",
        },
      },
      {
        id: "m2",
        content: "経理チームに確認中です。少々お待ちください。",
        timestamp: "今日 12:45",
        isInbound: false,
        senderName: "田中 美咲",
        isInternal: true,
      },
    ],
  },
  {
    id: "c2",
    accountId: "acc-email",
    contactId: "ct7",
    contactName: "渡辺 大輔",
    channel: "email",
    status: "open",
    subject: "コラボレーション提案",
    lastMessage:
      "弊社とのコラボレーション企画についてご提案させていただきたく、ご連絡いたしました。",
    lastMessageAt: "昨日",
    unreadCount: 1,
    messages: [
      {
        id: "m3",
        content:
          "はじめまして。\n\n弊社とのコラボレーション企画についてご提案させていただきたく、ご連絡いたしました。\n\n詳細な企画書を添付しておりますので、ご確認いただけますと幸いです。\n\nお忙しいところ恐れ入りますが、ご検討のほどよろしくお願いいたします。",
        timestamp: "昨日 11:30",
        isInbound: true,
        senderName: "渡辺 大輔",
        emailHeader: {
          subject: "コラボレーション提案",
          to: "info@myshop.jp",
        },
      },
    ],
  },
  {
    id: "c3",
    accountId: "acc-email",
    contactId: "ct9",
    contactName: "松本 真一",
    channel: "email",
    status: "open",
    assignee: teamMembers[1],
    subject: "サービス解約の手続き",
    lastMessage:
      "今月末でサービスを解約したいのですが、手続き方法を教えてください。",
    lastMessageAt: "昨日",
    unreadCount: 1,
    messages: [
      {
        id: "m4",
        content:
          "お世話になっております。\n\n今月末でサービスを解約したいのですが、手続き方法を教えてください。\n\nよろしくお願いいたします。",
        timestamp: "昨日 15:20",
        isInbound: true,
        senderName: "松本 真一",
        emailHeader: {
          subject: "サービス解約の手続き",
          to: "info@myshop.jp",
        },
      },
      {
        id: "m5",
        content:
          "松本様、ご連絡ありがとうございます。解約手続きについてご案内いたします。\n\nマイページの「契約情報」から解約申請が可能です。ご不明点があればお気軽にお問い合わせください。",
        timestamp: "昨日 16:00",
        isInbound: false,
        senderName: "佐藤 健太",
        emailHeader: {
          subject: "Re: サービス解約の手続き",
          to: "s.matsumoto@example.com",
        },
      },
      {
        id: "m6",
        content:
          "マイページから手続きしようとしましたが、エラーが出てしまいます。スクリーンショットを添付します。",
        timestamp: "昨日 17:30",
        isInbound: true,
        senderName: "松本 真一",
        emailHeader: {
          subject: "Re: サービス解約の手続き",
          to: "info@myshop.jp",
        },
      },
    ],
  },
  {
    id: "c4",
    accountId: "acc-email",
    contactId: "ct5",
    contactName: "中村 健二",
    channel: "email",
    status: "resolved",
    assignee: teamMembers[0],
    subject: "サービス資料のご送付",
    lastMessage: "資料のご送付ありがとうございました。社内で検討いたします。",
    lastMessageAt: "3日前",
    unreadCount: 0,
    messages: [
      {
        id: "m7",
        content:
          "御社のサービスについて詳しくお聞きしたいです。資料をいただけますか？",
        timestamp: "3日前 10:00",
        isInbound: true,
        senderName: "中村 健二",
        emailHeader: {
          subject: "サービス資料のご送付",
          to: "info@myshop.jp",
        },
      },
      {
        id: "m8",
        content:
          "中村様、お問い合わせありがとうございます。サービス資料をお送りいたします。ご不明点がございましたらお気軽にご連絡ください。",
        timestamp: "3日前 10:30",
        isInbound: false,
        senderName: "田中 美咲",
        emailHeader: {
          subject: "Re: サービス資料のご送付",
          to: "kenji.n@example.com",
        },
      },
      {
        id: "m9",
        content:
          "資料のご送付ありがとうございました。社内で検討いたします。",
        timestamp: "3日前 11:00",
        isInbound: true,
        senderName: "中村 健二",
        emailHeader: {
          subject: "Re: サービス資料のご送付",
          to: "info@myshop.jp",
        },
      },
    ],
  },

  // ── LINE (acc-line) ───────────────────────────
  {
    id: "c5",
    accountId: "acc-line",
    contactId: "ct2",
    contactName: "佐々木 リナ",
    channel: "line",
    status: "open",
    assignee: teamMembers[1],
    lastMessage:
      "予約の変更をお願いしたいのですが、来週の水曜日は空いていますか？",
    lastMessageAt: "15分前",
    unreadCount: 1,
    messages: [
      {
        id: "m10",
        content:
          "お世話になっております。来週の予約について変更したいのですが。",
        timestamp: "今日 13:45",
        isInbound: true,
        senderName: "佐々木 リナ",
      },
      {
        id: "m11",
        content: "承知いたしました。ご希望の日時をお聞かせください。",
        timestamp: "今日 13:50",
        isInbound: false,
        senderName: "佐藤 健太",
      },
      {
        id: "m12",
        content:
          "予約の変更をお願いしたいのですが、来週の水曜日は空いていますか？",
        timestamp: "今日 14:00",
        isInbound: true,
        senderName: "佐々木 リナ",
      },
    ],
  },
  {
    id: "c6",
    accountId: "acc-line",
    contactId: "ct6",
    contactName: "木村 さくら",
    channel: "line",
    status: "resolved",
    assignee: teamMembers[1],
    lastMessage: "来月もよろしくお願いします！",
    lastMessageAt: "昨日",
    unreadCount: 0,
    messages: [
      {
        id: "m13",
        content: "今月のレッスン予約を確認させてください。",
        timestamp: "昨日 16:00",
        isInbound: true,
        senderName: "木村 さくら",
      },
      {
        id: "m14",
        content:
          "木村様、今月は毎週火曜の10:00でご予約いただいております。",
        timestamp: "昨日 16:10",
        isInbound: false,
        senderName: "佐藤 健太",
      },
      {
        id: "m15",
        content: "来月もよろしくお願いします！",
        timestamp: "昨日 16:15",
        isInbound: true,
        senderName: "木村 さくら",
      },
    ],
  },
  {
    id: "c7",
    accountId: "acc-line",
    contactId: "ct10",
    contactName: "小林 あやか",
    channel: "line",
    status: "open",
    assignee: teamMembers[0],
    lastMessage: "ポイントカードの残高を確認したいです。",
    lastMessageAt: "2時間前",
    unreadCount: 2,
    messages: [
      {
        id: "m16",
        content: "こんにちは。ポイントカードの残高を確認したいです。",
        timestamp: "今日 11:00",
        isInbound: true,
        senderName: "小林 あやか",
      },
      {
        id: "m17",
        content:
          "小林様、こんにちは。会員番号をお教えいただけますか？",
        timestamp: "今日 11:15",
        isInbound: false,
        senderName: "田中 美咲",
      },
      {
        id: "m18",
        content: "会員番号は A-12345 です。よろしくお願いします。",
        timestamp: "今日 11:20",
        isInbound: true,
        senderName: "小林 あやか",
      },
    ],
  },

  // ── Instagram (acc-ig) ────────────────────────
  {
    id: "c8",
    accountId: "acc-ig",
    contactId: "ct1",
    contactName: "山田 太郎",
    channel: "instagram",
    status: "open",
    assignee: teamMembers[0],
    lastMessage: "商品の在庫状況について教えていただけますか？",
    lastMessageAt: "2分前",
    unreadCount: 2,
    messages: [
      {
        id: "m19",
        content:
          "こんにちは！先日注文した商品について質問があります。",
        timestamp: "今日 14:20",
        isInbound: true,
        senderName: "山田 太郎",
      },
      {
        id: "m20",
        content:
          "こんにちは、山田様。ご連絡ありがとうございます。どのような質問でしょうか？",
        timestamp: "今日 14:25",
        isInbound: false,
        senderName: "田中 美咲",
      },
      {
        id: "m21",
        content: "ネイビーカラーのMサイズは在庫ありますか？",
        timestamp: "今日 14:28",
        isInbound: true,
        senderName: "山田 太郎",
      },
      {
        id: "m22",
        content: "商品の在庫状況について教えていただけますか？",
        timestamp: "今日 14:30",
        isInbound: true,
        senderName: "山田 太郎",
      },
    ],
  },
  {
    id: "c9",
    accountId: "acc-ig",
    contactId: "ct4",
    contactName: "高橋 あいり",
    channel: "instagram",
    status: "resolved",
    assignee: teamMembers[2],
    lastMessage: "ありがとうございます！助かりました",
    lastMessageAt: "3時間前",
    unreadCount: 0,
    messages: [
      {
        id: "m23",
        content: "すみません、注文のキャンセルはできますか？",
        timestamp: "今日 09:00",
        isInbound: true,
        senderName: "高橋 あいり",
      },
      {
        id: "m24",
        content:
          "はい、キャンセル処理を完了いたしました。返金は3〜5営業日以内に反映されます。",
        timestamp: "今日 09:15",
        isInbound: false,
        senderName: "鈴木 花",
      },
      {
        id: "m25",
        content: "ありがとうございます！助かりました",
        timestamp: "今日 09:20",
        isInbound: true,
        senderName: "高橋 あいり",
      },
    ],
  },
  {
    id: "c10",
    accountId: "acc-ig",
    contactId: "ct8",
    contactName: "伊藤 まり",
    channel: "instagram",
    status: "pending",
    assignee: teamMembers[2],
    lastMessage: "返品の手続きはどうすればいいですか？写真を送ります。",
    lastMessageAt: "昨日",
    unreadCount: 0,
    messages: [
      {
        id: "m26",
        content: "購入した商品に傷がありました。",
        timestamp: "昨日 14:00",
        isInbound: true,
        senderName: "伊藤 まり",
      },
      {
        id: "m27",
        content:
          "大変申し訳ございません。お写真をお送りいただけますか？",
        timestamp: "昨日 14:10",
        isInbound: false,
        senderName: "鈴木 花",
      },
      {
        id: "m28",
        content:
          "返品の手続きはどうすればいいですか？写真を送ります。",
        timestamp: "昨日 14:20",
        isInbound: true,
        senderName: "伊藤 まり",
      },
    ],
  },
  {
    id: "c11",
    accountId: "acc-ig",
    contactId: "ct5",
    contactName: "中村 健二",
    channel: "instagram",
    status: "open",
    lastMessage: "DMで質問いいですか？商品の素材について教えてください。",
    lastMessageAt: "4時間前",
    unreadCount: 1,
    messages: [
      {
        id: "m29",
        content:
          "DMで質問いいですか？商品の素材について教えてください。",
        timestamp: "今日 10:00",
        isInbound: true,
        senderName: "中村 健二",
      },
    ],
  },
];
