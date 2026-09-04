import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://opfjhvvcqbhtssadtatm.supabase.co';
const supabaseAnonKey = 'sb_publishable_oFrz0-7bYw17VT4U93Raew_tbE0bybG';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);