"use client";

import { useActionState, useEffect, useState } from "react";
import { ImageSquare } from "@phosphor-icons/react/dist/ssr/ImageSquare";
import { Trash } from "@phosphor-icons/react/dist/ssr/Trash";
import { UploadSimple } from "@phosphor-icons/react/dist/ssr/UploadSimple";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";
import { StatusMessage } from "@/components/ui/status-message";
import { removeAvatarAction, uploadAvatarAction } from "../server/actions";
import { AVATAR_ACCEPT, avatarProblemMessages, checkAvatar, initialAvatarState } from "../domain/profile";

export function AvatarForm({ hasAvatar }: { hasAvatar: boolean }) {
  const [state, upload, uploading] = useActionState(uploadAvatarAction, initialAvatarState);
  const [removed, remove, removing] = useActionState(removeAvatarAction, initialAvatarState);
  const [localError, setLocalError] = useState("");
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  // Revokes the object URL whenever the selection changes and on unmount.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  const pending = uploading || removing;
  const message = localError || (removing ? "" : removed.message) || state.message;
  const failed = localError !== "" || (removing ? false : removed.status === "error") || state.status === "error";
  return (
    <div className="grid gap-4">
      <form action={upload} className="grid gap-4" aria-describedby="avatar-status">
        <div className="grid gap-2">
          <input
            id="avatar"
            name="avatar"
            type="file"
            accept={AVATAR_ACCEPT}
            required
            disabled={pending}
            aria-describedby={localError ? "avatar-hint avatar-error" : "avatar-hint"}
            aria-invalid={localError ? true : undefined}
            className="peer sr-only"
            onChange={event => {
              const file = event.target.files?.[0];
              const problem = file ? checkAvatar(file) : null;
              setFileName(file ? file.name : "");
              setLocalError(problem ? avatarProblemMessages[problem] : "");
              setPreviewUrl(file && !problem ? URL.createObjectURL(file) : "");
            }}
          />
          {previewUrl && (
            <div className="pop-in flex justify-center">
              <Avatar name={fileName} alt="Vista previa de tu nueva foto" src={previewUrl} size="xl" />
            </div>
          )}
          <label
            htmlFor="avatar"
            className="inline-flex min-h-touch cursor-pointer items-center justify-center gap-2 rounded-pill border border-border-soft bg-surface-1 px-5 font-ui text-label font-bold uppercase tracking-wide text-fg tap hover-fine:border-action hover-fine:bg-action/10 hover-fine:shadow-(--elev-hover) peer-ring peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
          >
            <ImageSquare size={20} weight="bold" aria-hidden="true" />
            Elegir imagen
          </label>
          <p className="break-all text-label text-fg-muted" aria-live="polite">
            {fileName ? <>Archivo seleccionado: <span className="font-bold text-fg">{fileName}</span></> : "Ninguna imagen seleccionada"}
          </p>
          <p id="avatar-hint" className="text-meta text-fg-muted">PNG, JPEG o WebP, de hasta 5 MB.</p>
          <Reveal className="[--reveal-gap:0.5rem]">{localError && <p id="avatar-error" className="text-label text-danger">{localError}</p>}</Reveal>
        </div>
        <Button type="submit" fullWidth loading={uploading} disabled={pending || localError !== ""} leadingIcon={<UploadSimple size={20} weight="bold" aria-hidden="true" />}>
          Subir foto
        </Button>
      </form>
      {hasAvatar && (
        <form action={remove}>
          <Button type="submit" variant="secondary" fullWidth loading={removing} disabled={pending} leadingIcon={<Trash size={20} weight="bold" aria-hidden="true" />}>
            Quitar foto
          </Button>
        </form>
      )}
      <Reveal id="avatar-status" className="[--reveal-gap:1rem]">{message && !localError && <StatusMessage tone={failed ? "error" : "success"}>{message}</StatusMessage>}</Reveal>
    </div>
  );
}
