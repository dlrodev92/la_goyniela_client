"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye } from "@phosphor-icons/react/dist/ssr/Eye";
import { EyeSlash } from "@phosphor-icons/react/dist/ssr/EyeSlash";
import { cn } from "@/lib/cn";
import { controlClasses } from "./field";

export function PasswordInput({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeSlash : Eye;
  return (
    <div className="relative">
      <input {...rest} type={visible ? "text" : "password"} className={cn(controlClasses, "pr-14", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute inset-y-0 right-0 inline-flex w-12 items-center justify-center rounded-control text-fg-muted tap hover-fine:text-fg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-action"
      >
        <Icon size={22} weight="bold" aria-hidden="true" />
      </button>
    </div>
  );
}
