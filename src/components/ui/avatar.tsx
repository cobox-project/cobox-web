"use client";

import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string;
  alt?: string;
  fallback: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
};

export function Avatar({ src, alt, fallback, className, size = "md" }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt || fallback}
        className={cn(
          "rounded-full object-cover shrink-0",
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full shrink-0 flex items-center justify-center font-medium bg-secondary text-secondary-foreground",
        sizeClasses[size],
        className
      )}
    >
      {fallback.slice(0, 2).toUpperCase()}
    </div>
  );
}
