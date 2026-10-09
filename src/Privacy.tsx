import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { type State, day } from "./model";
import { download } from "./storage";
import { encryptBackup, decryptBackup } from "./backup-crypto";
import { requestReminders, syncReminders } from "./reminders";
import { Field, Icon, Logo, Modal } from "./ui";
const Privacy = registerPlugin<{
  status(): Promise<{ enabled: boolean; available: boolean }>;
  authenticate(): Promise<void>;
  setEnabled(options: { enabled: boolean }): Promise<void>;
}>("GareebPrivacy");
const native = Capacitor.isNativePlatform();
export function PrivacyGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(native),
    [ready, setReady] = useState(!native),
    [started, setStarted] = useState(!native),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    enabled = useRef(false),
    authenticating = useRef(false);
  useEffect(() => {
    if (!native) return;
    let alive = true;
    async function status() {
      try {
        const r = await Privacy.status();
        if (alive) {
          enabled.current = r.enabled;
          setLocked(r.enabled);
          if (!r.enabled) setStarted(true);
          setReady(true);
        }
      } catch {
        if (alive) {
          setError(
            "Could not check the device lock. Reopen Gareeb to try again.",
          );
          setReady(true);
        }
      }
    }
    void status();
    const listener = NativeApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive && enabled.current && !authenticating.current)
        setLocked(true);
    });
    const changed = () => {
      void Privacy.status()
        .then((r) => {
          enabled.current = r.enabled;
          if (!r.enabled) {
            setLocked(false);
            setStarted(true);
          }
        })
        .catch(() => setLocked(true));
    };
    window.addEventListener("gareeb-lock-changed", changed);
    return () => {
      alive = false;
      void listener.then((l) => l.remove());
      window.removeEventListener("gareeb-lock-changed", changed);
    };
  }, []);
  async function unlock() {
    if (busy) return;
    setBusy(true);
    authenticating.current = true;
    setError("");
    try {
      await Privacy.authenticate();
      setStarted(true);
      setLocked(false);
    } catch (e) {
      setError((e as Error).message || "Unlock was cancelled.");
    } finally {
      authenticating.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      {started && (
        <div
          style={{ display: !ready || locked ? "none" : undefined }}
          inert={!ready || locked}
          aria-hidden={!ready || locked}
        >
          {children}
        </div>
      )}
      {(!ready || locked) && (
        <main className="privacy-screen">
          <Logo />
          <span className="privacy-seal">
            <Icon name="LockKeyhole" size={34} />
          </span>
          <h1>
            Your space.
            <br />
            Just for you.
          </h1>
          <p>Unlock with your device’s fingerprint, face, or screen lock.</p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button
            className="primary"
            disabled={!ready || busy}
            onClick={() => void unlock()}
          >
            {busy ? "Unlocking…" : "Unlock Gareeb"}
          </button>
        </main>
      )}
    </>
  );
}
export function PrivacySettings({
  s,
  onSave,
  onNotice,
}: {
  s: State;
  onSave: (s: State, m: string) => Promise<boolean>;
  onNotice: (m: string) => void;
}) {
  const [enabled, setEnabled] = useState(false),
    [available, setAvailable] = useState(false),
    [backup, setBackup] = useState(false),
    [busy, setBusy] = useState(false),
    [scheduled, setScheduled] = useState<number | null>(null),
    [status, setStatus] = useState("");
  useEffect(() => {
    if (native) {
      void Privacy.status()
        .then((r) => {
          setEnabled(r.enabled);
          setAvailable(r.available);
        })
        .catch(() => setStatus("Device lock is unavailable."));
      void LocalNotifications.getPending()
        .then((r) => setScheduled(r.notifications.length))
        .catch(() => {});
    }
  }, []);
  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      await Privacy.setEnabled({ enabled: !enabled });
      setEnabled(!enabled);
      window.dispatchEvent(new Event("gareeb-lock-changed"));
      setStatus(
        enabled
          ? "App lock disabled."
          : "App lock enabled. Screenshots and recent-app previews are hidden.",
      );
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reminders() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      if (!s.settings.reminders) await requestReminders();
      const next = {
        ...s,
        settings: { ...s.settings, reminders: !s.settings.reminders },
      };
      if (await onSave(next, "Reminder preference saved.")) {
        const count = await syncReminders(next);
        setScheduled(count);
        setStatus(
          next.settings.reminders
            ? `${count} private bill reminders scheduled.`
            : "Bill reminders disabled.",
        );
      }
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="v2-panel privacy-settings">
      <div className="v2-section-heading">
        <div>
          <h3>A little more peace of mind</h3>
          <p className="form-help">Privacy and reminders, on your terms.</p>
        </div>
        <Icon name="ShieldCheck" size={28} />
      </div>
      <div className="preference-row">
        <span>
          <b>Device app lock</b>
          <small>
            {native
              ? "Fingerprint, face or device screen lock. Hides app previews and screenshots."
              : "Available in the Android app."}
          </small>
        </span>
        <button
          className="secondary"
          disabled={!native || (!available && !enabled) || busy}
          onClick={() => void toggle()}
        >
          {enabled ? "Disable lock" : "Enable lock"}
        </button>
      </div>
      {native && !available && !enabled && (
        <p className="form-help">
          Set up a screen lock in Android settings first.
        </p>
      )}
      <div className="preference-row">
        <span>
          <b>Private bill reminders</b>
          <small>
            {native
              ? `Next occurrence of up to 64 active bills, around 9 AM. ${scheduled !== null ? `${scheduled} currently scheduled.` : ""}`
              : "Available in the Android app."}
          </small>
        </span>
        <button
          className="secondary"
          disabled={!native || s.demo || busy}
          onClick={() => void reminders()}
        >
          {s.settings.reminders ? "Disable reminders" : "Enable reminders"}
        </button>
      </div>
      <p className="form-help">
        Reminders show no amounts or bill names. Android may delay delivery.
        Open Gareeb periodically to refresh schedules; paying or editing a bill
        reschedules its reminder. Demo data never schedules notifications.
      </p>
      <div className="preference-row">
        <span>
          <b>Encrypted backup</b>
          <small>Protect an exported backup with your own passphrase.</small>
        </span>
        <button className="secondary" onClick={() => setBackup(true)}>
          <Icon name="LockKeyhole" size={16} />
          Export
        </button>
      </div>
      <label className="toggle-row">
        <span>
          <b>A little Gareeb humour</b>
          <small>Gentle quips in recaps and expense confirmations.</small>
        </span>
        <input
          role="switch"
          aria-label="Gareeb humour"
          type="checkbox"
          checked={s.settings.humour === true}
          onChange={(e) =>
            void onSave(
              { ...s, settings: { ...s.settings, humour: e.target.checked } },
              "Personality preference saved.",
            )
          }
        />
      </label>
      {status && (
        <p role="status" className="form-help">
          {status}
        </p>
      )}
      {backup && (
        <Modal
          title="Protect your backup"
          onClose={() => {
            if (!busy) setBackup(false);
          }}
        >
          <PasswordForm
            mode="export"
            onSubmit={async (password) => {
              setBusy(true);
              try {
                const content = await encryptBackup(s, password);
                await download(`gareeb-encrypted-${day()}.json`, content);
                setBackup(false);
                onNotice(
                  "Encrypted backup ready. Keep the passphrase separately.",
                );
              } finally {
                setBusy(false);
              }
            }}
          />
        </Modal>
      )}
    </section>
  );
}
export function UnlockBackup({
  envelope,
  onClose,
  onRestore,
}: {
  envelope: unknown;
  onClose: () => void;
  onRestore: (s: State) => void;
}) {
  return (
    <Modal title="Unlock your backup" onClose={onClose}>
      <PasswordForm
        mode="restore"
        onSubmit={async (password) => {
          onRestore(await decryptBackup(envelope, password));
        }}
      />
    </Modal>
  );
}
function PasswordForm({
  mode,
  onSubmit,
}: {
  mode: "export" | "restore";
  onSubmit: (password: string) => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget),
      password = String(f.get("password"));
    setError("");
    if (mode === "export" && password !== f.get("confirm")) {
      setError("The passphrases do not match.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="v2-form" onSubmit={submit}>
      <Field label="Backup passphrase">
        <input
          name="password"
          type="password"
          autoComplete={mode === "export" ? "new-password" : "current-password"}
          minLength={mode === "export" ? 10 : 1}
          maxLength={256}
          required
        />
      </Field>
      {mode === "export" && (
        <Field label="Confirm passphrase">
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={256}
            required
          />
        </Field>
      )}
      <p className="form-help">
        {mode === "export"
          ? "Use at least 10 characters. Gareeb cannot recover a forgotten passphrase. This protects the exported file; app lock is a separate setting."
          : "Your current records stay untouched until you unlock and confirm restoration."}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary full-width" disabled={busy}>
        {busy
          ? "Working…"
          : mode === "export"
            ? "Create encrypted backup"
            : "Unlock backup"}
      </button>
    </form>
  );
}
