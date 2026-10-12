"use client";

import Image from "next/image";
import { useState } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { Copy } from "@phosphor-icons/react/dist/ssr/Copy";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr/WhatsappLogo";
import { ShareNetwork } from "@phosphor-icons/react/dist/ssr/ShareNetwork";
import { Reveal } from "@/components/motion/reveal";
import { StatusMessage } from "@/components/ui/status-message";
import { invitationText, whatsappShareUrl } from "../domain/groups";
import ticketArt from "../../../../public/asset_ticket.png";

type Props = { code: string; groupName: string; memberCount: number; maxMembers: number };

const ticketButton =
  "tap inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-pill border-(length:--bw) px-5 font-ui text-label font-bold uppercase tracking-wide";

type Feedback = { tone: "success" | "error"; text: string } | null;

/** Membership ticket (cream paper) with the join code, a copy button and a share action. Clipboard use fails soft. */
export function JoinCodeTicket({ code, groupName, memberCount, maxMembers }: Props) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const invitation = invitationText(groupName, code);

  async function copy(text: string, done: () => void) {
    try {
      await navigator.clipboard.writeText(text);
      done();
    } catch {
      setFeedback({ tone: "error", text: "Copiar no está disponible aquí. Selecciona el código y cópialo a mano." });
    }
  }

  const copyCode = () => copy(code, () => {
    setCopied(true);
    setFeedback({ tone: "success", text: "Código copiado." });
    window.setTimeout(() => setCopied(false), 2500);
  });

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: invitation });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copy(invitation, () => setFeedback({ tone: "success", text: "Invitación copiada." }));
  }

  return (
    <section aria-labelledby="ticket-heading" className="grid text-ink [filter:drop-shadow(5px_5px_0_var(--color-ink))] [--focus-ring-color:var(--color-ink)]">
      <div className="ticket-top relative grid gap-3 rounded-t-card bg-cream px-6 pb-6 pt-5">
        <Image
          src={ticketArt}
          alt=""
          width={72}
          height={48}
          sizes="72px"
          aria-hidden="true"
          className="absolute right-4 top-3 h-auto w-[4.5rem] rotate-6 [image-rendering:pixelated]"
        />
        <p id="ticket-heading" className="font-display text-label uppercase tracking-widest">Código de la peña</p>
        <code
          aria-label={`Código de la peña ${code.split("").join(" ")}`}
          className="select-all break-all font-mono text-h1 font-bold tracking-[0.2em] tabular-nums sm:text-display"
        >
          {code}
        </code>
        <p className="text-label">
          Comparte este código para que tus amigos se unan.{" "}
          <span className="tabular-nums">{memberCount} de {maxMembers} plazas ocupadas.</span>
        </p>
      </div>
      <div className="ticket-bottom grid gap-3 rounded-b-card border-t-2 border-dashed border-ink/30 bg-cream px-6 pb-5 pt-5">
        <div aria-hidden="true" className="ticket-barcode h-6 text-ink/70" />
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={copyCode} className={`${ticketButton} border-transparent bg-ink text-cream hover-fine:bg-surface-2 hover-fine:text-ink hover-fine:shadow-(--elev-hover)`}>
            <span key={String(copied)} className="pop-in inline-flex items-center gap-2">
              {copied ? <Check size={20} weight="bold" aria-hidden="true" /> : <Copy size={20} weight="bold" aria-hidden="true" />}
              {copied ? "Copiado" : "Copiar código"}
            </span>
          </button>
          <button type="button" onClick={share} className={`${ticketButton} border-ink bg-transparent text-ink hover-fine:bg-ink/10 hover-fine:shadow-(--elev-hover)`}>
            <ShareNetwork size={20} weight="bold" aria-hidden="true" />
            Compartir
          </button>
          <a
            href={whatsappShareUrl(groupName, code)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${ticketButton} border-ink bg-transparent text-ink no-underline hover-fine:bg-ink/10 hover-fine:shadow-(--elev-hover) sm:col-span-2`}
          >
            <WhatsappLogo size={20} weight="bold" aria-hidden="true" />
            Compartir por WhatsApp
          </a>
        </div>
        <Reveal>{feedback && <StatusMessage tone={feedback.tone}>{feedback.text}</StatusMessage>}</Reveal>
      </div>
    </section>
  );
}
