import { useState, useEffect, useMemo } from "react";
import DetectionForm from "../components/detection/DetectionForm";
import ResultCard from "../components/detection/ResultCard";

const DetectionPage = () => {
  const [result, setResult] = useState(null);
  const [detectionHistory, setDetectionHistory] = useState([]);
  const [isFilteringSpam, setIsFilteringSpam] = useState(false);
  const [animateResult, setAnimateResult] = useState(false);
  const [activeTab, setActiveTab] = useState("form");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // Load detection history from localStorage and API on initial render
  useEffect(() => {
    loadDetectionHistory();
  }, []);

  const loadDetectionHistory = async () => {
    setIsLoadingHistory(true);
    setHistoryError(null);

    // First, load from localStorage
    const savedHistory = localStorage.getItem("detectionHistory");
    if (savedHistory) {
      try {
        const localHistory = JSON.parse(savedHistory);
        setDetectionHistory(localHistory);
      } catch (error) {
        console.error("Failed to parse local detection history", error);
      }
    }

    // Then try to load from API if user is authenticated
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const response = await fetch("/api/messages/history", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.history && data.history.length > 0) {
            // Merge with localStorage data, prioritizing API data
            const apiHistory = data.history.map((item) => ({
              ...item,
              source: "api",
            }));

            // Get localStorage data that's not in API
            const localOnlyHistory = detectionHistory.filter(
              (localItem) =>
                !apiHistory.some(
                  (apiItem) =>
                    apiItem.message === localItem.message &&
                    Math.abs(
                      new Date(apiItem.timestamp) -
                        new Date(localItem.timestamp)
                    ) < 60000
                )
            );

            const mergedHistory = [...apiHistory, ...localOnlyHistory].slice(
              0,
              100
            );
            setDetectionHistory(mergedHistory);

            // Update localStorage with merged data
            localStorage.setItem(
              "detectionHistory",
              JSON.stringify(mergedHistory)
            );
          }
        } else if (response.status === 401) {
          // Token expired or invalid, clear it
          localStorage.removeItem("token");
        }
      } catch (error) {
        console.error("Failed to load history from API:", error);
        setHistoryError("Failed to sync with server. Using local data only.");
      }
    }

    setIsLoadingHistory(false);
  };

  // Save detection history to localStorage whenever it changes
  useEffect(() => {
    if (detectionHistory.length > 0) {
      localStorage.setItem(
        "detectionHistory",
        JSON.stringify(detectionHistory)
      );
    }
  }, [detectionHistory]);

  const handleDetectionResult = (newResult) => {
    // Ensure the result has all necessary fields
    const completeResult = {
      ...newResult,
      timestamp: newResult.timestamp || new Date().toISOString(),
      id: newResult.id || `local_${Date.now()}`,
      source: newResult.saved_to_db ? "api" : "local",
    };

    setResult(completeResult);

    // Add to history (keep last 100 detections)
    setDetectionHistory((prev) => [completeResult, ...prev].slice(0, 100));

    // Trigger animation
    setAnimateResult(false);
    setTimeout(() => setAnimateResult(true), 50);

    // Switch to form tab if on another tab
    setActiveTab("form");
  };

  const clearHistory = () => {
    if (
      window.confirm("Are you sure you want to clear your detection history?")
    ) {
      setDetectionHistory([]);
      setResult(null);
      localStorage.removeItem("detectionHistory");
    }
  };

  const syncWithServer = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setHistoryError("Please log in to sync with server");
      return;
    }

    setIsLoadingHistory(true);
    try {
      await loadDetectionHistory();
      setHistoryError(null);
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      setHistoryError("Failed to sync with server");
    }
    setIsLoadingHistory(false);
  };

  // Calculate statistics from detection history
  const stats = useMemo(() => {
    if (!detectionHistory.length) return null;

    const totalScans = detectionHistory.length;
    const totalSpam = detectionHistory.filter((item) => item.isSpam).length;
    const totalNonSpam = totalScans - totalSpam;

    const byPlatform = {
      email: { total: 0, spam: 0 },
      sms: { total: 0, spam: 0 },
      social: { total: 0, spam: 0 },
    };

    // Group by platform type
    detectionHistory.forEach((item) => {
      const platform = item.type || "email";
      if (byPlatform[platform]) {
        byPlatform[platform].total++;
        if (item.isSpam) {
          byPlatform[platform].spam++;
        }
      }
    });

    return {
      totalScans,
      totalSpam,
      totalNonSpam,
      spamRate:
        totalScans > 0 ? ((totalSpam / totalScans) * 100).toFixed(1) : 0,
      byPlatform,
    };
  }, [detectionHistory]);

  // Filter history based on isFilteringSpam state and search term
  const filteredHistory = useMemo(() => {
    let filtered = isFilteringSpam
      ? detectionHistory.filter((item) => item.isSpam)
      : detectionHistory;

    // Apply search filter if there's a search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          (item.message || item.originalMessage || "")
            .toLowerCase()
            .includes(term) ||
          (item.type || "email").toLowerCase().includes(term) ||
          (item.language || "").toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [detectionHistory, isFilteringSpam, searchTerm]);

  // Get the most recent detection by platform
  const recentByPlatform = useMemo(() => {
    const result = {};

    if (detectionHistory.length) {
      for (const item of detectionHistory) {
        const platform = item.type || "email";
        if (!result[platform]) {
          result[platform] = item;
        }
      }
    }

    return result;
  }, [detectionHistory]);

  const renderSpamTips = () => (
    <div className="bg-white rounded-xl shadow-lg p-6 space-y-6 overflow-hidden">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          How to Identify Spam
        </h3>
        <div className="space-y-3">
          {[
            {
              icon: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
              title: "Urgency Tactics",
              description:
                "Messages that create a sense of urgency or time pressure to act immediately are often spam.",
            },
            {
              icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1",
              title: "Suspicious Links",
              description:
                "Shortened URLs or links with misspelled domain names are common in spam messages.",
            },
            {
              icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1",
              title: "Too Good To Be True",
              description:
                "Offers of free prizes, massive discounts, or unexpected winnings are typical spam tactics.",
            },
            {
              icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
              title: "Poor Grammar & Spelling",
              description:
                "Legitimate organizations typically have professional communications without obvious errors.",
            },
          ].map((tip, index) => (
            <div key={index} className="flex gap-3 items-start">
              <div className="bg-primary-100 text-primary-700 p-2 rounded-md flex-shrink-0">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={tip.icon}
                  />
                </svg>
              </div>
              <div>
                <h4 className="font-medium text-gray-900">{tip.title}</h4>
                <p className="text-sm text-gray-600">{tip.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          How to Stay Safe
        </h3>
        <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
          <li>Never click on suspicious links in emails or messages</li>
          <li>
            Don't share personal information in response to unexpected requests
          </li>
          <li>Be wary of messages with urgent calls to action</li>
          <li>Check sender email addresses carefully for misspellings</li>
          <li>Use this spam detection tool to analyze suspicious messages</li>
          <li>Keep your devices and software updated</li>
        </ul>
      </div>
    </div>
  );

  const renderStats = () =>
    stats ? (
      <div className="bg-white rounded-xl shadow-lg p-6 space-y-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900">
            Detection Statistics
          </h3>
          <button
            onClick={syncWithServer}
            disabled={isLoadingHistory}
            className="text-sm px-3 py-1 rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors disabled:opacity-50"
          >
            {isLoadingHistory ? "Syncing..." : "Sync"}
          </button>
        </div>

        {historyError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-800">{historyError}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-500">Total Scans</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.totalScans}
            </p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-500">Spam Detected</p>
            <p className="text-2xl font-bold text-red-600">{stats.totalSpam}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-500">Legitimate</p>
            <p className="text-2xl font-bold text-green-600">
              {stats.totalNonSpam}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-500">Spam Rate</p>
            <p className="text-2xl font-bold text-blue-600">
              {stats.spamRate}%
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Detection by Platform
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.byPlatform).map(
              ([platform, data]) =>
                data.total > 0 && (
                  <div key={platform} className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium capitalize">
                        {platform}
                      </span>
                      <span className="text-sm text-gray-500">
                        {data.total} scans
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full bg-blue-500"
                        style={{ width: `${(data.spam / data.total) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-xs">
                      <span className="text-red-600">
                        {data.spam} spam (
                        {((data.spam / data.total) * 100).toFixed(1)}%)
                      </span>
                      <span className="text-green-600">
                        {data.total - data.spam} legitimate
                      </span>
                    </div>
                  </div>
                )
            )}
          </div>
        </div>

        {Object.keys(recentByPlatform).length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Recent Detections by Platform
            </h3>
            <div className="space-y-3">
              {Object.entries(recentByPlatform).map(([platform, item]) => (
                <div
                  key={platform}
                  className={`p-3 rounded-lg text-sm border cursor-pointer hover:shadow-md transition-shadow ${
                    item.isSpam
                      ? "bg-red-50 border-red-200"
                      : "bg-green-50 border-green-200"
                  }`}
                  onClick={() => {
                    setResult(item);
                    setActiveTab("form");
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{platform}</span>
                    <div className="flex items-center gap-2">
                      {item.source === "api" && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          Synced
                        </span>
                      )}
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          item.isSpam
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {item.isSpam ? "Spam" : "Clean"}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-700 truncate mt-1">
                    {item.message || item.originalMessage}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    ) : (
      <div className="bg-white rounded-xl shadow-lg p-10 text-center">
        <svg
          className="h-16 w-16 mx-auto text-gray-300 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Detection History
        </h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Start analyzing messages to generate detection statistics. Your
          history will be stored locally and synced with the server when you are
          logged in.
        </p>
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto px-4 pt-28 pb-12 overflow-hidden">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl p-8 mb-8 shadow-md overflow-hidden relative">
        <div className="absolute inset-0 bg-white/5 backdrop-blur-sm -z-10" />
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Multi-Format Spam Detection
          </h1>
          <p className="text-lg text-gray-700 mb-6">
            Analyze your messages to detect potential spam across various
            platforms with our advanced multi-format detection system powered by
            machine learning.
          </p>
          <div className="inline-flex p-1 bg-white rounded-lg shadow-md">
            <button
              onClick={() => setActiveTab("form")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "form"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Detection Tool
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "stats"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Statistics
            </button>
            <button
              onClick={() => setActiveTab("tips")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "tips"
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Safety Tips
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Detection Form & Results */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === "form" && (
            <>
              <DetectionForm onDetectionResult={handleDetectionResult} />

              {result && (
                <div
                  className={`mt-6 transition-all duration-500 ${
                    animateResult
                      ? "opacity-100 transform translate-y-0"
                      : "opacity-0 transform translate-y-4"
                  }`}
                >
                  <ResultCard result={result} />
                </div>
              )}
            </>
          )}

          {activeTab === "stats" && renderStats()}

          {activeTab === "tips" && renderSpamTips()}
        </div>

        {/* Detection History */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow-lg rounded-xl p-6 sticky top-28">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Detection History
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFilteringSpam(!isFilteringSpam)}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    isFilteringSpam
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {isFilteringSpam ? "Show All" : "Spam Only"}
                </button>
                {detectionHistory.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {isLoadingHistory && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-600">
                  Loading history...
                </span>
              </div>
            )}

            {detectionHistory.length > 0 && (
              <div className="relative mb-4">
                <input
                  type="text"
                  placeholder="Search history..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50"
                />
                <svg
                  className="h-4 w-4 text-gray-400 absolute left-3 top-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {filteredHistory.length > 0 ? (
              <>
                <div className="text-xs text-gray-500 mb-2">
                  Showing {filteredHistory.length} of {detectionHistory.length}{" "}
                  detections
                </div>
                <div className="space-y-3 max-h-[calc(100vh-310px)] overflow-y-auto pr-2">
                  {filteredHistory.map((item, index) => (
                    <div
                      key={item.id || index}
                      className={`p-3 rounded-lg text-sm border transition-all hover:shadow-md cursor-pointer ${
                        item.isSpam
                          ? "bg-red-50 border-red-200"
                          : "bg-green-50 border-green-200"
                      }`}
                      onClick={() => {
                        setResult(item);
                        setActiveTab("form");
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-medium ${
                              item.isSpam ? "text-red-700" : "text-green-700"
                            }`}
                          >
                            {item.isSpam ? "Spam" : "Not Spam"}
                          </span>
                          {item.source === "api" && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                              Synced
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-gray-700 truncate">
                        {item.message || item.originalMessage}
                      </p>
                      <div className="mt-1 text-xs flex justify-between">
                        <span className="text-gray-500">
                          Type:{" "}
                          <span className="font-medium capitalize">
                            {item.type || "email"}
                          </span>
                        </span>
                        <span className="text-gray-500">
                          {Math.round((item.confidence || 0) * 100)}% confidence
                        </span>
                      </div>
                      {item.language && (
                        <div className="mt-1 text-xs">
                          <span className="text-gray-500">
                            Language:{" "}
                            <span className="font-medium capitalize">
                              {item.language}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-10 border border-dashed rounded-lg">
                <svg
                  className="h-10 w-10 mx-auto text-gray-400 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p className="text-gray-500 font-medium">
                  No detection history
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  {isFilteringSpam
                    ? "No spam detected yet"
                    : searchTerm
                    ? "No matches found for your search"
                    : "Your recent detection history will appear here"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DetectionPage;

// import { useState, useEffect, useMemo } from "react";
// import DetectionForm from "../components/detection/DetectionForm";
// import ResultCard from "../components/detection/ResultCard";

// const DetectionPage = () => {
//   const [result, setResult] = useState(null);
//   const [detectionHistory, setDetectionHistory] = useState([]);
//   const [isFilteringSpam, setIsFilteringSpam] = useState(false);
//   const [animateResult, setAnimateResult] = useState(false);
//   const [activeTab, setActiveTab] = useState("form"); // 'form', 'stats', 'tips'
//   const [searchTerm, setSearchTerm] = useState("");

//   // Load detection history from localStorage on initial render
//   useEffect(() => {
//     const savedHistory = localStorage.getItem("detectionHistory");
//     if (savedHistory) {
//       try {
//         setDetectionHistory(JSON.parse(savedHistory));
//       } catch (error) {
//         console.error("Failed to parse detection history", error);
//       }
//     }
//   }, []);

//   // Save detection history to localStorage whenever it changes
//   useEffect(() => {
//     localStorage.setItem("detectionHistory", JSON.stringify(detectionHistory));
//   }, [detectionHistory]);

//   const handleDetectionResult = (newResult) => {
//     setResult(newResult);
//     setDetectionHistory((prev) => [newResult, ...prev].slice(0, 50)); // Keep last 50 detections

//     // Trigger animation
//     setAnimateResult(false);
//     setTimeout(() => setAnimateResult(true), 50);

//     // Switch to form tab if on another tab
//     setActiveTab("form");
//   };

//   const clearHistory = () => {
//     if (
//       window.confirm("Are you sure you want to clear your detection history?")
//     ) {
//       setDetectionHistory([]);
//       setResult(null);
//     }
//   };

//   // Calculate statistics from detection history
//   const stats = useMemo(() => {
//     if (!detectionHistory.length) return null;

//     const totalScans = detectionHistory.length;
//     const totalSpam = detectionHistory.filter((item) => item.isSpam).length;
//     const totalNonSpam = totalScans - totalSpam;

//     const byPlatform = {
//       email: {
//         total: 0,
//         spam: 0,
//       },
//       sms: {
//         total: 0,
//         spam: 0,
//       },
//       social: {
//         total: 0,
//         spam: 0,
//       },
//     };

//     // Group by platform type
//     detectionHistory.forEach((item) => {
//       if (byPlatform[item.type]) {
//         byPlatform[item.type].total++;
//         if (item.isSpam) {
//           byPlatform[item.type].spam++;
//         }
//       }
//     });

//     return {
//       totalScans,
//       totalSpam,
//       totalNonSpam,
//       spamRate:
//         totalScans > 0 ? ((totalSpam / totalScans) * 100).toFixed(1) : 0,
//       byPlatform,
//     };
//   }, [detectionHistory]);

//   // Filter history based on isFilteringSpam state and search term
//   const filteredHistory = useMemo(() => {
//     let filtered = isFilteringSpam
//       ? detectionHistory.filter((item) => item.isSpam)
//       : detectionHistory;

//     // Apply search filter if there's a search term
//     if (searchTerm.trim()) {
//       const term = searchTerm.toLowerCase();
//       filtered = filtered.filter(
//         (item) =>
//           item.message.toLowerCase().includes(term) ||
//           item.type.toLowerCase().includes(term)
//       );
//     }

//     return filtered;
//   }, [detectionHistory, isFilteringSpam, searchTerm]);

//   // Get the most recent detection by platform
//   const recentByPlatform = useMemo(() => {
//     const result = {};

//     if (detectionHistory.length) {
//       for (const item of detectionHistory) {
//         if (!result[item.type]) {
//           result[item.type] = item;
//         }
//       }
//     }

//     return result;
//   }, [detectionHistory]);

//   const renderSpamTips = () => (
//     <div className="bg-white rounded-xl shadow-lg p-6 space-y-6 overflow-hidden">
//       <div>
//         <h3 className="text-lg font-semibold text-gray-900 mb-2">
//           How to Identify Spam
//         </h3>
//         <div className="space-y-3">
//           <div className="flex gap-3 items-start">
//             <div className="bg-primary-100 text-primary-700 p-2 rounded-md">
//               <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 className="h-5 w-5"
//                 fill="none"
//                 viewBox="0 0 24 24"
//                 stroke="currentColor"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
//                 />
//               </svg>
//             </div>
//             <div>
//               <h4 className="font-medium text-gray-900">Urgency Tactics</h4>
//               <p className="text-sm text-gray-600">
//                 Messages that create a sense of urgency or time pressure to act
//                 immediately are often spam.
//               </p>
//             </div>
//           </div>

//           <div className="flex gap-3 items-start">
//             <div className="bg-primary-100 text-primary-700 p-2 rounded-md">
//               <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 className="h-5 w-5"
//                 fill="none"
//                 viewBox="0 0 24 24"
//                 stroke="currentColor"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
//                 />
//               </svg>
//             </div>
//             <div>
//               <h4 className="font-medium text-gray-900">Suspicious Links</h4>
//               <p className="text-sm text-gray-600">
//                 Shortened URLs or links with misspelled domain names are common
//                 in spam messages.
//               </p>
//             </div>
//           </div>

//           <div className="flex gap-3 items-start">
//             <div className="bg-primary-100 text-primary-700 p-2 rounded-md">
//               <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 className="h-5 w-5"
//                 fill="none"
//                 viewBox="0 0 24 24"
//                 stroke="currentColor"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
//                 />
//               </svg>
//             </div>
//             <div>
//               <h4 className="font-medium text-gray-900">Too Good To Be True</h4>
//               <p className="text-sm text-gray-600">
//                 Offers of free prizes, massive discounts, or unexpected winnings
//                 are typical spam tactics.
//               </p>
//             </div>
//           </div>

//           <div className="flex gap-3 items-start">
//             <div className="bg-primary-100 text-primary-700 p-2 rounded-md">
//               <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 className="h-5 w-5"
//                 fill="none"
//                 viewBox="0 0 24 24"
//                 stroke="currentColor"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth={2}
//                   d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
//                 />
//               </svg>
//             </div>
//             <div>
//               <h4 className="font-medium text-gray-900">
//                 Poor Grammar & Spelling
//               </h4>
//               <p className="text-sm text-gray-600">
//                 Legitimate organizations typically have professional
//                 communications without obvious errors.
//               </p>
//             </div>
//           </div>
//         </div>
//       </div>

//       <div>
//         <h3 className="text-lg font-semibold text-gray-900 mb-2">
//           How to Stay Safe
//         </h3>
//         <ul className="list-disc pl-5 space-y-2 text-sm text-gray-600">
//           <li>Never click on suspicious links in emails or messages</li>
//           <li>
//             Dont share personal information in response to unexpected requests
//           </li>
//           <li>Be wary of messages with urgent calls to action</li>
//           <li>Check sender email addresses carefully for misspellings</li>
//           <li>Use this spam detection tool to analyze suspicious messages</li>
//           <li>Keep your devices and software updated</li>
//         </ul>
//       </div>
//     </div>
//   );

//   const renderStats = () =>
//     stats ? (
//       <div className="bg-white rounded-xl shadow-lg p-6 space-y-6 overflow-hidden">
//         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
//           <div className="bg-gray-50 p-4 rounded-lg text-center">
//             <p className="text-sm text-gray-500">Total Scans</p>
//             <p className="text-2xl font-bold text-gray-900">
//               {stats.totalScans}
//             </p>
//           </div>
//           <div className="bg-danger-50 p-4 rounded-lg text-center">
//             <p className="text-sm text-gray-500">Spam Detected</p>
//             <p className="text-2xl font-bold text-danger-600">
//               {stats.totalSpam}
//             </p>
//           </div>
//           <div className="bg-success-50 p-4 rounded-lg text-center">
//             <p className="text-sm text-gray-500">Legitimate</p>
//             <p className="text-2xl font-bold text-success-600">
//               {stats.totalNonSpam}
//             </p>
//           </div>
//           <div className="bg-primary-50 p-4 rounded-lg text-center">
//             <p className="text-sm text-gray-500">Spam Rate</p>
//             <p className="text-2xl font-bold text-primary-600">
//               {stats.spamRate}%
//             </p>
//           </div>
//         </div>

//         <div>
//           <h3 className="text-lg font-semibold text-gray-900 mb-3">
//             Detection by Platform
//           </h3>
//           <div className="space-y-3">
//             {Object.entries(stats.byPlatform).map(
//               ([platform, data]) =>
//                 data.total > 0 && (
//                   <div key={platform} className="bg-gray-50 p-3 rounded-lg">
//                     <div className="flex justify-between mb-1">
//                       <span className="text-sm font-medium capitalize">
//                         {platform}
//                       </span>
//                       <span className="text-sm text-gray-500">
//                         {data.total} scans
//                       </span>
//                     </div>
//                     <div className="w-full bg-gray-200 rounded-full h-2.5">
//                       <div
//                         className="h-2.5 rounded-full bg-primary-500"
//                         style={{ width: `${(data.spam / data.total) * 100}%` }}
//                       ></div>
//                     </div>
//                     <div className="flex justify-between mt-1 text-xs">
//                       <span className="text-danger-600">
//                         {data.spam} spam (
//                         {((data.spam / data.total) * 100).toFixed(1)}%)
//                       </span>
//                       <span className="text-success-600">
//                         {data.total - data.spam} legitimate
//                       </span>
//                     </div>
//                   </div>
//                 )
//             )}
//           </div>
//         </div>

//         {Object.keys(recentByPlatform).length > 0 && (
//           <div>
//             <h3 className="text-lg font-semibold text-gray-900 mb-3">
//               Recent Detections by Platform
//             </h3>
//             <div className="space-y-3">
//               {Object.entries(recentByPlatform).map(([platform, item]) => (
//                 <div
//                   key={platform}
//                   className={`p-3 rounded-lg text-sm border cursor-pointer hover:shadow-md ${
//                     item.isSpam
//                       ? "bg-danger-50 border-danger-200"
//                       : "bg-success-50 border-success-200"
//                   }`}
//                   onClick={() => {
//                     setResult(item);
//                     setActiveTab("form");
//                   }}
//                 >
//                   <div className="flex items-center justify-between">
//                     <span className="font-medium capitalize">{platform}</span>
//                     <span
//                       className={`text-xs px-2 py-0.5 rounded-full ${
//                         item.isSpam
//                           ? "bg-danger-100 text-danger-700"
//                           : "bg-success-100 text-success-700"
//                       }`}
//                     >
//                       {item.isSpam ? "Spam" : "Clean"}
//                     </span>
//                   </div>
//                   <p className="text-gray-700 truncate mt-1">{item.message}</p>
//                 </div>
//               ))}
//             </div>
//           </div>
//         )}
//       </div>
//     ) : (
//       <div className="bg-white rounded-xl shadow-lg p-10 text-center">
//         <svg
//           xmlns="http://www.w3.org/2000/svg"
//           className="h-16 w-16 mx-auto text-gray-300 mb-4"
//           fill="none"
//           viewBox="0 0 24 24"
//           stroke="currentColor"
//         >
//           <path
//             strokeLinecap="round"
//             strokeLinejoin="round"
//             strokeWidth={1}
//             d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
//           />
//         </svg>
//         <h3 className="text-lg font-medium text-gray-900 mb-2">
//           No Detection History
//         </h3>
//         <p className="text-gray-500 max-w-md mx-auto">
//           Start analyzing messages to generate detection statistics. Your
//           history will be stored locally for your privacy.
//         </p>
//       </div>
//     );

//   return (
//     <div className="max-w-7xl mx-auto px-4 pt-28 pb-12 overflow-hidden">
//       {/* Hero Section */}
//       <div className="bg-gradient-to-r from-primary-500/10 to-accent-500/10 rounded-2xl p-8 mb-8 shadow-md overflow-hidden relative">
//         <div className="absolute inset-0 bg-white/5 backdrop-blur-sm -z-10"></div>
//         <div className="text-center max-w-3xl mx-auto">
//           <h1 className="text-4xl font-bold text-gray-900 mb-4">
//             Multi-Format Spam Detection
//           </h1>
//           <p className="text-lg text-gray-700 mb-6">
//             Analyze your messages to detect potential spam across various
//             platforms with our advanced multi-format detection system powered by
//             machine learning.
//           </p>
//           <div className="inline-flex p-1 bg-white rounded-lg shadow-md">
//             <button
//               onClick={() => setActiveTab("form")}
//               className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
//                 activeTab === "form"
//                   ? "bg-primary-100 text-primary-700"
//                   : "text-gray-600 hover:bg-gray-100"
//               }`}
//             >
//               Detection Tool
//             </button>
//             <button
//               onClick={() => setActiveTab("stats")}
//               className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
//                 activeTab === "stats"
//                   ? "bg-primary-100 text-primary-700"
//                   : "text-gray-600 hover:bg-gray-100"
//               }`}
//             >
//               Statistics
//             </button>
//             <button
//               onClick={() => setActiveTab("tips")}
//               className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
//                 activeTab === "tips"
//                   ? "bg-primary-100 text-primary-700"
//                   : "text-gray-600 hover:bg-gray-100"
//               }`}
//             >
//               Safety Tips
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Main Content */}
//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//         {/* Detection Form & Results */}
//         <div className="lg:col-span-2 space-y-6">
//           {activeTab === "form" && (
//             <>
//               <DetectionForm onDetectionResult={handleDetectionResult} />

//               {result && (
//                 <div
//                   className={`mt-6 transition-all duration-500 ${
//                     animateResult
//                       ? "opacity-100 transform translate-y-0"
//                       : "opacity-0 transform translate-y-4"
//                   }`}
//                 >
//                   <ResultCard result={result} />
//                 </div>
//               )}
//             </>
//           )}

//           {activeTab === "stats" && renderStats()}

//           {activeTab === "tips" && renderSpamTips()}
//         </div>

//         {/* Detection History */}
//         <div className="lg:col-span-1">
//           <div className="bg-white shadow-lg rounded-xl p-6 sticky top-28">
//             <div className="flex items-center justify-between mb-4">
//               <h2 className="text-xl font-semibold text-gray-900">
//                 Detection History
//               </h2>
//               <div className="flex items-center gap-2">
//                 <button
//                   onClick={() => setIsFilteringSpam(!isFilteringSpam)}
//                   className={`text-xs px-3 py-1 rounded-full transition-colors ${
//                     isFilteringSpam
//                       ? "bg-danger-100 text-danger-700 hover:bg-danger-200"
//                       : "bg-gray-100 text-gray-700 hover:bg-gray-200"
//                   }`}
//                 >
//                   {isFilteringSpam ? "Show All" : "Spam Only"}
//                 </button>
//                 {detectionHistory.length > 0 && (
//                   <button
//                     onClick={clearHistory}
//                     className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
//                   >
//                     Clear
//                   </button>
//                 )}
//               </div>
//             </div>

//             {detectionHistory.length > 0 && (
//               <div className="relative mb-4">
//                 <input
//                   type="text"
//                   placeholder="Search history..."
//                   value={searchTerm}
//                   onChange={(e) => setSearchTerm(e.target.value)}
//                   className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-gray-50"
//                   style={{ backgroundColor: "#f9fafb" }}
//                 />
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   className="h-4 w-4 text-gray-400 absolute left-3 top-2.5"
//                   fill="none"
//                   viewBox="0 0 24 24"
//                   stroke="currentColor"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth={2}
//                     d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
//                   />
//                 </svg>
//                 {searchTerm && (
//                   <button
//                     onClick={() => setSearchTerm("")}
//                     className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
//                   >
//                     <svg
//                       xmlns="http://www.w3.org/2000/svg"
//                       className="h-4 w-4"
//                       fill="none"
//                       viewBox="0 0 24 24"
//                       stroke="currentColor"
//                     >
//                       <path
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                         strokeWidth={2}
//                         d="M6 18L18 6M6 6l12 12"
//                       />
//                     </svg>
//                   </button>
//                 )}
//               </div>
//             )}

//             {filteredHistory.length > 0 ? (
//               <>
//                 <div className="text-xs text-gray-500 mb-2">
//                   Showing {filteredHistory.length} of {detectionHistory.length}{" "}
//                   detections
//                 </div>
//                 <div className="space-y-3 max-h-[calc(100vh-310px)] overflow-y-auto pr-2 custom-scrollbar">
//                   {filteredHistory.map((item, index) => (
//                     <div
//                       key={index}
//                       className={`p-3 rounded-lg text-sm border transition-all hover:shadow-md cursor-pointer ${
//                         item.isSpam
//                           ? "bg-danger-50 border-danger-200"
//                           : "bg-success-50 border-success-200"
//                       }`}
//                       onClick={() => {
//                         setResult(item);
//                         setActiveTab("form");
//                       }}
//                     >
//                       <div className="flex items-center justify-between mb-1">
//                         <span
//                           className={`font-medium ${
//                             item.isSpam ? "text-danger-700" : "text-success-700"
//                           }`}
//                         >
//                           {item.isSpam ? "Spam" : "Not Spam"}
//                         </span>
//                         <span className="text-xs text-gray-500">
//                           {new Date(item.timestamp).toLocaleTimeString()}
//                         </span>
//                       </div>
//                       <p className="text-gray-700 truncate">{item.message}</p>
//                       <div className="mt-1 text-xs flex justify-between">
//                         <span className="text-gray-500">
//                           Type:{" "}
//                           <span className="font-medium capitalize">
//                             {item.type}
//                           </span>
//                         </span>
//                         <span className="text-gray-500">
//                           {Math.round(item.confidence * 100)}% confidence
//                         </span>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </>
//             ) : (
//               <div className="text-center py-10 border border-dashed rounded-lg">
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   className="h-10 w-10 mx-auto text-gray-400 mb-2"
//                   fill="none"
//                   viewBox="0 0 24 24"
//                   stroke="currentColor"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth={1.5}
//                     d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
//                   />
//                 </svg>
//                 <p className="text-gray-500 font-medium">
//                   No detection history
//                 </p>
//                 <p className="text-sm text-gray-400 mt-1">
//                   {isFilteringSpam
//                     ? "No spam detected yet"
//                     : searchTerm
//                     ? "No matches found for your search"
//                     : "Your recent detection history will appear here"}
//                 </p>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default DetectionPage;
