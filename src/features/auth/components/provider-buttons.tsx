import { Divider } from "@/components/ui/divider";
import { OAUTH_PROVIDERS } from "../domain/oauth";
import { enabledProviders } from "../server/oauth-config";
import { ProviderList } from "./provider-list";

/** Server component: both providers are always shown; unconfigured ones render disabled with a helper. */
export function ProviderButtons() {
  const enabled = new Set(enabledProviders());
  const providers = OAUTH_PROVIDERS.map((id) => ({ id, enabled: enabled.has(id) }));
  return (
    <section aria-label="Continuar con otra cuenta" className="grid gap-4">
      <Divider label="o" />
      <ProviderList providers={providers} />
    </section>
  );
}
