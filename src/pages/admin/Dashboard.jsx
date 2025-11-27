import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../../config/api";
import StatsCard from "../../components/admin/StatsCard";
import { toast } from "react-toastify";
import {
  Users,
  Mail,
  AlertTriangle,
  TrendingUp,
  Activity,
  Shield,
  MessageSquare,
  Smartphone,
  Hash,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  Eye,
  EyeOff,
} from "lucide-react";

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
  const [recentMessages, setRecentMessages] = useState([]);

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
          const payload = response.data || {};
          const normalized = {
            totalUsers:
              payload.totalUsers ??
              payload.total_users ??
              payload.totalUsersCount ??
              0,
            totalMessages:
              payload.totalMessages ??
              payload.total_messages ??
              payload.totalMessages ??
              0,
            spamCount:
              payload.spamCount ?? payload.spam_count ?? payload.spam ?? 0,
            hamCount: payload.hamCount ?? payload.ham_count ?? payload.ham ?? 0,
            spamPercentage:
              payload.spamPercentage ??
              payload.spam_percentage ??
              payload.spamRate ??
              0,
            messagesByType: payload.messagesByType ??
              payload.by_type ??
              payload.byType ??
              payload.by_type ?? { email: 0, sms: 0, social: 0 },
            recentActivity:
              payload.recentActivity ??
              payload.recent_activity ??
              payload.recent_activity ??
              [],
            messagesByPeriod:
              payload.messagesByPeriod ??
              payload.messages_by_period ??
              payload.messagesByPeriod ??
              [],
            accuracyByChannel:
              payload.accuracyByChannel ??
              payload.accuracy_by_channel ??
              payload.accuracyByChannel ??
              {},
            _raw: payload,
          };

          setStats(normalized);

          try {
            const token = localStorage.getItem("token");
            if (token) {
              const usersResp = await axios.get(`${API_URL}/admin/users`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const usersData = Array.isArray(usersResp.data)
                ? usersResp.data
                : usersResp.data?.data || [];
              const top = usersData
                .slice()
                .sort(
                  (a, b) => (b.messagesScanned || 0) - (a.messagesScanned || 0)
                )
                .slice(0, 5);
              setTopUsers(top);
            }
          } catch (err) {
            console.warn(
              "Failed to fetch top users for dashboard preview",
              err
            );
          }

          try {
            const token = localStorage.getItem("token");
            if (token) {
              const messagesResp = await axios.get(
                `${API_URL}/admin/messages`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                  params: { limit: 10, offset: 0 },
                }
              );
              const messagesData = Array.isArray(messagesResp.data)
                ? messagesResp.data
                : messagesResp.data?.data || [];
              setRecentMessages(messagesData);
            }
          } catch (err) {
            console.warn("Failed to fetch recent messages for dashboard", err);
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
          const errorMsg =
            error.response?.data?.error ||
            error.response?.data?.details ||
            error.message ||
            "Error loading dashboard data";
          setError(errorMsg);
          toast.error(errorMsg);
          setLoading(false);
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

    fetchStats();
    const interval = setInterval(fetchStats, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="relative">
          <div className="animate-spin h-16 w-16 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <BarChart3 className="text-blue-600" size={24} />
          </div>
        </div>
        <p className="mt-4 text-gray-600 font-medium">Loading dashboard...</p>
      </div>
    );
  }

  if (error && !stats.totalMessages) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center bg-white p-8 rounded-2xl shadow-lg border border-red-100">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="text-red-600" size={32} />
          </div>
          <p className="text-red-600 mb-4 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg transition-all font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalMessages = stats.totalMessages || 0;
  const spamCount = stats.spamCount || 0;
  const totalUsers = stats.totalUsers || 0;
  const spamPercentage =
    stats.spamPercentage ||
    (totalMessages > 0 ? (spamCount / totalMessages) * 100 : 0);
  const messagesByType = stats.messagesByType || {
    email: 0,
    sms: 0,
    social: 0,
  };
  const recentActivity = stats.recentActivity || [];
  const accuracyByChannel = stats.accuracyByChannel || {};

  const getTypePercentage = (type) => {
    return totalMessages > 0
      ? ((messagesByType[type] || 0) / totalMessages) * 100
      : 0;
  };

  return (
    <div className="min-h-screen ">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Dashboard Overview
                  </h1>
                  <p className="text-gray-600 mt-1">Monitor your system's performance and metrics in real-time</p>
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600 font-medium">Live</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                <Users className="text-white" size={24} />
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                <TrendingUp size={14} />
                <span>+12%</span>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">Total Users</p>
              <p className="text-3xl font-bold text-gray-900">{totalUsers.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-md">
                <MessageSquare className="text-white" size={24} />
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                <TrendingUp size={14} />
                <span>+8%</span>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">Messages Scanned</p>
              <p className="text-3xl font-bold text-gray-900">{totalMessages.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-md">
                <AlertTriangle className="text-white" size={24} />
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                <TrendingUp size={14} />
                <span>-3%</span>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">Spam Detected</p>
              <p className="text-3xl font-bold text-gray-900">{spamCount.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-md">
                <Shield className="text-white" size={24} />
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-50 px-2 py-1 rounded-lg">
                <Activity size={14} />
                <span>Rate</span>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">Spam Percentage</p>
              <p className="text-3xl font-bold text-gray-900">{spamPercentage.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Message Type Distribution - 2 columns */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BarChart3 className="text-blue-600" size={20} />
                </div>
                Message Type Distribution
              </h2>
            </div>

            <div className="space-y-6">
              {/* Email */}
              <div className="group">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                      <Mail className="text-blue-600" size={18} />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900">Email Messages</span>
                      <p className="text-xs text-gray-500">{getTypePercentage("email").toFixed(1)}% of total</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    {(messagesByType.email || 0).toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${getTypePercentage("email")}%` }}
                  ></div>
                </div>
              </div>

              {/* SMS */}
              <div className="group">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                      <Smartphone className="text-emerald-600" size={18} />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900">SMS Messages</span>
                      <p className="text-xs text-gray-500">{getTypePercentage("sms").toFixed(1)}% of total</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    {(messagesByType.sms || 0).toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-3 rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${getTypePercentage("sms")}%` }}
                  ></div>
                </div>
              </div>

              {/* Social Media */}
              <div className="group">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition-colors">
                      <Hash className="text-amber-600" size={18} />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900">Social Media</span>
                      <p className="text-xs text-gray-500">{getTypePercentage("social").toFixed(1)}% of total</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-gray-900">
                    {(messagesByType.social || 0).toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-amber-600 h-3 rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${getTypePercentage("social")}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity - 1 column */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Activity className="text-purple-600" size={20} />
                </div>
                Recent Activity
              </h2>
            </div>

            {recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                {recentActivity.map((activity, index) => (
                  <div
                    key={activity.id || index}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100"
                  >
                    <div
                      className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${activity.isSpam
                          ? "bg-red-100 text-red-600"
                          : "bg-green-100 text-green-600"
                        }`}
                    >
                      {activity.isSpam ? (
                        <XCircle size={20} />
                      ) : (
                        <CheckCircle size={20} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {activity.user?.name || "Unknown User"}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {activity.isSpam ? "Detected spam" : "Scanned message"} • {activity.type || "email"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Clock size={12} />
                        {activity.timestamp
                          ? new Date(activity.timestamp).toLocaleString()
                          : "Unknown time"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Activity className="text-gray-400" size={32} />
                </div>
                <p className="text-gray-500 font-medium">No recent activity</p>
                <p className="text-xs text-gray-400 mt-1">Activity will appear here when available</p>
              </div>
            )}
          </div>
        </div>

        {/* Accuracy by Channel */}
        <div className="flex flex-col lg:flex-row gap-8 mb-4">

          {/* Accuracy by Channel */}
          {Object.keys(accuracyByChannel).length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 w-full lg:w-1/2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Shield className="text-indigo-600" size={20} />
                  </div>
                  Detection Accuracy by Channel
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {Object.entries(accuracyByChannel).map(([channel, data]) => (
                  <div
                    key={channel}
                    className="p-5 border-2 border-gray-100 rounded-xl hover:border-blue-200 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-900 capitalize flex items-center gap-2">
                        {channel === 'email' && <Mail size={18} className="text-blue-600" />}
                        {channel === 'sms' && <Smartphone size={18} className="text-emerald-600" />}
                        {channel === 'social' && <Hash size={18} className="text-amber-600" />}
                        {channel}
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Messages</span>
                        <span className="text-lg font-bold text-gray-900">
                          {(data.total || 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Spam Detected</span>
                        <span className="text-lg font-bold text-red-600">
                          {(data.spam_count || 0).toLocaleString()}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-gray-100">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Accuracy Rate</span>
                          <span className="text-2xl font-bold text-green-600">
                            {(data.accuracy || 0).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Users */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 w-full lg:w-1/2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="text-green-600" size={20} />
                </div>
                Top Users
              </h2>
              <span className="text-sm text-gray-500">By messages scanned</span>
            </div>

            {topUsers && topUsers.length > 0 ? (
              <div className="space-y-3">
                {topUsers.map((u, idx) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold shadow-sm">
                        #{idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{u.name || u.email}</div>
                        <div className="text-sm text-gray-500">{u.email}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        {(u.messagesScanned || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">messages</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="text-gray-400" size={32} />
                </div>
                <p className="text-gray-500 font-medium">No user data available</p>
              </div>
            )}
          </div>

        </div>


        {/* Debug Panel */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <button
            onClick={() => setShowRaw((s) => !s)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-gray-700 font-medium transition-colors"
          >
            {showRaw ? <EyeOff size={16} /> : <Eye size={16} />}
            {showRaw ? "Hide Raw Payload" : "Show Raw Payload"}
          </button>

          {showRaw && (
            <div className="mt-4">
              <div className="bg-gray-900 rounded-xl p-4 overflow-hidden">
                <pre className="text-xs text-green-400 overflow-auto max-h-96 font-mono">
                  {JSON.stringify(
                    { raw: stats._raw ?? stats, normalized: stats },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;