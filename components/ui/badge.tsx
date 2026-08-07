import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#5750f1]/10 text-[#5750f1]",
        secondary:
          "border-transparent bg-[#f1f5f9] text-[#64748b]",
        destructive:
          "border-transparent bg-[#f23030]/10 text-[#f23030]",
        outline: "text-[#1c2434] border-[#e2e8f0] bg-white",
        success: "border-transparent bg-[#22ad5c]/10 text-[#22ad5c]",
        warning: "border-transparent bg-[#ff9c55]/10 text-[#d97706]",
        purple: "border-transparent bg-[#805ad5]/10 text-[#805ad5]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
