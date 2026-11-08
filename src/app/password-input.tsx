"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  inputClassName?: string;
};

export function PasswordInput({ inputClassName = "", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="password-input-wrap">
      <input {...props} className={`password-input-control ${inputClassName}`.trim()} type={visible ? "text" : "password"} />
      <button
        className="password-input-toggle"
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
      </button>
    </span>
  );
}
