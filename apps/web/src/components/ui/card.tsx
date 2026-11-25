import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Adapted from the shadcn/ui New York Card for semantic role summaries.
export function Card({ className, ...props }: ComponentProps<"article">) {
  return (
    <article
      data-slot="card"
      className={cn("flex flex-col rounded-2xl border border-border bg-card shadow-sm", className)}
      {...props}
    />
  );
}
