import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import axios from "axios";
import { API_URL } from "../../config/api";
import { useAuth } from "../../contexts/AuthContext";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await axios.get(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];

      setUsers(data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching users:", error);
      if (error.response?.status === 401) {
        toast.error("Your session has expired. Please login again.");
        setTimeout(() => logout(), 800);
        return;
      }
      toast.error("Failed to fetch users: " + (error.message || "Unknown error"));
      setUsers([]);
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId, newStatus) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      await axios.patch(
        `${API_URL}/admin/users/${userId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));
      toast.success("User status updated");
    } catch (error) {
      console.error("Error updating user status:", error);
      toast.error("Failed to update user status");
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      await axios.patch(
        `${API_URL}/admin/users/${userId}`,
        { role: newRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      toast.success("User role updated");
    } catch (error) {
      console.error("Error updating user role:", error);
      toast.error("Failed to update role");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found");

      await axios.delete(`${API_URL}/admin/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("User deleted");
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    }
  };

  const handleRefresh = () => fetchUsers();

  const filteredUsers = users
    .filter((user) => {
      const matchesSearch =
        (!searchTerm ||
          (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())));
      const matchesFilter = filter === "all" || user.status === filter;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.lastActive || 0) - new Date(a.lastActive || 0);
      return new Date(a.lastActive || 0) - new Date(b.lastActive || 0);
    });

  // Pagination
  const totalItems = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginated = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    // If current page becomes out of range after filtering/itemsPerPage change
    if (currentPage > totalPages) setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalItems, itemsPerPage]);

  const openModal = (user) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const closeModal = () => {
    setSelectedUser(null);
    setShowModal(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">User Management</h1>
        <p className="text-gray-500">Manage and monitor user accounts ({users.length} total)</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 md:items-center">
          <div className="flex-1 relative">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200"
            />
          </div>

          <div className="flex gap-3 items-center">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 rounded-md border">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="pending">Pending</option>
            </select>

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2 rounded-md border">
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>

            <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="px-3 py-2 rounded-md border">
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
            </select>

            <button onClick={handleRefresh} className="px-4 py-2 bg-blue-500 text-white rounded-md">Refresh</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {paginated.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Messages</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Last Active</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginated.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium mr-4">
                          {user.name ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase() : "U"}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{user.name || "Unnamed"}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <select value={user.role || "user"} onChange={(e) => handleRoleChange(user.id, e.target.value)} className="px-2 py-1 rounded-md border text-sm">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="moderator">Moderator</option>
                      </select>
                    </td>

                    <td className="px-6 py-4">
                      <select value={user.status || "active"} onChange={(e) => handleStatusChange(user.id, e.target.value)} className="px-2 py-1 rounded-full text-sm">
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                        <option value="pending">Pending</option>
                      </select>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div>{user.messagesScanned || 0} scanned</div>
                      <div className="text-red-600">{user.spamDetected || 0} spam</div>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-500">{user.lastActive ? new Date(user.lastActive).toLocaleString() : "N/A"}</td>

                    <td className="px-6 py-4 text-right space-x-3">
                      <button onClick={() => openModal(user)} className="text-sm text-blue-600">View</button>
                      <button onClick={() => handleDeleteUser(user.id)} className="text-sm text-red-600">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">No users found</div>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-600">Showing {Math.min(totalItems, startIndex + 1)} - {Math.min(totalItems, startIndex + paginated.length)} of {totalItems}</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} className="px-3 py-1 border rounded disabled:opacity-50" disabled={currentPage === 1}>Prev</button>
          <span className="px-2">Page {currentPage} / {totalPages}</span>
          <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} className="px-3 py-1 border rounded disabled:opacity-50" disabled={currentPage === totalPages}>Next</button>
        </div>
      </div>

      {/* Simple Modal for viewing user details */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg w-full max-w-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">User details</h3>
              <button onClick={closeModal} className="text-gray-500">Close</button>
            </div>
            <div className="space-y-3">
              <div><strong>Name:</strong> {selectedUser.name}</div>
              <div><strong>Email:</strong> {selectedUser.email}</div>
              <div><strong>Role:</strong> {selectedUser.role}</div>
              <div><strong>Status:</strong> {selectedUser.status}</div>
              <div><strong>Messages scanned:</strong> {selectedUser.messagesScanned || 0}</div>
              <div><strong>Spam detected:</strong> {selectedUser.spamDetected || 0}</div>
              <div><strong>Last active:</strong> {selectedUser.lastActive ? new Date(selectedUser.lastActive).toLocaleString() : 'N/A'}</div>
            </div>
            <div className="mt-6 text-right">
              <button onClick={closeModal} className="px-4 py-2 bg-gray-200 rounded mr-2">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;