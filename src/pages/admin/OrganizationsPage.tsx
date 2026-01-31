import { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, Edit2, Trash2, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Organization } from '../../types';
import { organizationService } from '../../services/organizationService';
import Button from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import Modal from '../../components/Modal';

export default function OrganizationsPage() {
  const { userOrganizations, isPlatformAdmin, refreshOrganizations } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState({ name: '', slug: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setFormData({ name: '', slug: '' });
    setError(null);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setEditingOrg(null);
    setFormData({ name: '', slug: '' });
    setError(null);
  }, []);

  useEffect(() => {
    loadOrganizations();
  }, [isPlatformAdmin, userOrganizations]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      if (isPlatformAdmin) {
        const allOrgs = await organizationService.getAllOrganizations();
        setOrganizations(allOrgs);
      } else {
        setOrganizations(userOrganizations);
      }
    } catch (err) {
      console.error('Error loading organizations:', err);
      setError('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setSaving(true);
      setError(null);
      await organizationService.createOrganization(formData.name, formData.slug);
      await refreshOrganizations();
      await loadOrganizations();
      handleCloseCreateModal();
    } catch (err: any) {
      setError(err.message || 'Failed to create organization');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingOrg) return;

    try {
      setSaving(true);
      setError(null);
      await organizationService.updateOrganization(editingOrg.id, formData);
      await refreshOrganizations();
      await loadOrganizations();
      handleCloseEditModal();
    } catch (err: any) {
      setError(err.message || 'Failed to update organization');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this organization? This will delete ALL associated data.')) {
      return;
    }

    try {
      await organizationService.deleteOrganization(id);
      await refreshOrganizations();
      await loadOrganizations();
    } catch (err: any) {
      alert(err.message || 'Failed to delete organization');
    }
  };

  const openEditModal = (org: Organization) => {
    setEditingOrg(org);
    setFormData({ name: org.name, slug: org.slug });
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
          <p className="text-gray-600 mt-2">
            {isPlatformAdmin ? 'Manage all organizations' : 'View your organizations'}
          </p>
        </div>
        {isPlatformAdmin && (
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-5 h-5 mr-2" />
            Create Organization
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map((org) => (
          <div
            key={org.id}
            className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <Building2 className="w-8 h-8 text-orange-600 mr-3" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{org.name}</h3>
                  <p className="text-sm text-gray-500">@{org.slug}</p>
                </div>
              </div>
              {org.is_active ? (
                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                  Active
                </span>
              ) : (
                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                  Inactive
                </span>
              )}
            </div>

            <div className="text-sm text-gray-600 mb-4">
              Created: {new Date(org.created_at).toLocaleDateString()}
            </div>

            {isPlatformAdmin && (
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => openEditModal(org)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(org.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {organizations.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">No organizations found</p>
          {isPlatformAdmin && (
            <Button onClick={() => setShowCreateModal(true)} className="mt-4">
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Organization
            </Button>
          )}
        </div>
      )}

      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={handleCloseCreateModal}
          title="Create Organization"
        >
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="My Organization"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL Slug
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="my-organization"
              />
              <p className="text-sm text-gray-500 mt-1">
                Used in URLs. Only lowercase letters, numbers, and hyphens.
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleCreate}
                disabled={saving || !formData.name || !formData.slug}
                className="flex-1"
              >
                {saving ? 'Creating...' : 'Create Organization'}
              </Button>
              <Button
                onClick={handleCloseCreateModal}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {editingOrg && (
        <Modal
          isOpen={!!editingOrg}
          onClose={handleCloseEditModal}
          title="Edit Organization"
        >
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL Slug
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleUpdate}
                disabled={saving || !formData.name || !formData.slug}
                className="flex-1"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                onClick={handleCloseEditModal}
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
