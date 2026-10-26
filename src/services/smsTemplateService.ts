import { supabase } from '../lib/supabase';
import type { TemplateCategory, TemplateVariable } from '../constants/smsTemplates';

/**
 * Admin > SMS Templates talks to Sent through the manage-sent-templates edge
 * function, which holds the API key. See that function for what each action does.
 */

export interface SavedSmsTemplate {
  id: string;
  created_at: string;
  secret_name: string | null;
  name: string;
  category: TemplateCategory;
  body: string;
  variables: TemplateVariable[];
  sent_template_id: string;
  sent_status: string | null;
  status_checked_at: string | null;
}

export interface TemplatesResponse {
  keyMode: 'live' | 'test' | 'missing' | 'unknown';
  refreshError?: string | null;
  templates: SavedSmsTemplate[];
  sent_template_id?: string;
  secret_name?: string | null;
  recorded?: boolean;
}

// The function answers refusals with a JSON { error } body; invoke() hides it behind a generic message.
async function invoke(body: Record<string, unknown>): Promise<TemplatesResponse> {
  const { data, error } = await supabase.functions.invoke('manage-sent-templates', { body });
  if (error) {
    const response = (error as { context?: Response }).context;
    const detail = response ? await response.json().catch(() => null) : null;
    throw new Error(detail?.error ?? error.message ?? 'Could not reach the template service.');
  }
  if (!data?.success) throw new Error(data?.error ?? 'The template service returned an error.');
  return data as TemplatesResponse;
}

export const refreshSmsTemplates = () => invoke({ action: 'refresh' });

export const submitSmsTemplate = (template: {
  name: string;
  secret_name: string;
  category: TemplateCategory;
  body: string;
  variables: TemplateVariable[];
}) => invoke({ action: 'submit', ...template });
