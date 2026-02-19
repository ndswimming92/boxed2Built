import { supabase } from '../lib/supabase';

export interface TestIdentifier {
  id: string;
  type: 'name' | 'email';
  value: string;
  notes: string | null;
  created_at: string;
}

export async function getTestIdentifiers(): Promise<TestIdentifier[]> {
  const { data, error } = await supabase
    .from('test_identifiers')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching test identifiers:', error);
    return [];
  }

  return (data || []) as TestIdentifier[];
}

export async function isTestSubmission(name: string, email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('test_identifiers')
    .select('id, type, value');

  if (error || !data || data.length === 0) {
    return false;
  }

  const normalizedName = name.trim().toLowerCase();
  const normalizedEmail = email.trim().toLowerCase();

  return data.some((identifier) => {
    const val = identifier.value.trim().toLowerCase();
    if (identifier.type === 'name') {
      return normalizedName === val;
    }
    if (identifier.type === 'email') {
      return normalizedEmail === val;
    }
    return false;
  });
}

export async function addTestIdentifier(
  type: 'name' | 'email',
  value: string,
  notes?: string
): Promise<TestIdentifier> {
  const { data, error } = await supabase
    .from('test_identifiers')
    .insert({ type, value: value.trim(), notes: notes || null })
    .select()
    .single();

  if (error) {
    console.error('Error adding test identifier:', error);
    throw new Error(`Failed to add test identifier: ${error.message}`);
  }

  return data as TestIdentifier;
}

export async function deleteTestIdentifier(id: string): Promise<void> {
  const { error } = await supabase
    .from('test_identifiers')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting test identifier:', error);
    throw new Error(`Failed to delete test identifier: ${error.message}`);
  }
}
