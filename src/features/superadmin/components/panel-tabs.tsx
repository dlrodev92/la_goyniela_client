import { AppLink } from "@/components/shell/app-link";
import { cn } from "@/lib/cn";
import { SUPERADMIN_TABS, type SuperadminTab } from "../domain/tabs";

/** Tab bar as plain links: the tab lives in `?tab=`, only the active tab's data is loaded, and it works without JavaScript. */
export function PanelTabs({ current }: { current: SuperadminTab }) {
  return (
    <nav aria-label="Secciones del panel" className="border-b border-border-soft">
      <ul className="flex gap-1">
        {SUPERADMIN_TABS.map(tab => (
          <li key={tab.key}>
            <AppLink
              href={`/superadmin?tab=${tab.key}`}
              scroll={false}
              indicator={false}
              aria-current={tab.key === current ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex h-9 items-center border-b-2 px-3 text-label no-underline transition-colors duration-(--duration-fast)",
                tab.key === current ? "border-action font-medium text-fg" : "border-transparent text-fg-muted hover-fine:text-fg",
              )}
            >
              {tab.label}
            </AppLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
