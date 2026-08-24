import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--brand)] text-white",
        secondary:
          "border-transparent bg-[var(--surface-2)] text-[var(--text-secondary)]",
        good: "border-transparent bg-[var(--good-bg)] text-[var(--good)]",
        critical: "border-transparent bg-[var(--critical-bg)] text-[var(--critical)]",
        outline: "border-[var(--border)] text-[var(--text-primary)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
