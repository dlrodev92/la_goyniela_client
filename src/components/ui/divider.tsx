import { cn } from "@/lib/cn";

export function Divider({ label, className }: { label?: string; className?: string }) {
  if (!label) return <hr className={cn("m-0 border-0 border-t-(length:--bw) border-border-soft", className)} />;
  return (
    <div role="separator" aria-label={label} className={cn("flex items-center gap-3 text-label text-fg-muted", className)}>
      <span aria-hidden="true" className="h-0.5 flex-1 bg-border-soft" />
      <span aria-hidden="true" className="font-bold uppercase tracking-[0.12em]">{label}</span>
      <span aria-hidden="true" className="h-0.5 flex-1 bg-border-soft" />
    </div>
  );
}
