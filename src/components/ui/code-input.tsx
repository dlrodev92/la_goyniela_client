import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlClasses } from "./field";

/** Join/invite code: uppercase, letter-spaced, monospace. Uppercase is visual; normalize on the server too. */
export function CodeInput({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      autoCapitalize="characters"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      {...rest}
      type="text"
      className={cn(controlClasses, "font-mono text-h2 uppercase tracking-[0.3em] tabular-nums", className)}
    />
  );
}
