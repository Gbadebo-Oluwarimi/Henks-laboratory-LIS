import { ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { createUser, toggleUserActive, toggleUserReportApproval } from "@/app/actions";
import { deleteUser, updateUserReagentPermissions } from "@/app/(workspace)/users/actions";
import { ConfirmForm } from "@/app/(workspace)/reagents/confirm-form";
import { PasswordInput } from "@/app/password-input";
import { requireUser } from "@/lib/session";
import { getDatabase } from "@/lib/mongodb";
import type { UserRecord, UserRole } from "@/lib/models";
import type { UserPermission } from "@/lib/models";
import { ToastNotification } from "@/app/(workspace)/toast-notification";

const roles: UserRole[] = ["Administrator", "Reception", "Laboratory Staff"];
const reagentPermissionOptions: Array<{ value: UserPermission; label: string }> = [
  { value: "reagents:view", label: "View reagents and lots" },
  { value: "reagents:manage", label: "Manage definitions, departments, and test links" },
  { value: "reagents:receive", label: "Receive and transfer lots" },
  { value: "reagents:verify", label: "Record lot verification" },
  { value: "reagents:approve", label: "Approve or reject lots" },
  { value: "reagents:use", label: "Open lots and record usage" },
  { value: "reagents:adjust", label: "Adjust stock" },
  { value: "reagents:dispose", label: "Dispose of lots" },
];

const errors: Record<string, string> = {
  validation: "Enter a valid name and email, choose a role, and use a password with at least 14 characters.",
  duplicate: "An account with that email already exists, or the account could not be saved.",
  save: "The account could not be saved. Check the database connection and try again.",
  invalid: "You cannot change your own account access here.",
  missing: "That user account could not be found.",
  "invalid-permissions": "The reagent access selection was not valid.",
  "last-active-admin": "You cannot delete the last active administrator. Promote another active account first.",
};

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }>;
}) {
  const currentUser = await requireUser(["Administrator"]);
  const params = await searchParams;
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const noticeCode = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const noticeMessage = noticeCode === "created"
    ? "User account created successfully."
    : noticeCode === "updated"
      ? "User access updated."
      : noticeCode === "permission-updated"
        ? "Report approval permission updated."
        : noticeCode === "reagent-permissions-updated"
          ? "Reagent access updated."
          : noticeCode === "deleted"
            ? "User account deleted."
        : null;
  const database = await getDatabase();
  const users = await database.collection<UserRecord>("users")
    .find({}, { projection: { name: 1, email: 1, role: 1, active: 1, canAuthorizeReports: 1, permissions: 1 } })
    .sort({ name: 1 })
    .toArray();

  return (
    <main className="space-y-5">
      <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#0049B7]">Administration / Access</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#073F9F]">User management</h1>
          <p className="mt-1 text-sm text-slate-500">Create staff accounts and grant report approval separately from their day-to-day role.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 sm:self-auto">
          <UsersRound size={15} /> {users.length} accounts
        </div>
      </header>

      {errorCode && errors[errorCode] && <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{errors[errorCode]}</p>}
      {noticeMessage && <ToastNotification message={noticeMessage} />}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div><h2 className="text-sm font-semibold text-[#073F9F]">Staff accounts</h2><p className="mt-1 text-xs text-slate-500">Inactive accounts cannot sign in.</p></div>
            <ShieldCheck size={17} className="text-[#0049B7]" />
          </div>
          {users.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1060px] text-left text-sm">
                    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3 font-semibold">Name / email</th><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Report approval</th><th className="px-4 py-3 font-semibold">Reagent access</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((staff) => <tr key={staff._id.toString()}>
                    <td className="px-4 py-3"><p className="font-medium text-slate-800">{staff.name}</p><p className="mt-0.5 text-xs text-slate-500">{staff.email}</p></td>
                    <td className="px-4 py-3 text-slate-700">{staff.role}</td>
                    <td className="px-4 py-3">
                      {staff.role === "Administrator" ? <span className="text-xs font-semibold text-emerald-700">Always enabled</span> : <form action={toggleUserReportApproval}>
                        <input type="hidden" name="userId" value={staff._id.toString()} />
                        <button type="submit" className={`rounded px-2.5 py-1 text-[10px] font-semibold ${staff.canAuthorizeReports === true ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`} aria-label={`${staff.canAuthorizeReports === true ? "Revoke" : "Grant"} report approval for ${staff.name}`}>
                          {staff.canAuthorizeReports === true ? "Can approve · Revoke" : "Cannot approve · Grant"}
                        </button>
                      </form>}
                    </td>
                    <td className="px-4 py-3">
                      {staff.role === "Administrator" ? <span className="text-xs font-semibold text-emerald-700">All permissions</span> : (
                        <details className="relative">
                          <summary className="cursor-pointer text-xs font-semibold text-[#073F9F] underline decoration-slate-300 underline-offset-2">
                            {(staff.permissions ?? []).filter((permission) => permission.startsWith("reagents:")).length} granted · Edit
                          </summary>
                          <form action={updateUserReagentPermissions} className="absolute right-0 z-20 mt-2 w-72 space-y-2 border border-slate-200 bg-white p-3 shadow-xl">
                            <input type="hidden" name="userId" value={staff._id.toString()} />
                            {reagentPermissionOptions.map(({ value, label }) => (
                              <label key={value} className="flex items-start gap-2 text-[11px] text-slate-700">
                                <input className="mt-0.5 accent-[#0049B7]" type="checkbox" name="reagentPermissions" value={value} defaultChecked={staff.permissions?.includes(value)} />
                                <span>{label}</span>
                              </label>
                            ))}
                            <button type="submit" className="h-8 w-full bg-blue-500 text-xs font-semibold text-white hover:bg-blue-600">Save reagent access</button>
                          </form>
                        </details>
                      )}
                    </td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${staff.active === false ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{staff.active === false ? "Inactive" : "Active"}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <form action={toggleUserActive}>
                          <input type="hidden" name="userId" value={staff._id.toString()} />
                          <button type="submit" className="text-xs font-semibold text-[#073F9F] underline decoration-slate-300 underline-offset-2 hover:text-[#0049B7] disabled:cursor-not-allowed disabled:text-slate-400" disabled={staff._id.toString() === currentUser._id.toString()}>
                            {staff.active === false ? "Reactivate" : "Deactivate"}
                          </button>
                        </form>
                        <ConfirmForm action={deleteUser} message={`Permanently delete ${staff.name}'s account? They will no longer be able to sign in.`} className="inline">
                          <input type="hidden" name="userId" value={staff._id.toString()} />
                          <button type="submit" className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={staff._id.toString() === currentUser._id.toString()} aria-label={`Delete ${staff.name}`}>
                            Delete
                          </button>
                        </ConfirmForm>
                      </div>
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          ) : <p className="px-4 py-8 text-center text-sm text-slate-500">No staff accounts found.</p>}
        </div>

        <section className="h-fit rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3"><div className="flex items-center gap-2"><UserPlus size={16} className="text-[#0049B7]"/><h2 className="text-sm font-semibold text-[#073F9F]">Add staff account</h2></div><p className="mt-1 text-xs text-slate-500">Share the temporary password securely with the staff member.</p></div>
          <form action={createUser} className="space-y-3 p-4">
            <label className="block text-xs font-medium text-slate-600">Full name<input className="mt-1 block h-10 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#0049B7]" name="name" autoComplete="name" required maxLength={120} /></label>
            <label className="block text-xs font-medium text-slate-600">Email<input className="mt-1 block h-10 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#0049B7]" type="email" name="email" autoComplete="email" required maxLength={254} /></label>
            <label className="block text-xs font-medium text-slate-600">Temporary password<PasswordInput inputClassName="mt-1 block h-10 w-full rounded-md border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#0049B7]" name="password" autoComplete="new-password" required minLength={14} maxLength={256} /><span className="mt-1 block text-[11px] text-slate-400">At least 14 characters.</span></label>
            <label className="block text-xs font-medium text-slate-600">Role<select className="mt-1 block h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0049B7]" name="role" defaultValue="Reception">{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
            <label className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-xs text-slate-700"><input className="mt-0.5 accent-[#0049B7]" type="checkbox" name="canAuthorizeReports" /><span><strong className="block font-semibold">Can approve laboratory reports</strong><span className="mt-1 block text-slate-500">Allows this user to review submitted results and authorize final reports.</span></span></label>
            <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-500 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-600" type="submit"><UserPlus size={15}/>Create account</button>
          </form>
        </section>
      </section>
    </main>
  );
}
