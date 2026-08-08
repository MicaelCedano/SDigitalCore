import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-11 w-full rounded-[10px] border border-[#d0d5dd] bg-white px-3.5 py-2 text-sm text-[#101828] shadow-xs outline-none placeholder:text-[#98a2b3] transition-[border-color,box-shadow] focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10 disabled:cursor-not-allowed disabled:bg-[#f2f4f7] disabled:text-[#98a2b3]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
