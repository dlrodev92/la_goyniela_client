import type { ReactNode } from "react";
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap";
import { XLogo } from "@phosphor-icons/react/dist/ssr/XLogo";
import { cn } from "@/lib/cn";

export type Provider = "google" | "x";

type ProviderButtonProps = {
  provider: Provider;
  /** Start-of-flow URL, e.g. `/auth/google`. A plain anchor: the route redirects off-site. */
  href: string;
  disabled?: boolean;
  /** Shown under the button, linked via aria-describedby (e.g. "No disponible por ahora"). */
  helperText?: string;
  loading?: boolean;
  className?: string;
};

const labels: Record<Provider, string> = { google: "Continuar con Google", x: "Continuar con X" };

/** Official Google "G" mark (multicolor), as required by Google's sign-in branding rules. */
function GoogleMark(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function ProviderButton({ provider, href, disabled, helperText, loading, className }: ProviderButtonProps) {
  const helperId = helperText ? `provider-${provider}-helper` : undefined;
  const classes = cn(
    "relative inline-flex min-h-13 w-full items-center justify-center gap-3 rounded-pill border-(length:--bw) px-6 text-label font-bold no-underline select-none",
    "tap",
    provider === "google" ? "border-ink bg-[#f8faf6] text-[#1f1f1f]" : "border-ink bg-ink text-white",
    "shadow-hard",
    !disabled && "hover-fine:brightness-95 hover-fine:shadow-(--elev-hover)",
    (disabled || loading) && "cursor-not-allowed opacity-60",
    className,
  );
  const content = (
    <>
      <span className={cn("inline-flex items-center gap-3", loading && "invisible")}>
        {provider === "google" ? <GoogleMark /> : <XLogo size={20} weight="fill" aria-hidden="true" />}
        <span>{labels[provider]}</span>
      </span>
      {loading && (
        <span className="absolute inset-0 inline-flex items-center justify-center" aria-hidden="true">
          <SpinnerGap size={20} weight="bold" className="animate-spin motion-reduce:animate-none" />
        </span>
      )}
    </>
  );
  return (
    <div className="grid gap-2">
      {disabled ? (
        <span role="link" aria-disabled="true" aria-describedby={helperId} className={classes}>{content}</span>
      ) : (
        <a href={href} aria-busy={loading || undefined} aria-describedby={helperId} className={classes}>{content}</a>
      )}
      {helperText && <p id={helperId} className="text-center text-meta text-fg-muted">{helperText}</p>}
    </div>
  );
}
