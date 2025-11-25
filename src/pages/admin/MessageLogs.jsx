import { useState, useEffect } from "react";
import DataTable from "../../components/admin/DataTable";
import axios from "axios";
import { API_URL } from "../../config/api";
import { toast } from "react-toastify";

const MessageLogs = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    isSpam: "all",
    type: "all",
  });

  const fetchMessages = async () => {
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
  };

  useEffect(() => {
    fetchMessages();
  }, [filters]);

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
      accessor: "user.name",
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
      Cell: ({ value }) => {
        const percent = Math.round((value || 0) * 100);
        return (
          <div className="flex items-center">
            <span className="mr-2">{percent}%</span>
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  percent > 75
                    ? "bg-red-500"
                    : percent > 40
                    ? "bg-yellow-500"
                    : "bg-green-500"
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
        <button
          onClick={() => {
            setSelectedMessage(row.original);
            setShowModal(true);
          }}
          className="text-sm text-blue-600"
        >
          View
        </button>
      ),
    },
  ];

  const [showModal, setShowModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Message Logs</h1>
        <p className="text-gray-500">View history of all scanned messages</p>
      </div>

      <DataTable
        data={messages}
        columns={columns}
        title="Message History"
        pagination
        initialItemsPerPage={10}
        actions={<FilterActions />}
      />

      {showModal && selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg w-full max-w-2xl p-6">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-semibold">Message Details</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500"
              >
                Close
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
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageLogs;
