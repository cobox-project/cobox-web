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
        open: "bg-foreground/8 text-foreground/70",
        pending: "bg-foreground/6 text-foreground/50",
        resolved: "bg-foreground/5 text-foreground/40",
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
