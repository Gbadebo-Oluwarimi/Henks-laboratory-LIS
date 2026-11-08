import Image from "next/image";
import Link from "next/link";
import { signUpFirstAdmin } from "@/app/actions";
import { AuthLayout } from "@/app/auth-layout";
import { PasswordInput } from "@/app/password-input";
import { labBranding } from "@/lib/branding";
import { getDatabase } from "@/lib/mongodb";

const errorMessages: Record<string, string> = {
  validation: "Enter your name and a valid email. Use a password with at least 14 characters.",
  closed: "Administrator sign-up is closed because an account has already claimed the first administrator position.",
  save: "We could not create the account. Please try again.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  const errorKey = Array.isArray(error) ? error[0] : error;

  let available = false;
  let unavailableMessage = "The database could not confirm registration availability. Check the MONGODB_URI deployment setting and MongoDB network access, then try again.";
  try {
    const database = await getDatabase();
    const users = database.collection("users");
    const lock = await database.collection<{ _id: string; userId: import("mongodb").ObjectId }>("systemLocks").findOne({ _id: "initial-admin" });
    const pendingBootstrap = lock
      ? await users.findOne({ _id: lock.userId, bootstrapAdmin: true, active: false })
      : null;
    available = (await users.countDocuments({})) === 0 || Boolean(pendingBootstrap);
    if (!available) unavailableMessage = "An administrator account already exists. Ask your administrator to create your staff account.";
  } catch (error) {
    const errorCode = error && typeof error === "object" && "code" in error
      ? String(error.code)
      : undefined;
    console.error("Could not check first-administrator registration availability", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorCode,
    });
    // Keep signup closed until the database can safely confirm its state.
  }

  return (
    <AuthLayout compact>
      <section className="sign-in-panel sign-up-panel" aria-labelledby="sign-up-title">
        <Image className="sign-in-logo" src={labBranding.logo} width={360} height={170} alt={labBranding.name} priority />
        <div className="sign-in-copy">
          <p className="eyebrow">INITIAL ACCOUNT SETUP</p>
          <h1 id="sign-up-title">Create administrator account</h1>
          <p>The first account becomes the laboratory administrator and is ready to use as soon as it is created.</p>
        </div>
        {errorKey && <p className="form-alert" role="alert">{errorMessages[errorKey] ?? "Unable to complete sign-up. Please try again."}</p>}
        {available ? (
          <form action={signUpFirstAdmin} className="form-stack">
            <label className="field">
              <span>Full name</span>
              <input name="name" type="text" autoComplete="name" required minLength={2} maxLength={120} />
            </label>
            <label className="field">
              <span>Email address</span>
              <input name="email" type="email" autoComplete="email" required maxLength={254} />
            </label>
            <label className="field">
              <span>Password</span>
              <PasswordInput name="password" autoComplete="new-password" required minLength={14} maxLength={256} />
            </label>
            <p className="muted-note">Use at least 14 characters.</p>
            <button className="button button-primary sign-in-submit" type="submit">Create administrator</button>
          </form>
        ) : (
          <p className="form-alert" role="status">{unavailableMessage}</p>
        )}
        <p className="sign-in-footnote"><Link className="text-link" href="/sign-in">Return to sign in</Link></p>
      </section>
    </AuthLayout>
  );
}
