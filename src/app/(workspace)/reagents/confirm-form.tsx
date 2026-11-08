"use client";

import type { FormEvent, ReactNode } from "react";

export function ConfirmForm({ action, message, className, children }: { action: (formData: FormData) => void | Promise<void>; message: string; className?: string; children: ReactNode }) {
  function confirmSubmit(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(message)) event.preventDefault();
  }

  return <form action={action} className={className} onSubmit={confirmSubmit}>{children}</form>;
}
