import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlClasses } from "./field";

export function TextArea({ className, rows = 4, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} rows={rows} className={cn(controlClasses, "resize-y", className)} />;
}
