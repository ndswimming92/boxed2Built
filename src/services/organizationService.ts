import { supabase } from '../lib/supabase';
import { Organization, OrganizationMember, OrganizationRole } from '../types';

export const organizationService = {
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const { data: memberships, error: membershipsError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (membershipsError) throw membershipsError;
    if (!memberships || memberships.length === 0) return [];

    const orgIds = memberships.map(m => m.organization_id);

    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('*')
      .in('id', orgIds)
      .order('created_at', { ascending: false });

    if (orgsError) throw orgsError;
    return orgs as Organization[];
  },

  async getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    const { data, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('joined_at', { ascending: false });

    if (error) throw error;
    return data as OrganizationMember[];
  },

  async getUserRole(userId: string, organizationId: string): Promise<OrganizationRole | null> {
    const { data, error } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data?.role || null;
  },

  async createOrganization(name: string, slug: string): Promise<Organization> {
    const { data, error } = await supabase
      .from('organizations')
      .insert({ name, slug, is_active: true })
      .select()
      .single();

    if (error) throw error;
    return data as Organization;
  },

  async updateOrganization(id: string, updates: Partial<Organization>): Promise<Organization> {
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Organization;
  },

  async addMember(
    organizationId: string,
    userId: string,
    role: OrganizationRole = 'member'
  ): Promise<OrganizationMember> {
    const { data, error } = await supabase
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        role,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data as OrganizationMember;
  },

  async updateMemberRole(
    memberId: string,
    role: OrganizationRole
  ): Promise<OrganizationMember> {
    const { data, error } = await supabase
      .from('organization_members')
      .update({ role })
      .eq('id', memberId)
      .select()
      .single();

    if (error) throw error;
    return data as OrganizationMember;
  },

  async removeMember(memberId: string): Promise<void> {
    const { error } = await supabase
      .from('organization_members')
      .update({ is_active: false })
      .eq('id', memberId);

    if (error) throw error;
  },

  async deleteOrganization(id: string): Promise<void> {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async isPlatformAdmin(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    return user.app_metadata?.is_platform_admin === true;
  },

  async getAllOrganizations(): Promise<Organization[]> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Organization[];
  },
};
