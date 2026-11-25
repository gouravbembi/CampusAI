import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-[#284c40]",
        outline: "border border-border bg-card text-foreground hover:bg-muted",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);
