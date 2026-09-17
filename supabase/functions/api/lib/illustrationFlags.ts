export const isHdIllustrationsEnabled = (
  readEnv: (name: string) => string | undefined = (name) => Deno.env.get(name)
): boolean => readEnv('HD_ILLUSTRATIONS_ENABLED') === 'true';

export const requireHdIllustrationsEnabled = () => {
  if (!isHdIllustrationsEnabled()) {
    throw Object.assign(new Error('High-resolution illustrations are disabled'), { code: 'HD_IMAGE_DISABLED' });
  }
};
