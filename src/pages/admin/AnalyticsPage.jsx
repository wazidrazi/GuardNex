import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { toast } from 'react-toastify';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const AnalyticsPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMessages: 0,
    spamCount: 0,
    cleanCount: 0,
    detectionRate: 0,
    messagesByPeriod: [],
    accuracyByChannel: {}
  });

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        if (!token) {
          throw new Error('No authentication token found');
        }

        console.log('Fetching analytics from:', `${API_URL}/admin/analytics`);

        const response = await axios.get(`${API_URL}/admin/analytics`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        console.log('Analytics response:', response.data);

        const { data } = response;
        setStats({
          totalMessages: data.totalMessages || 0,
          spamCount: data.spamCount || 0,
          cleanCount: data.cleanCount || 0,
          detectionRate: data.detectionRate || 0,
          messagesByPeriod: Array.isArray(data.messagesByPeriod) ? data.messagesByPeriod : [],
          accuracyByChannel: data.accuracyByChannel || {}
        });
      } catch (error) {
        console.error('Error fetching analytics:', error);
        toast.error('Failed to load analytics: ' + (error.message || 'Unknown error'));
        setStats({
          totalMessages: 0,
          spamCount: 0,
          cleanCount: 0,
          detectionRate: 0,
          messagesByPeriod: [],
          accuracyByChannel: {}
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
    // Set up auto-refresh every 5 minutes
    const refreshInterval = setInterval(fetchAnalytics, 5 * 60 * 1000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Prepare chart data from API response
  const lineChartData = {
    labels: stats.messagesByPeriod && stats.messagesByPeriod.length > 0 
      ? stats.messagesByPeriod.map(item => item.period?.split('T')[0] || 'N/A')
      : [],
    datasets: [
      {
        label: 'Spam Messages',
        data: stats.messagesByPeriod && stats.messagesByPeriod.length > 0
          ? stats.messagesByPeriod.map(item => item.spamCount || 0)
          : [],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        tension: 0.1,
        fill: true
      },
      {
        label: 'Clean Messages',
        data: stats.messagesByPeriod && stats.messagesByPeriod.length > 0
          ? stats.messagesByPeriod.map(item => item.cleanCount || 0)
          : [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        tension: 0.1,
        fill: true
      },
    ],
  };

  const barChartData = {
    labels: Object.keys(stats.accuracyByChannel || {}),
    datasets: [
      {
        label: 'Detection Accuracy by Channel (%)',
        data: Object.values(stats.accuracyByChannel || {}),
        backgroundColor: [
          'rgba(53, 162, 235, 0.7)',
          'rgba(75, 192, 192, 0.7)',
          'rgba(255, 159, 64, 0.7)',
          'rgba(153, 102, 255, 0.7)'
        ],
        borderColor: [
          'rgb(53, 162, 235)',
          'rgb(75, 192, 192)',
          'rgb(255, 159, 64)',
          'rgb(153, 102, 255)'
        ],
        borderWidth: 1,
      },
    ],
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="">
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Analytics Dashboard</h1>
        <p className="text-gray-500 mt-1">Real-time spam detection analytics and insights</p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Total Messages</h3>
              <p className="text-3xl font-bold mt-2">{(stats.totalMessages || 0).toLocaleString()}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v12m8-12v12m-4-12v12" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Spam Detected</h3>
              <p className="text-3xl font-bold mt-2 text-red-600">{(stats.spamCount || 0).toLocaleString()}</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Clean Messages</h3>
              <p className="text-3xl font-bold mt-2 text-green-600">{(stats.cleanCount || 0).toLocaleString()}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-500 text-sm font-medium">Detection Rate</h3>
              <p className="text-3xl font-bold mt-2 text-blue-600">{(stats.detectionRate || 0).toFixed(1)}%</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Message Trends</h3>
          {stats.messagesByPeriod && stats.messagesByPeriod.length > 0 ? (
            <div className="h-[400px]">
              <Line 
                data={lineChartData} 
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    intersect: false,
                    mode: 'index'
                  },
                  plugins: {
                    legend: {
                      position: 'bottom'
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center">
              <p className="text-gray-500">No data available for chart</p>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Detection Accuracy by Channel</h3>
          {Object.keys(stats.accuracyByChannel || {}).length > 0 ? (
            <div className="h-[400px]">
              <Bar 
                data={barChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  indexAxis: 'x',
                  plugins: {
                    legend: {
                      position: 'bottom'
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      max: 100,
                      title: {
                        display: true,
                        text: 'Accuracy (%)'
                      }
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center">
              <p className="text-gray-500">No data available for chart</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;