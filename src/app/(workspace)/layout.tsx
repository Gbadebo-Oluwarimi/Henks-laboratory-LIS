import { redirect } from "next/navigation";
import { AppShell } from "@/app/(workspace)/app-shell";
import { ConfigurationError, getDatabase } from "@/lib/mongodb";
import { getCurrentUser, hasPermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getCurrentUser();
    await getDatabase();
  } catch (error) {
    const message = error instanceof ConfigurationError
      ? error.message
      : "MongoDB could not be reached. Check the MONGODB_URI environment variable and database network access.";
    return (
      <main className="configuration-page">
        <section className="configuration-panel">
          <p className="eyebrow">DATABASE CONNECTION</p>
          <h1>Workspace not connected</h1>
          <p>{message}</p>
          <a className="button button-secondary" href="/sign-in">Back to sign in</a>
        </section>
      </main>
    );
  }
  if (!user) redirect("/sign-in");
  return <AppShell user={{ name: user.name, role: user.role, canAuthorizeReports: user.canAuthorizeReports, canViewReagents: hasPermission(user, "reagents:view") }}>{children}</AppShell>;
}
