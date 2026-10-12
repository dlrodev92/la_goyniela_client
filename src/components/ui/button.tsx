import { AppLink } from "@/components/shell/app-link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { SpinnerGap } from "@phosphor-icons/react/dist/ssr/SpinnerGap";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "lg";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  className?: string;
  children: ReactNode;
};

type AsButton = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };
type AsLink = CommonProps & { href: string; disabled?: boolean; prefetch?: boolean; transitionTypes?: string[]; "aria-label"?: string; id?: string };

export type ButtonProps = AsButton | AsLink;

const variants: Record<ButtonVariant, string> = {
  // Hover (fine pointers only): a tint or brightness shift plus the shared soft shadow. Buttons never move on hover.
  // Swiss look: ink-edged flat blocks with a hard offset shadow; pressing travels the block onto its shadow (see `tap`).
  // Legacy scope: the shadow token is empty and the edge is transparent, so these read as before.
  primary: "bg-action text-on-action border-edge shadow-hard hover-fine:bg-highlight hover-fine:shadow-(--elev-hover) active:bg-secondary",
  secondary: "bg-surface-1 text-fg border-border-soft shadow-hard hover-fine:bg-highlight hover-fine:text-on-action hover-fine:shadow-(--elev-hover) active:bg-secondary active:text-on-action",
  ghost: "bg-transparent text-fg border-transparent hover-fine:bg-highlight hover-fine:text-on-action active:bg-secondary active:text-on-action",
  danger: "bg-danger text-on-danger border-edge shadow-hard hover-fine:brightness-110 hover-fine:shadow-(--elev-hover) active:brightness-95",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-touch px-5 text-label",
  lg: "min-h-13 px-6 text-body",
};

/** Class list shared by the button and link renderings (also reusable for custom triggers). */
export function buttonClasses({ variant = "primary", size = "md", fullWidth, disabled, className }: {
  variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean; disabled?: boolean; className?: string;
}): string {
  return cn(
    "relative inline-flex items-center justify-center gap-2 rounded-pill border-(length:--bw) font-ui font-bold uppercase tracking-wide no-underline select-none",
    "tap",
    variants[variant],
    sizes[size],
    fullWidth && "w-full",
    disabled && "pointer-events-none cursor-not-allowed opacity-50 shadow-none",
    className,
  );
}

export function Button(props: ButtonProps) {
  const { variant, size, fullWidth, loading, leadingIcon, trailingIcon, className, children } = props;
  const inner = (
    <>
      {/* Content stays in the layout while loading so the button keeps its width. */}
      <span className={cn("inline-flex items-center justify-center gap-2", loading && "invisible")}>
        {leadingIcon}
        <span>{children}</span>
        {trailingIcon}
      </span>
      {loading && (
        <span className="absolute inset-0 inline-flex items-center justify-center" aria-hidden="true">
          <SpinnerGap size={20} weight="bold" className="animate-spin motion-reduce:animate-none" />
        </span>
      )}
    </>
  );

  if (props.href !== undefined) {
    const { href, disabled, prefetch, transitionTypes } = props;
    const classes = buttonClasses({ variant, size, fullWidth, disabled: disabled || loading, className });
    if (disabled) {
      return <span role="link" aria-disabled="true" className={classes}>{inner}</span>;
    }
    return (
      <AppLink href={href} prefetch={prefetch} transitionTypes={transitionTypes} className={classes} aria-busy={loading || undefined} aria-label={props["aria-label"]} id={props.id}>
        {inner}
      </AppLink>
    );
  }

  const {
    variant: _v, size: _s, fullWidth: _f, loading: _l, leadingIcon: _li, trailingIcon: _ti, className: _c, children: _ch,
    type = "button", disabled, ...rest
  } = props;
  void [_v, _s, _f, _l, _li, _ti, _c, _ch];
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, disabled, className })}
    >
      {inner}
    </button>
  );
}
