import { createClient } from 'jsr:@supabase/supabase-js@2';

type StorageContext = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string | null;
  storageBucket: string;
  ownerId?: string | null;
};

const parseStorageObjectKey = (url: string, bucket: string): string | null => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const encodedBucket = bucket.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const signMatch = path.match(new RegExp(`/storage/v1/object/(?:sign|public|authenticated)/${encodedBucket}/(.+)`));
    if (signMatch?.[1]) return decodeURIComponent(signMatch[1]);
    const directMatch = path.match(new RegExp(`/storage/v1/object/${encodedBucket}/(.+)`));
    if (directMatch?.[1]) return decodeURIComponent(directMatch[1]);
    return null;
  } catch {
    return null;
  }
};

export const createStorageHelpers = (context: StorageContext) => {
  const uploadImageToStorage = async (
    imageBase64: string,
    contentType: string = 'image/png',
    ownerId?: string | null
  ): Promise<string | null> => {
    if (!imageBase64) return null;
    if (!context.supabaseServiceRoleKey) {
      console.warn('[api] storage upload skipped: SUPABASE_SERVICE_ROLE_KEY not set');
      return null;
    }

    try {
      const adminClient = createClient(context.supabaseUrl, context.supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const extension = contentType.split('/')[1] || 'png';
      const resolvedOwnerId = ownerId ?? context.ownerId ?? 'guest';
      const objectKey = `${resolvedOwnerId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));

      const { error: uploadError } = await adminClient.storage
        .from(context.storageBucket)
        .upload(objectKey, bytes, {
          contentType,
          upsert: false,
          cacheControl: '31536000', // 1 year
        });

      if (uploadError) {
        console.warn('[api] storage upload failed', uploadError);
        return null;
      }

      const { data: signed, error: signedErr } = await adminClient.storage
        .from(context.storageBucket)
        .createSignedUrl(objectKey, 60 * 60 * 24 * 365); // 1 year

      if (!signedErr && signed?.signedUrl) return signed.signedUrl;

      const { data: publicUrl } = adminClient.storage.from(context.storageBucket).getPublicUrl(objectKey);
      if (publicUrl?.publicUrl) return publicUrl.publicUrl;
    } catch (storageErr) {
      console.warn('[api] storage upload exception', storageErr);
    }

    return null;
  };

  const deleteImageFromStorage = async (imageUrl: string, ownerId?: string | null): Promise<boolean> => {
    if (!context.supabaseServiceRoleKey) {
      console.warn('[api] deleteImageFromStorage skipped: SUPABASE_SERVICE_ROLE_KEY not set');
      return false;
    }

    const objectKey = parseStorageObjectKey(imageUrl, context.storageBucket);
    if (!objectKey) {
      return false;
    }

    const resolvedOwnerId = ownerId ?? context.ownerId ?? null;
    if (!resolvedOwnerId || !objectKey.startsWith(`${resolvedOwnerId}/`)) {
      console.warn('[api] deleteImageFromStorage skipped: unauthorized request for object', {
        objectKey,
        ownerId: resolvedOwnerId ?? null,
      });
      return false;
    }

    try {
      const adminClient = createClient(context.supabaseUrl, context.supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await adminClient.storage.from(context.storageBucket).remove([objectKey]);
      if (error) {
        console.warn('[api] deleteImageFromStorage error', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('[api] deleteImageFromStorage exception', err);
      return false;
    }
  };

  return { uploadImageToStorage, deleteImageFromStorage };
};
