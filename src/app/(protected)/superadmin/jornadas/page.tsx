import { redirect } from "next/navigation";
import { hrefWith } from "@/features/superadmin/components/filter-chips";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Legacy route: the panel is a single page now. Filters and the page carry over. */
export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  redirect(hrefWith("/superadmin", { tab: "jornadas", estado: first(query.estado), eliminadas: first(query.eliminadas), pagina: first(query.pagina) }));
}
