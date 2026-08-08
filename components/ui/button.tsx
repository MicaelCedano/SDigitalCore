import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-600/15 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-[#4f46e5] text-white shadow-sm hover:bg-[#4338ca] active:translate-y-px",
        destructive: "bg-[#d92d20] text-white shadow-sm hover:bg-[#b42318] active:translate-y-px",
        outline: "border border-[#d0d5dd] bg-white text-[#344054] shadow-xs hover:border-[#98a2b3] hover:bg-[#f9fafb]",
        secondary: "bg-[#eef2ff] text-[#4338ca] hover:bg-[#e0e7ff]",
        ghost: "text-[#475467] hover:bg-[#f2f4f7] hover:text-[#101828]",
        link: "text-[#4f46e5] underline-offset-4 hover:underline",
        gradient: "bg-[#4f46e5] text-white shadow-sm hover:bg-[#4338ca] active:translate-y-px",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
