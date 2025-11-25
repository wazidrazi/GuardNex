import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../../config/api";
import StatsCard from "../../components/admin/StatsCard";
import { toast } from "react-toastify";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMessages: 0,
    spamCount: 0,
    hamCount: 0,
    spamPercentage: 0,
    messagesByType: {
      email: 0,
      sms: 0,
      social: 0,
    },
    recentActivity: [],
    messagesByPeriod: [],
    accuracyByChannel: {},
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [topUsers, setTopUsers] = useState([]);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("No auth token found");
        }

        console.log("Fetching stats from:", `${API_URL}/admin/stats`);
        
        const response = await axios.get(`${API_URL}/admin/stats`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (isMounted) {
          console.log("Dashboard stats received:", response.data);
          // Normalize different possible API shapes to our expected shape
          const payload = response.data || {};
          const normalized = {
            totalUsers: payload.totalUsers ?? payload.total_users ?? payload.totalUsersCount ?? 0,
            totalMessages: payload.totalMessages ?? payload.total_messages ?? payload.totalMessages ?? 0,
            spamCount: payload.spamCount ?? payload.spam_count ?? payload.spam ?? 0,
            hamCount: payload.hamCount ?? payload.ham_count ?? payload.ham ?? 0,
            spamPercentage: payload.spamPercentage ?? payload.spam_percentage ?? payload.spamRate ?? 0,
            messagesByType: payload.messagesByType ?? payload.by_type ?? payload.byType ?? payload.by_type ?? { email: 0, sms: 0, social: 0 },
            recentActivity: payload.recentActivity ?? payload.recent_activity ?? payload.recent_activity ?? [],
            messagesByPeriod: payload.messagesByPeriod ?? payload.messages_by_period ?? payload.messagesByPeriod ?? [],
            accuracyByChannel: payload.accuracyByChannel ?? payload.accuracy_by_channel ?? payload.accuracyByChannel ?? {},
            // keep original payload for debugging
            _raw: payload,
          };

          setStats(normalized);
          // after getting stats, optionally fetch top users for a quick view
          try {
            const token = localStorage.getItem("token");
            if (token) {
              const usersResp = await axios.get(`${API_URL}/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
              const usersData = Array.isArray(usersResp.data) ? usersResp.data : usersResp.data?.data || [];
              const top = usersData.slice().sort((a, b) => (b.messagesScanned || 0) - (a.messagesScanned || 0)).slice(0, 5);
              setTopUsers(top);
            }
          } catch (err) {
            console.warn('Failed to fetch top users for dashboard preview', err);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching admin stats:", error);
        console.error("Error details:", {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });
        
        if (isMounted) {
          const errorMsg = error.response?.data?.error || error.response?.data?.details || error.message || "Error loading dashboard data";
          setError(errorMsg);
          toast.error(errorMsg);
          setLoading(false);
          // Set default empty stats to prevent UI crashes
          setStats({
            totalUsers: 0,
            totalMessages: 0,
            spamCount: 0,
            hamCount: 0,
            spamPercentage: 0,
            messagesByType: { email: 0, sms: 0, social: 0 },
            recentActivity: [],
            messagesByPeriod: [],
            accuracyByChannel: {},
          });
        }
      }
    };

    // Initial fetch
    fetchStats();

    // Set up polling every 30 seconds
    const interval = setInterval(fetchStats, 30000);

    // Cleanup
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error && !stats.totalMessages) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Ensure stats have safe values
  const totalMessages = stats.totalMessages || 0;
  const spamCount = stats.spamCount || 0;
  const hamCount = stats.hamCount || 0;
  const totalUsers = stats.totalUsers || 0;
  const spamPercentage = stats.spamPercentage || 0;
  const messagesByType = stats.messagesByType || { email: 0, sms: 0, social: 0 };
  const recentActivity = stats.recentActivity || [];
  const accuracyByChannel = stats.accuracyByChannel || {};

  // Calculate type distribution percentages
  const getTypePercentage = (type) => {
    return totalMessages > 0
      ? ((messagesByType[type] || 0) / totalMessages) * 100
      : 0;
  };

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <h1 className="text-3xl font-bold gradient-text">Dashboard Overview</h1>
        <p className="text-gray-600 mt-2">
          Monitor your system's performance and metrics
        </p>
      </div>

      {/* Stats Cards with hover effects */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="hover-lift">
          <StatsCard
            title="Total Users"
            value={totalUsers}
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            }
            colorClass="bg-primary-500"
            change={{ isIncrease: true, value: 12 }}
          />
        </div>

        <div className="hover-lift">
          <StatsCard
            title="Messages Scanned"
            value={totalMessages}
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            }
            colorClass="bg-accent-500"
            change={{ isIncrease: true, value: 8 }}
          />
        </div>

        <div className="hover-lift">
          <StatsCard
            title="Spam Detected"
            value={spamCount}
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            colorClass="bg-danger-500"
            change={{ isIncrease: false, value: 3 }}
          />
        </div>

        <div className="hover-lift">
          <StatsCard
            title="Spam Percentage"
            value={`${spamPercentage.toFixed(1)}%`}
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                />
              </svg>
            }
            colorClass="bg-warning-500"
          />
        </div>
      </div>

      {/* Message Type Distribution and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Message Type Distribution */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">
            Message Type Distribution
          </h2>

          <div className="space-y-4">
            {/* Email */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">Email</span>
                <span className="text-sm font-medium text-gray-700">
                  {messagesByType.email || 0} messages
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${getTypePercentage("email")}%`,
                  }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {getTypePercentage("email").toFixed(1)}% of total
              </div>
            </div>

            {/* SMS */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">SMS</span>
                <span className="text-sm font-medium text-gray-700">
                  {messagesByType.sms || 0} messages
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-accent-500 h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${getTypePercentage("sms")}%`,
                  }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {getTypePercentage("sms").toFixed(1)}% of total
              </div>
            </div>

            {/* Social Media */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700">
                  Social Media
                </span>
                <span className="text-sm font-medium text-gray-700">
                  {messagesByType.social || 0} messages
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-warning-500 h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${getTypePercentage("social")}%`,
                  }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {getTypePercentage("social").toFixed(1)}% of total
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">
            Recent Activity
          </h2>

          {recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {recentActivity.map((activity, index) => (
                <div
                  key={activity.id || index}
                  className="flex items-start pb-4 border-b border-gray-100 last:border-b-0"
                >
                  <div
                    className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                      activity.isSpam
                        ? "bg-danger-100 text-danger-600"
                        : "bg-success-100 text-success-600"
                    }`}
                  >
                    {activity.isSpam ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.user?.name || "Unknown User"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {activity.isSpam ? "Detected spam" : "Scanned message"} (
                      {activity.type || "email"})
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {activity.timestamp
                        ? new Date(activity.timestamp).toLocaleString()
                        : "Unknown time"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No recent activity</p>
            </div>
          )}
        </div>
      </div>

      {/* Accuracy by Channel */}
      {Object.keys(accuracyByChannel).length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-6">
            Detection Accuracy by Channel
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(accuracyByChannel).map(([channel, data]) => (
              <div
                key={channel}
                className="p-4 border border-gray-200 rounded-lg"
              >
                <h3 className="text-sm font-medium text-gray-700 capitalize mb-3">
                  {channel}
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-600">Total:</span>
                    <span className="text-sm font-medium text-gray-900">
                      {data.total || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-600">Spam Count:</span>
                    <span className="text-sm font-medium text-danger-600">
                      {data.spam_count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-600">Accuracy:</span>
                    <span className="text-sm font-medium text-success-600">
                      {(data.accuracy || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Users */}
      <div className="bg-white shadow rounded-lg p-6 mb-8">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Top Users (by messages scanned)</h2>
        {topUsers && topUsers.length > 0 ? (
          <div className="space-y-3">
            {topUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between border-b pb-3">
                <div>
                  <div className="font-medium">{u.name || u.email}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </div>
                <div className="text-sm text-gray-700">{u.messagesScanned || 0} messages</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500">No top users data available</div>
        )}
      </div>

      {/* Raw payload view for verification */}
      <div className="bg-white shadow rounded-lg p-4 mb-8">
        <button
          onClick={() => setShowRaw((s) => !s)}
          className="px-3 py-1 text-sm bg-gray-100 border rounded text-gray-700 hover:bg-gray-200"
        >
          {showRaw ? 'Hide payload' : 'Show raw payload'}
        </button>

        {showRaw && (
          <pre className="mt-3 max-h-96 overflow-auto text-xs bg-gray-50 p-3 rounded border">
            {JSON.stringify({ raw: stats._raw ?? stats, normalized: stats }, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
