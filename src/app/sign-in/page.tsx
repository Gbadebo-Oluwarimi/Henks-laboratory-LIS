import Image from "next/image";
import Link from "next/link";
import { signIn } from "@/app/actions";
import { AuthLayout } from "@/app/auth-layout";
import { PasswordInput } from "@/app/password-input";
import { labBranding } from "@/lib/branding";

const errorMessages: Record<string, string> = {
  credentials: "Email or password is incorrect.",
  configuration: "Sign-in is unavailable. Check the MongoDB and authentication configuration.",
};

const noticeMessages: Record<string, string> = {
  "account-created": "Your administrator account is ready. Sign in with the email and password you just created.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }>;
}) {
  const { error, notice } = await searchParams;
  const errorKey = Array.isArray(error) ? error[0] : error;
  const noticeKey = Array.isArray(notice) ? notice[0] : notice;

  return (
    <AuthLayout>
      <section className="sign-in-panel" aria-labelledby="sign-in-title">
        <Image className="sign-in-logo" src={labBranding.logo} width={360} height={170} alt={labBranding.name} priority />
        <div className="sign-in-copy">
          <p className="eyebrow">STAFF ACCESS</p>
          <h1 id="sign-in-title">Sign in</h1>
          <p>Use your laboratory account to continue.</p>
        </div>
        {errorKey && <p className="form-alert" role="alert">{errorMessages[errorKey] ?? "Unable to sign in. Please try again."}</p>}
        {noticeKey && noticeMessages[noticeKey] && <p className="success-alert" role="status">{noticeMessages[noticeKey]}</p>}
        <form action={signIn} className="form-stack">
          <label className="field">
            <span>Email address</span>
            <input name="email" type="email" autoComplete="username" required maxLength={254} />
          </label>
          <label className="field">
            <span>Password</span>
            <PasswordInput name="password" autoComplete="current-password" required maxLength={256} />
          </label>
          <button className="button button-primary sign-in-submit" type="submit">Sign in</button>
        </form>
        <p className="sign-in-footnote"><Link className="text-link" href="/sign-up">Create the first administrator account</Link></p>
        <p className="sign-in-footnote">Access is provided by your laboratory administrator.</p>
      </section>
    </AuthLayout>
  );
}
