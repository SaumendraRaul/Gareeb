import { validateState, type State } from "./model";
const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
};
const unb64 = (text: string) =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
async function key(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 310000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptBackup(s: State, password: string) {
  if (password.length < 10 || password.length > 256)
    throw Error("Use a passphrase between 10 and 256 characters.");
  const plaintext = new TextEncoder().encode(JSON.stringify(validateState(s)));
  if (plaintext.length > 20000000)
    throw Error(
      "This backup is too large to encrypt. Reduce receipt attachments or export a plain backup.",
    );
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await key(password, salt),
    plaintext,
  );
  return JSON.stringify({
    format: "gareeb-encrypted",
    version: 1,
    salt: b64(salt),
    iv: b64(iv),
    data: b64(new Uint8Array(ciphertext)),
  });
}
export async function decryptBackup(
  input: unknown,
  password: string,
): Promise<State> {
  const e = input as {
    format?: unknown;
    version?: unknown;
    salt?: unknown;
    iv?: unknown;
    data?: unknown;
  };
  if (
    !e ||
    e.format !== "gareeb-encrypted" ||
    e.version !== 1 ||
    typeof e.salt !== "string" ||
    e.salt.length !== 24 ||
    typeof e.iv !== "string" ||
    e.iv.length !== 16 ||
    typeof e.data !== "string" ||
    e.data.length > 28000000 ||
    e.data.length < 24 ||
    password.length > 256
  )
    throw Error("Invalid encrypted backup.");
  let plaintext;
  try {
    const salt = unb64(e.salt),
      iv = unb64(e.iv);
    if (salt.length !== 16 || iv.length !== 12)
      throw Error("Invalid encryption parameters");
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      await key(password, salt),
      unb64(e.data),
    );
  } catch {
    throw Error("Could not unlock the backup. Check the passphrase and file.");
  }
  return validateState(JSON.parse(new TextDecoder().decode(plaintext)));
}
