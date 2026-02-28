import { Inbox } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center bg-background text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
        <Inbox className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="mt-5 text-[15px] font-semibold text-foreground">
        会話を選択
      </h3>
      <p className="mt-1.5 max-w-[240px] text-[13px] leading-relaxed text-muted-foreground">
        左のリストから会話を選択して、メッセージを確認しましょう。
      </p>
    </div>
  );
}
