import { supabase } from '@/lib/supabase';

export async function deleteLucidTrainerCloudData(): Promise<void> {
  const { error } = await supabase.rpc('delete_lucid_trainer_data');
  if (error) throw new Error(error.message || 'Unable to delete Lucid Trainer cloud data');
}
