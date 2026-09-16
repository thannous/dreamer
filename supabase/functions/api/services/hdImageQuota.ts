type Client = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

export async function reserveHdImageCredit(client: Client, userId: string | null, jobId: string) {
  if (!userId) throw Object.assign(new Error('High resolution requires Plus'), { code: 'HD_IMAGE_PLUS_REQUIRED' });
  const { data, error } = await client.rpc('reserve_hd_image_credit', { p_user_id: userId, p_job_id: jobId });
  if (error || !data || typeof (data as { allowed?: unknown }).allowed !== 'boolean') {
    throw Object.assign(new Error('HD quota unavailable'), { code: 'HD_IMAGE_QUOTA_UNAVAILABLE', isTransient: true });
  }
  const result = data as { allowed: boolean; code?: string };
  if (!result.allowed) {
    throw Object.assign(new Error('High-resolution image allowance unavailable'), {
      code: result.code === 'HD_IMAGE_QUOTA_EXCEEDED' ? result.code : 'HD_IMAGE_PLUS_REQUIRED',
    });
  }
}

export async function finishHdImageCredit(client: Client, jobId: string, success: boolean) {
  const { error } = await client.rpc('finish_hd_image_credit', { p_job_id: jobId, p_success: success });
  if (error) throw Object.assign(new Error('HD credit update failed'), { code: 'HD_IMAGE_QUOTA_UNAVAILABLE', isTransient: true });
}
