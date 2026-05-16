import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { PasswordField } from "../../components/PasswordField";

export function ProfilePage() {
  const { session, refreshSession } = useAuth();
  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  const loadProfile = useCallback(async () => {
    const res = await window.pos?.getProfile?.();
    if (res?.ok) {
      setProfile(res.user);
      setDisplayName(res.user.displayName);
      setEmail(res.user.email || "");
      setPhone(res.user.phone || "");
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (!session) return null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-semibold uppercase text-zinc-500">Profile</h3>
        <p className="mb-3 text-xs text-zinc-500">
          Role: <span className="capitalize text-zinc-800 dark:text-zinc-200">{session.role}</span>
        </p>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            setMsg(null);
            const res = await window.pos.updateProfile({ displayName, email, phone });
            if (res.ok) {
              setMsg("Profile saved.");
              void refreshSession();
            } else setErr(res.error);
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium">Display name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full rounded-md border px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-950" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Profile photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async () => {
                  const dataUrl = reader.result;
                  if (typeof dataUrl !== "string") return;
                  const res = await window.pos.uploadProfileImage({ dataUrl });
                  if (res.ok) {
                    setMsg("Photo updated.");
                    setProfile((p) => ({ ...p, profileImage: res.profileImage }));
                  } else setErr(res.error);
                };
                reader.readAsDataURL(file);
              }}
              className="text-xs"
            />
          </div>
          {msg ? <p className="text-sm text-emerald-600">{msg}</p> : null}
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          <button type="submit" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white">
            Save profile
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-3 text-sm font-semibold uppercase text-zinc-500">Change password</h3>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            const res = await window.pos.changePassword({
              currentPassword: pw.current,
              newPassword: pw.next,
              confirmPassword: pw.confirm
            });
            if (res.ok) {
              setMsg("Password changed.");
              setPw({ current: "", next: "", confirm: "" });
            } else setErr(res.error);
          }}
        >
          <PasswordField label="Current password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
          <PasswordField label="New password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
          <PasswordField label="Confirm new password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} />
          <button type="submit" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-600">
            Update password
          </button>
        </form>
      </section>
    </div>
  );
}
