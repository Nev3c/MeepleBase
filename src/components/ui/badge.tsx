import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary/15 text-amber-700",
        secondary: "bg-muted text-muted-foreground",
        accent: "bg-accent/15 text-green-700",
        owned: "bg-amber-100 text-amber-800",
        wishlist: "bg-blue-100 text-blue-800",
        previously_owned: "bg-slate-100 text-slate-600",
        for_trade: "bg-orange-100 text-orange-800",
        want_to_play: "bg-purple-100 text-purple-800",
        for_sale: "bg-green-100 text-green-800",
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
