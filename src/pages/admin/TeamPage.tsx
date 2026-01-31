import { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Edit2, Trash2, Crown, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { OrganizationMember, OrganizationRole } from '../../types';
import { organizationService } from '../../services/organizationService';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Modal from '../../components/Modal';

const roleIcons: Record<OrganizationRole, any> = {
  owner: Crown,
  admin: Shield,
  member: Users,
  viewer: Eye,
};

const roleColors: Record<OrganizationRole, string> = {
  owner: 'bg-yellow-100 text-yellow-800',
  admin: 'bg-orange-100 text-orange-800',
  member: 'bg-blue-100 text-blue-800',
  viewer: 'bg-gray-100 text-gray-800',
};

export default function TeamPage() {
  const { currentOrganization, currentRole, isPlatformAdmin, user } = useAuth();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<OrganizationMember | null>(null);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<OrganizationRole>('member');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageMembers = isPlatformAdmin || currentRole === 'admin' || currentRole === 'owner';

  useEffect(() => {
    if (currentOrganization) {
      loadMembers();
    }
  }, [currentOrganization]);

  const loadMembers = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const teamMembers = await organizationService.getOrganizationMembers(
        currentOrganization.id
      );
      setMembers(teamMembers);
    } catch (err) {
      console.error('Error loading team members:', err);
      setError('Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!currentOrganization) return;

    try {
      setSaving(true);
      setError(null);

      await organizationService.addMember(currentOrganization.id, newMemberUserId, selectedRole);
      await loadMembers();
      setShowAddModal(false);
      setNewMemberEmail('');
      setSelectedRole('member');
    } catch (err: any) {
      setError(err.message || 'Failed to add member. Make sure the user exists.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editingMember) return;

    try {
      setSaving(true);
      setError(null);
      await organizationService.updateMemberRole(editingMember.id, selectedRole);
      await loadMembers();
      setEditingMember(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) {
      return;
    }

    try {
      await organizationService.removeMember(memberId);
      await loadMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    }
  };

  const openEditModal = (member: OrganizationMember) => {
    setEditingMember(member);
    setSelectedRole(member.role);
  };

  if (!currentOrganization) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Please select an organization first</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Team Members</h1>
          <p className="text-gray-600 mt-2">{currentOrganization.name}</p>
        </div>
        {canManageMembers && (
          <Button onClick={() => setShowAddModal(true)}>
            <UserPlus className="w-5 h-5 mr-2" />
            Add Member
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Joined
              </th>
              {canManageMembers && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {members.map((member) => {
              const RoleIcon = roleIcons[member.role];
              const isCurrentUser = user?.id === member.user_id;

              return (
                <tr key={member.id} className={isCurrentUser ? 'bg-orange-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <Users className="h-5 w-5 text-orange-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {member.user?.email}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-orange-600">(You)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[member.role]}`}
                    >
                      <RoleIcon className="w-3 h-3 mr-1" />
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(member.joined_at).toLocaleDateString()}
                  </td>
                  {canManageMembers && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {!isCurrentUser && (
                          <>
                            <button
                              onClick={() => openEditModal(member)}
                              className="text-orange-600 hover:text-orange-900"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {members.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No team members yet</p>
          {canManageMembers && (
            <Button onClick={() => setShowAddModal(true)} className="mt-4">
              <UserPlus className="w-5 h-5 mr-2" />
              Add Your First Member
            </Button>
          )}
        </div>
      )}

      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setNewMemberEmail('');
            setSelectedRole('member');
            setError(null);
          }}
          title="Add Team Member"
        >
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                User ID
              </label>
              <input
                type="text"
                value={newMemberUserId}
                onChange={(e) => setNewMemberUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="UUID of the user"
              />
              <p className="text-sm text-gray-500 mt-1">
                User must already have an account. You can find their ID in Activity Logs.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as OrganizationRole)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="viewer">Viewer - Read-only access</option>
                <option value="member">Member - Can manage operational data</option>
                <option value="admin">Admin - Can manage configuration</option>
                {currentRole === 'owner' && (
                  <option value="owner">Owner - Full access</option>
                )}
              </select>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleAddMember}
                disabled={saving || !newMemberUserId}
                className="flex-1"
              >
                {saving ? 'Adding...' : 'Add Member'}
              </Button>
              <Button
                onClick={() => {
                  setShowAddModal(false);
                  setNewMemberEmail('');
                  setSelectedRole('member');
                  setError(null);
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {editingMember && (
        <Modal
          isOpen={!!editingMember}
          onClose={() => {
            setEditingMember(null);
            setError(null);
          }}
          title="Update Member Role"
        >
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Member Email
              </label>
              <p className="text-gray-900">{editingMember.user?.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as OrganizationRole)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="viewer">Viewer - Read-only access</option>
                <option value="member">Member - Can manage operational data</option>
                <option value="admin">Admin - Can manage configuration</option>
                {currentRole === 'owner' && (
                  <option value="owner">Owner - Full access</option>
                )}
              </select>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleUpdateRole}
                disabled={saving}
                className="flex-1"
              >
                {saving ? 'Updating...' : 'Update Role'}
              </Button>
              <Button
                onClick={() => {
                  setEditingMember(null);
                  setError(null);
                }}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
