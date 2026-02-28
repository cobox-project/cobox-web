import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border text-foreground",
        instagram: "bg-channel-instagram/10 text-channel-instagram",
        line: "bg-channel-line/10 text-channel-line",
        email: "bg-channel-email/10 text-channel-email",
        facebook: "bg-channel-facebook/10 text-channel-facebook",
        open: "bg-status-open/10 text-status-open",
        pending: "bg-status-pending/10 text-status-pending",
        resolved: "bg-status-resolved/10 text-status-resolved",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
