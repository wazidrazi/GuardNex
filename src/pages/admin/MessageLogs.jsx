import { useState, useEffect, useCallback } from "react";
import DataTable from "../../components/admin/DataTable";
import axios from "axios";
import { API_URL } from "../../config/api";
import { toast } from "react-toastify";
import { Eye, Trash2, X } from "lucide-react";

const MessageLogs = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState({
    isSpam: "all",
    type: "all",
  });

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_URL}/admin/messages`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          isSpam: filters.isSpam !== "all" ? filters.isSpam : undefined,
          type: filters.type !== "all" ? filters.type : undefined,
        },
      });

      if (Array.isArray(response.data)) {
        setMessages(response.data);
      } else if (response.data && Array.isArray(response.data.data)) {
        setMessages(response.data.data);
      } else {
        setMessages([]);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error fetching messages:", error);
      setError(error.message);
      setMessages([]);

      if (error.response?.status === 401) {
        toast.error("Session expired. Please login again.");
      } else {
        toast.error("Error loading message logs.");
      }

      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const FilterActions = () => (
    <div className="flex flex-wrap gap-2">
      <select
        className="border border-gray-300 rounded-md text-sm px-3 py-2 bg-white"
        value={filters.isSpam}
        onChange={(e) => handleFilterChange("isSpam", e.target.value)}
      >
        <option value="all">All Messages</option>
        <option value="true">Spam Only</option>
        <option value="false">Not Spam Only</option>
      </select>

      <select
        className="border border-gray-300 rounded-md text-sm px-3 py-2 bg-white"
        value={filters.type}
        onChange={(e) => handleFilterChange("type", e.target.value)}
      >
        <option value="all">All Types</option>
        <option value="email">Email</option>
        <option value="sms">SMS</option>
        <option value="social">Social Media</option>
      </select>
    </div>
  );

  const columns = [
    {
      Header: "User",
      accessor: "user",
      Cell: ({ value }) => {
        const user = value || {};
        const initials = user.name ? user.name.charAt(0).toUpperCase() : "U";
        return (
          <div className="flex items-center gap-3">
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold">
                {initials}
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-medium text-sm">{user.name || "Unknown"}</span>
              <span className="text-xs text-gray-500">{user.email || "N/A"}</span>
            </div>
          </div>
        );
      },
    },
    {
      Header: "Message",
      accessor: "content",
      Cell: ({ value }) => (
        <div className="max-w-xs truncate" title={value}>
          {value}
        </div>
      ),
    },
    {
      Header: "Type",
      accessor: "type",
      Cell: ({ value }) => (
        <span className="capitalize px-2 py-1 text-xs rounded-md bg-gray-100 text-gray-800">
          {value}
        </span>
      ),
    },
    {
      Header: "Status",
      accessor: "is_spam",
      Cell: ({ value }) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            value
              ? "bg-red-100 text-red-800 border border-red-200"
              : "bg-green-100 text-green-800 border border-green-200"
          }`}
        >
          {value ? "Spam ⚠️" : "Not Spam ✅"}
        </span>
      ),
    },
    {
      Header: "Confidence",
      accessor: "confidence",
      Cell: ({ value, row }) => {
        const percent = Math.round((value || 0) * 100);
        const isSpam = row.is_spam;
        return (
          <div className="flex items-center">
            <span className="mr-2">{percent}%</span>
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  isSpam ? "bg-red-500" : "bg-green-500"
                }`}
                style={{ width: `${percent}%` }}
              ></div>
            </div>
          </div>
        );
      },
    },
    {
      Header: "Date",
      accessor: "created_at",
      Cell: ({ value }) => new Date(value).toLocaleString(),
    },
    {
      Header: "Actions",
      accessor: "actions",
      Cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedMessage(row);
              setShowViewModal(true);
            }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setSelectedMessage(row);
              setShowDeleteModal(true);
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Delete message"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;

    try {
      setDeleting(true);
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Authentication required");
        return;
      }

      await axios.delete(`${API_URL}/admin/messages/${selectedMessage.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Message deleted successfully");
      setShowDeleteModal(false);
      setSelectedMessage(null);
      fetchMessages();
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error(error.response?.data?.message || "Error deleting message");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="">
      <div className="mb-6">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent pb-2">
          Message Logs
        </h1>
        <p className="text-gray-600">View history of all scanned messages</p>
      </div>

      <DataTable
        data={messages}
        columns={columns}
        title="Message History"
        pagination
        initialItemsPerPage={10}
        actions={<FilterActions />}
        loading={loading}
        refreshData={fetchMessages}
      />

      {showViewModal && selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg w-full max-w-2xl p-6">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold">Message Details</h3>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <strong>User:</strong> {selectedMessage?.user?.name} (
                {selectedMessage?.user?.email})
              </div>

              <div>
                <strong>Type:</strong> {selectedMessage?.type}
              </div>

              <div>
                <strong>Detected:</strong>{" "}
                {selectedMessage?.is_spam ? "Spam" : "Not Spam"}
              </div>

              <div>
                <strong>Confidence:</strong>{" "}
                {Math.round((selectedMessage?.confidence || 0) * 100)}%
              </div>

              <pre className="pt-3 border-t whitespace-pre-wrap text-sm text-gray-800">
                {selectedMessage?.content}
              </pre>
            </div>

            <div className="mt-6 text-right">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>

            <h3 className="mt-4 text-lg font-semibold text-center">Delete Message</h3>
            <p className="mt-2 text-sm text-gray-600 text-center px-8">
              Are you sure you want to delete this message? This action cannot be undone.
            </p>

            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex gap-2 items-center px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleDeleteMessage}
                disabled={deleting}
                className="flex gap-2 items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              ><Trash2 className="w-4 h-4" />
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageLogs;
