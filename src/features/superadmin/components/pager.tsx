import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { AppLink } from "@/components/shell/app-link";
import { panelButtonClasses } from "./panel-ui";

const pagerLink = (disabled: boolean) => panelButtonClasses("default", disabled ? "pointer-events-none opacity-40" : undefined);

/** Previous/next links. The backend lists are bare arrays without a total, so the next page is known from an extra row. */
export function Pager({ page, hasNext, hrefFor }: { page: number; hasNext: boolean; hrefFor: (page: number) => string }) {
  if (page === 1 && !hasNext) return null;
  return (
    <nav aria-label="Paginación" className="flex items-center gap-2">
      <AppLink href={hrefFor(page - 1)} scroll={false} indicator={false} aria-label="Página anterior" aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} className={pagerLink(page <= 1)}>
        <CaretLeft size={14} weight="bold" aria-hidden="true" />
      </AppLink>
      <span className="text-label tabular-nums text-fg-muted">Pág. {page}</span>
      <AppLink href={hrefFor(page + 1)} scroll={false} indicator={false} aria-label="Página siguiente" aria-disabled={!hasNext} tabIndex={!hasNext ? -1 : undefined} className={pagerLink(!hasNext)}>
        <CaretRight size={14} weight="bold" aria-hidden="true" />
      </AppLink>
    </nav>
  );
}
