import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import { API_URL } from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  Search,
  RefreshCcw,
  Eye,
  Trash2,
  X,
  UserRound,
  Shield,
  Users,
  Activity,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  MoreVertical,
} from "lucide-react";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const { logout } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      if (!token) throw new Error("No authentication token found");

      const response = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      setUsers(data);
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
        setTimeout(() => logout(), 800);
        return;
      }
      toast.error("Failed to fetch users.");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      const token = localStorage.getItem("token");

      await axios.patch(
        `${API_URL}/admin/users/${userId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );
      toast.success("Status updated successfully");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const token = localStorage.getItem("token");

      await axios.patch(
        `${API_URL}/admin/users/${userId}`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success("Role updated successfully");
    } catch {
      toast.error("Failed to update role");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

    try {
      const token = localStorage.getItem("token");

      await axios.delete(`${API_URL}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("User deleted successfully");
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const filteredUsers = users
    .filter((user) => {
      const matchesSearch =
        !searchTerm ||
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter = filter === "all" || user.status === filter;

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortBy === "newest")
        return new Date(b.lastActive || 0) - new Date(a.lastActive || 0);
      return new Date(a.lastActive || 0) - new Date(b.lastActive || 0);
    });

  const totalItems = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginated = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  // Stats calculation
  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    suspended: users.filter(u => u.status === 'suspended').length,
    pending: users.filter(u => u.status === 'pending').length,
  };

  const openModal = (user) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'suspended': return 'bg-red-100 text-red-700 border-red-200';
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getRoleBadge = (role) => {
    switch(role) {
      case 'admin': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'moderator': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="relative">
          <div className="animate-spin h-16 w-16 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Users className="text-blue-600" size={24} />
          </div>
        </div>
        <p className="mt-4 text-gray-600 font-medium">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                User Management
              </h1>
              <p className="text-gray-600 mt-1">Manage and monitor all user accounts</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Users className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Active</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.active}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Activity className="text-emerald-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Suspended</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{stats.suspended}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertCircle className="text-red-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Pending</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{stats.pending}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <Shield className="text-amber-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1 ">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Filter */}
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-11 pr-8 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer min-w-[150px]"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white cursor-pointer min-w-[150px]"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={fetchUsers}
                className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl flex items-center gap-2 hover:shadow-lg transition-all font-medium"
              >
                <RefreshCcw size={18} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Last Active
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <Users size={48} className="mb-3 opacity-50" />
                        <p className="text-lg font-medium">No users found</p>
                        <p className="text-sm mt-1">Try adjusting your search or filters</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
                            {user.name?.charAt(0).toUpperCase() || <UserRound size={20} />}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{user.name}</div>
                            <div className="text-gray-500 text-sm">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${getRoleBadge(user.role)} cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          <option value="moderator">Moderator</option>
                        </select>
                      </td>

                      <td className="px-6 py-4">
                        <select
                          value={user.status}
                          onChange={(e) => handleStatusChange(user.id, e.target.value)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${getStatusColor(user.status)} cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                          <option value="pending">Pending</option>
                        </select>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                            <span>{user.messagesScanned || 0} scanned</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-red-600">
                            <div className="h-2 w-2 rounded-full bg-red-500"></div>
                            <span>{user.spamDetected || 0} spam</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-600">
                        {user.lastActive ? new Date(user.lastActive).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : "Never"}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal(user)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete User"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
                  <span className="font-medium">{Math.min(startIndex + itemsPerPage, totalItems)}</span> of{" "}
                  <span className="font-medium">{totalItems}</span> users
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <div className="flex gap-1">
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === i + 1
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-white border border-gray-200'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Modal */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur text-white flex items-center justify-center font-bold text-lg">
                  {selectedUser.name?.charAt(0).toUpperCase() || <UserRound size={24} />}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">User Details</h3>
                  <p className="text-blue-100 text-sm">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={24} className="text-white" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</label>
                    <p className="mt-1 text-gray-900 font-medium">{selectedUser.name}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Address</label>
                    <p className="mt-1 text-gray-900 font-medium">{selectedUser.email}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</label>
                    <div className="mt-1">
                      <span className={`inline-flex px-3 py-1 rounded-lg text-sm font-medium border ${getRoleBadge(selectedUser.role)}`}>
                        {selectedUser.role}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                    <div className="mt-1">
                      <span className={`inline-flex px-3 py-1 rounded-lg text-sm font-medium border ${getStatusColor(selectedUser.status)}`}>
                        {selectedUser.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Messages Scanned</label>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{selectedUser.messagesScanned || 0}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Spam Detected</label>
                    <p className="mt-1 text-2xl font-bold text-red-600">{selectedUser.spamDetected || 0}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Active</label>
                    <p className="mt-1 text-gray-900 font-medium">
                      {selectedUser.lastActive 
                        ? new Date(selectedUser.lastActive).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })
                        : "Never"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="flex gap-2 items-center px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-md hover:bg-gray-50 font-medium transition-colors"
              >
                <X size={18} className="text-gray-700" />
                Close
              </button>
              <button
                onClick={() => {
                  handleDeleteUser(selectedUser.id);
                  closeModal();
                }}
                className="flex gap-2 items-center px-5 py-2.5 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium transition-colors"
              >
                <Trash2 size={18} />
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;