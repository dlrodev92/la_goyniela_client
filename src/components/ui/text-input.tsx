import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlClasses } from "./field";

export type TextInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  type?: "text" | "email" | "tel" | "url" | "search" | "number";
};

export function TextInput({ type = "text", className, ...rest }: TextInputProps) {
  return <input {...rest} type={type} className={cn(controlClasses, className)} />;
}
