import { supabase } from '@/data/client';
import type { AppRole } from '@/domain/auth/roles';

export type CreateUserInput = {
  email: string;
  password: string;
  name: string;
  team_id?: string | null;
  phone?: string | null;
  tshirt_size?: string | null;
  dietary_restrictions?: string | null;
  role?: AppRole;
};

export type CreateUserResult = {
  userId: string;
  alreadyExists?: boolean;
};

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const { data, error } = await supabase.functions.invoke<CreateUserResult>('create-user', {
    body: input,
  });
  if (error) throw error;
  if (!data) throw new Error('No response from create-user');
  return data;
}

export async function deleteUser(userId: string) {
  const { error } = await supabase.functions.invoke('delete-user', { body: { userId } });
  if (error) throw error;
}

export async function updateUserRole(userId: string, role: AppRole) {
  const { error } = await supabase.from('user_roles').update({ role }).eq('user_id', userId);
  if (error) throw error;
}

export type PurgeUsersResult = { deleted: number; skipped: number };

export async function purgeAllUsers(): Promise<PurgeUsersResult> {
  const { data, error } = await supabase.functions.invoke<PurgeUsersResult>('purge-users', {
    body: {},
  });
  if (error) throw error;
  if (!data) throw new Error('No response from purge-users');
  return data;
}
