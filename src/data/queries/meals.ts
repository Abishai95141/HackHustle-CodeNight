import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/data/client';

export type MealSession = {
  id: string;
  meal_type: string;
  display_name: string;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean | null;
  claimed: number;
};

export function useMealSessions() {
  return useQuery({
    queryKey: ['admin', 'meals'],
    queryFn: async (): Promise<MealSession[]> => {
      const [sessionsRes, txRes] = await Promise.all([
        supabase.from('meal_sessions').select('*').order('created_at', { ascending: false }),
        supabase.from('meal_transactions').select('meal_type'),
      ]);
      if (sessionsRes.error) throw sessionsRes.error;
      if (txRes.error) throw txRes.error;
      const counts = new Map<string, number>();
      for (const t of txRes.data ?? []) counts.set(t.meal_type, (counts.get(t.meal_type) ?? 0) + 1);
      return (sessionsRes.data ?? []).map((s) => ({ ...s, claimed: counts.get(s.meal_type) ?? 0 }));
    },
  });
}

export function useActiveMealSessions() {
  return useQuery({
    queryKey: ['meals', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meal_sessions')
        .select('*')
        .eq('is_active', true)
        .order('display_name');
      if (error) throw error;
      return data ?? [];
    },
  });
}
