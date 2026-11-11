/**
 * Pictures made while a guest sit under `guest_<fingerprint>/` in the image
 * bucket. Once the device is linked to an account, the account cannot read
 * that folder (objects are readable by the owner named in their first path
 * segment), so the guest's illustrations went blank after sign-up. They are
 * copied, not moved, into the account's folder: the guest's own links keep
 * working until the dreams are migrated, and a failure loses nothing.
 */

type StorageObjects = {
  list: (
    path: string,
    options?: { limit?: number },
  ) => Promise<{ data: { name: string; id: string | null }[] | null; error: unknown }>;
  copy: (from: string, to: string) => Promise<{ error: unknown }>;
};

export type GuestImageStorage = { from: (bucket: string) => StorageObjects };

/** A guest makes a handful of pictures at most; anything beyond this is not a guest's folder. */
const MAX_ADOPTED_OBJECTS = 100;
/** One path segment only: the fingerprint names a folder and must not reach another. */
const SAFE_FINGERPRINT = /^[A-Za-z0-9_-]{8,128}$/;

export const guestImageFolder = (fingerprint: string): string => `guest_${fingerprint}`;

/**
 * Copies the guest folder of a verified device into the account's folder and
 * returns how many pictures were copied. A picture already there is left as it is.
 */
export async function adoptGuestImages(
  storage: GuestImageStorage,
  bucket: string,
  fingerprint: string,
  userId: string,
): Promise<number> {
  if (!SAFE_FINGERPRINT.test(fingerprint) || !userId) return 0;
  const objects = storage.from(bucket);
  const folder = guestImageFolder(fingerprint);
  const { data, error } = await objects.list(folder, { limit: MAX_ADOPTED_OBJECTS });
  if (error || !data) return 0;

  let adopted = 0;
  for (const entry of data) {
    // Folders are listed with a null id; only files are copied.
    if (!entry.name || entry.id === null) continue;
    const { error: copyError } = await objects.copy(`${folder}/${entry.name}`, `${userId}/${entry.name}`);
    if (!copyError) adopted += 1;
  }
  return adopted;
}
