export type ApiContext = {
  req: Request;
  supabase: any;
  user: any | null;
  supabaseUrl: string;
  supabaseServiceRoleKey: string | null;
  storageBucket: string;
};
