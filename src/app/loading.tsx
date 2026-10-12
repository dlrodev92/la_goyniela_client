import { PublicShell } from "@/components/shell/public-shell";
import { LoadingState } from "@/components/shell/loading-state";

export default function Loading() {
  return (
    <PublicShell>
      <LoadingState />
    </PublicShell>
  );
}
