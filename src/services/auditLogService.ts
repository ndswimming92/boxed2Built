import { supabase } from '../lib/supabase';

export type ActionType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'EXPORT'
  | 'IMPORT'
  | 'SEND_EMAIL'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'VIEW'
  | 'APPROVE'
  | 'REJECT'
  | 'SUBMIT';

export type LogStatus = 'success' | 'error' | 'warning';

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string;
  action_type: ActionType;
  table_name: string;
  record_id: string | null;
  record_identifier: string | null;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  changes_summary: string | null;
  ip_address: string | null;
  user_agent: string | null;
  status: LogStatus;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
  organization_id: string;
}

export interface LogActionParams {
  actionType: ActionType;
  tableName: string;
  recordId?: string | null;
  recordIdentifier?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  status?: LogStatus;
  errorMessage?: string | null;
  metadata?: Record<string, any>;
}

export interface AuditLogFilters {
  userId?: string;
  actionType?: ActionType;
  tableName?: string;
  status?: LogStatus;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogStats {
  totalLogs: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
  actionTypeDistribution: Record<ActionType, number>;
  tableDistribution: Record<string, number>;
  mostActiveUsers: Array<{ user_email: string; count: number }>;
}

let cachedOrgId: string | null = null;

async function getOrganizationId(): Promise<string | null> {
  if (cachedOrgId) return cachedOrgId;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const { data } = await supabase
        .from('business_info')
        .select('organization_id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (data?.organization_id) {
        cachedOrgId = data.organization_id;
        return cachedOrgId;
      }
      return null;
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (membership?.organization_id) {
      cachedOrgId = membership.organization_id;
      return cachedOrgId;
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (org?.id) {
      cachedOrgId = org.id;
      return cachedOrgId;
    }
  } catch {
    // ignore
  }

  return null;
}

export async function logAction(params: LogActionParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('No authenticated user found for audit log');
      return;
    }

    const organizationId = await getOrganizationId();
    if (!organizationId) {
      console.warn('No organization found for audit log');
      return;
    }

    const changesSummary = generateChangesSummary(
      params.actionType,
      params.tableName,
      params.recordIdentifier,
      params.oldValues,
      params.newValues
    );

    const logEntry = {
      user_id: user.id,
      user_email: user.email || 'unknown',
      action_type: params.actionType,
      table_name: params.tableName,
      record_id: params.recordId || null,
      record_identifier: params.recordIdentifier || null,
      old_values: params.oldValues || null,
      new_values: params.newValues || null,
      changes_summary: changesSummary,
      ip_address: null,
      user_agent: navigator?.userAgent || null,
      status: params.status || 'success',
      error_message: params.errorMessage || null,
      organization_id: organizationId,
      metadata: {
        ...params.metadata,
        page: window.location.pathname,
        timestamp: new Date().toISOString(),
      },
    };

    const { error } = await supabase
      .from('admin_audit_logs')
      .insert(logEntry);

    if (error) {
      console.error('Failed to log action:', error);
    }
  } catch (error) {
    console.error('Error in audit logging:', error);
  }
}

export async function logPublicAction(params: LogActionParams & { userEmail: string }): Promise<void> {
  try {
    const organizationId = await getOrganizationId();
    if (!organizationId) {
      console.warn('No organization found for public audit log');
      return;
    }

    const changesSummary = generateChangesSummary(
      params.actionType,
      params.tableName,
      params.recordIdentifier,
      params.oldValues,
      params.newValues
    );

    const logEntry = {
      user_id: null,
      user_email: params.userEmail,
      action_type: params.actionType,
      table_name: params.tableName,
      record_id: params.recordId || null,
      record_identifier: params.recordIdentifier || null,
      old_values: params.oldValues || null,
      new_values: params.newValues || null,
      changes_summary: changesSummary,
      ip_address: null,
      user_agent: navigator?.userAgent || null,
      status: params.status || 'success',
      error_message: params.errorMessage || null,
      organization_id: organizationId,
      metadata: {
        ...params.metadata,
        page: window.location.pathname,
        timestamp: new Date().toISOString(),
        public_submission: true,
      },
    };

    const { error } = await supabase
      .from('admin_audit_logs')
      .insert(logEntry);

    if (error) {
      console.error('Failed to log public action:', error);
    }
  } catch (error) {
    console.error('Error in public audit logging:', error);
  }
}

function generateChangesSummary(
  actionType: ActionType,
  tableName: string,
  recordIdentifier: string | null | undefined,
  oldValues: Record<string, any> | null | undefined,
  newValues: Record<string, any> | null | undefined
): string {
  const resourceName = recordIdentifier || 'record';
  const table = formatTableName(tableName);

  switch (actionType) {
    case 'CREATE':
      return `Created new ${table}: ${resourceName}`;

    case 'UPDATE':
      if (oldValues && newValues) {
        const changes = Object.keys(newValues).filter(
          key => JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])
        );
        if (changes.length > 0) {
          return `Updated ${table} "${resourceName}": Changed ${changes.join(', ')}`;
        }
      }
      return `Updated ${table}: ${resourceName}`;

    case 'DELETE':
      return `Deleted ${table}: ${resourceName}`;

    case 'ARCHIVE':
      return `Archived ${table}: ${resourceName}`;

    case 'RESTORE':
      return `Restored ${table}: ${resourceName}`;

    case 'LOGIN':
      return `User logged in to admin portal`;

    case 'LOGOUT':
      return `User logged out of admin portal`;

    case 'EXPORT':
      return `Exported ${table} data`;

    case 'IMPORT':
      return `Imported ${table} data`;

    case 'SEND_EMAIL':
      return `Sent email for ${table}: ${resourceName}`;

    case 'UPLOAD':
      return `Uploaded ${table}: ${resourceName}`;

    case 'DOWNLOAD':
      return `Downloaded ${table}: ${resourceName}`;

    case 'VIEW':
      return `Viewed ${table}: ${resourceName}`;

    case 'APPROVE':
      return `Approved ${table}: ${resourceName}`;

    case 'REJECT':
      return `Rejected ${table}: ${resourceName}`;

    case 'SUBMIT':
      return `Form submitted: ${resourceName}`;

    default:
      return `${actionType} ${table}: ${resourceName}`;
  }
}

function formatTableName(tableName: string): string {
  return tableName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<{
  logs: AuditLog[];
  total: number;
}> {
  try {
    let query = supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters.actionType) {
      query = query.eq('action_type', filters.actionType);
    }

    if (filters.tableName) {
      query = query.eq('table_name', filters.tableName);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }

    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    if (filters.searchQuery) {
      query = query.or(
        `user_email.ilike.%${filters.searchQuery}%,` +
        `record_identifier.ilike.%${filters.searchQuery}%,` +
        `changes_summary.ilike.%${filters.searchQuery}%`
      );
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      throw error;
    }

    return {
      logs: (data || []) as AuditLog[],
      total: count || 0,
    };
  } catch (error) {
    console.error('Error in getAuditLogs:', error);
    throw error;
  }
}

export async function getRecordHistory(
  tableName: string,
  recordId: string
): Promise<AuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .eq('table_name', tableName)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching record history:', error);
      throw error;
    }

    return (data || []) as AuditLog[];
  } catch (error) {
    console.error('Error in getRecordHistory:', error);
    throw error;
  }
}

export async function getUserActivity(userId: string): Promise<AuditLog[]> {
  try {
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching user activity:', error);
      throw error;
    }

    return (data || []) as AuditLog[];
  } catch (error) {
    console.error('Error in getUserActivity:', error);
    throw error;
  }
}

export async function getAuditLogStats(
  dateFrom?: string,
  dateTo?: string
): Promise<AuditLogStats> {
  try {
    let query = supabase
      .from('admin_audit_logs')
      .select('*');

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching audit log stats:', error);
      throw error;
    }

    const logs = (data || []) as AuditLog[];

    const stats: AuditLogStats = {
      totalLogs: logs.length,
      successCount: logs.filter(log => log.status === 'success').length,
      errorCount: logs.filter(log => log.status === 'error').length,
      warningCount: logs.filter(log => log.status === 'warning').length,
      actionTypeDistribution: {} as Record<ActionType, number>,
      tableDistribution: {},
      mostActiveUsers: [],
    };

    logs.forEach(log => {
      stats.actionTypeDistribution[log.action_type] =
        (stats.actionTypeDistribution[log.action_type] || 0) + 1;

      stats.tableDistribution[log.table_name] =
        (stats.tableDistribution[log.table_name] || 0) + 1;
    });

    const userCounts: Record<string, number> = {};
    logs.forEach(log => {
      userCounts[log.user_email] = (userCounts[log.user_email] || 0) + 1;
    });

    stats.mostActiveUsers = Object.entries(userCounts)
      .map(([user_email, count]) => ({ user_email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  } catch (error) {
    console.error('Error in getAuditLogStats:', error);
    throw error;
  }
}

export async function exportAuditLogs(filters: AuditLogFilters = {}): Promise<string> {
  try {
    const { logs } = await getAuditLogs({ ...filters, limit: 10000, offset: 0 });

    const headers = [
      'Timestamp',
      'User Email',
      'Action',
      'Resource',
      'Record',
      'Summary',
      'Status',
      'Error Message',
    ];

    const rows = logs.map(log => [
      new Date(log.created_at).toLocaleString(),
      log.user_email,
      log.action_type,
      log.table_name,
      log.record_identifier || log.record_id || '-',
      log.changes_summary || '-',
      log.status,
      log.error_message || '-',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
  } catch (error) {
    console.error('Error in exportAuditLogs:', error);
    throw error;
  }
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
