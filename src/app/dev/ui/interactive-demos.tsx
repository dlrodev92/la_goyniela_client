"use client";

import { useState } from "react";
import { ConfirmSheet } from "@/components/ui/confirm-sheet";
import { PlenoChips } from "@/components/ui/pleno-chips";
import { SignToggle, type Sign } from "@/components/ui/sign-toggle";

export function SignToggleDemo({ disabled }: { disabled?: boolean }) {
  const [value, setValue] = useState<Sign | null>(disabled ? "2" : "X");
  return (
    <SignToggle
      name={disabled ? "demo-sign-disabled" : "demo-sign"}
      legend="Partido 3: Barrio Norte contra Unión Sur"
      value={value}
      onChange={setValue}
      disabled={disabled}
    />
  );
}

export function PlenoDemo() {
  const [values, setValues] = useState<string[]>(["1"]);
  return (
    <PlenoChips
      name="demo-pleno"
      legend="Goles del Real Rondo"
      options={[{ value: "0", label: "0" }, { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "M", label: "M", disabled: true }]}
      values={values}
      onToggle={(value, checked) => setValues((prev) => (checked ? [...prev, value] : prev.filter((v) => v !== value)))}
    />
  );
}

export function ConfirmDemo() {
  const [error, setError] = useState<string | undefined>();
  return (
    <div className="grid gap-3 sm:max-w-xs">
      <ConfirmSheet
        triggerLabel="Eliminar peña..."
        title="Eliminar la peña"
        description="Se elimina Peña El Rondo para todos sus miembros. No se puede deshacer."
        confirmLabel="Sí, eliminar"
        confirmText={{ expected: "Peña El Rondo", label: "Escribe el nombre de la peña para confirmar", name: "confirmName" }}
        action={async () => { await new Promise((r) => setTimeout(r, 800)); setError("No se pudo eliminar. Inténtalo de nuevo."); }}
        error={error}
      />
      <ConfirmSheet
        triggerLabel="Salir de la peña"
        title="Salir de la peña"
        description="Dejarás de ver los pronósticos de Los del Bar Manolo."
        confirmLabel="Salir"
        action={async () => { await new Promise((r) => setTimeout(r, 400)); }}
      />
    </div>
  );
}
