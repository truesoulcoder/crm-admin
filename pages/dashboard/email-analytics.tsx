import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Types
type TimeRange = '24h' | '7d' | '30d' | '90d';
type EmailMetrics = {
  totals: {
    sent: number;
    delivered: number;
    bounced: number;
    opened: number;
    clicked: number;
    replied: number;
  };
  rates: {
    delivery: number;
    open: number;
    click: number;
    reply: number;
  };
  timeSeries: Array<{
    date_group: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
  }>;
  bySender: Array<{
    sender: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
  }>;
};

// Color palette for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function EmailAnalytics() {
  const { data: session } = useSession();
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [selectedTab, setSelectedTab] = useState(0);
  const [metrics, setMetrics] = useState<EmailMetrics>({
    totals: {
      sent: 0,
      delivered: 0,
      bounced: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
    },
    rates: {
      delivery: 0,
      open: 0,
      click: 0,
      reply: 0,
    },
    timeSeries: [],
    bySender: [],
  });

  // Mock data - replace with actual API calls
  useEffect(() => {
    // Simulate API call
    const fetchData = async () => {
      // In a real app, you would fetch this from your API
      // const response = await fetch(`/api/email-metrics?range=${timeRange}`);
      // const data = await response.json();
      
      // Mock data
      const mockData: EmailMetrics = {
        totals: {
          sent: 1245,
          delivered: 1200,
          bounced: 45,
          opened: 850,
          clicked: 420,
          replied: 210,
        },
        rates: {
          delivery: 96.4,
          open: 70.8,
          click: 35.0,
          reply: 17.5,
        },
        timeSeries: Array.from({ length: 7 }, (_, i) => ({
          date_group: `${i + 1} day${i > 0 ? 's' : ''} ago`,
          sent: Math.floor(Math.random() * 200) + 100,
          delivered: Math.floor(Math.random() * 190) + 90,
          opened: Math.floor(Math.random() * 150) + 70,
          clicked: Math.floor(Math.random() * 100) + 30,
          replied: Math.floor(Math.random() * 50) + 10,
        })),
        bySender: [
          {
            sender: 'sender1@example.com',
            sent: 450,
            delivered: 440,
            opened: 320,
            clicked: 180,
            replied: 90,
            openRate: 72.7,
            clickRate: 40.9,
            replyRate: 20.5,
          },
          {
            sender: 'sender2@example.com',
            sent: 400,
            delivered: 390,
            opened: 280,
            clicked: 120,
            replied: 60,
            openRate: 71.8,
            clickRate: 30.8,
            replyRate: 15.4,
          },
          {
            sender: 'sender3@example.com',
            sent: 395,
            delivered: 380,
            opened: 250,
            clicked: 120,
            replied: 60,
            openRate: 65.8,
            clickRate: 31.6,
            replyRate: 15.8,
          },
        ],
      };

      setMetrics(mockData);
    };

    fetchData();
  }, [timeRange]);

  // KPI data for the top cards
  const kpiData = [
    {
      name: 'Sent',
      value: metrics.totals.sent,
      change: '',
      changeType: 'positive',
    },
    {
      name: 'Delivered',
      value: metrics.totals.delivered,
      change: `${metrics.rates.delivery}%`,
      changeType: 'positive',
    },
    {
      name: 'Opened',
      value: metrics.totals.opened,
      change: `${metrics.rates.open}%`,
      changeType: 'positive',
    },
    {
      name: 'Clicked',
      value: metrics.totals.clicked,
      change: `${metrics.rates.click}%`,
      changeType: 'positive',
    },
    {
      name: 'Replied',
      value: metrics.totals.replied,
      change: `${metrics.rates.reply}%`,
      changeType: 'positive',
    },
  ];

  // Data for the pie chart
  const pieData = [
    { name: 'Sent', value: metrics.totals.sent },
    { name: 'Delivered', value: metrics.totals.delivered },
    { name: 'Opened', value: metrics.totals.opened },
    { name: 'Clicked', value: metrics.totals.clicked },
    { name: 'Replied', value: metrics.totals.replied },
  ].filter(item => item.value > 0);

  // Data for sender performance
  const senderData = metrics.bySender.map(sender => ({
    name: sender.sender.split('@')[0],
    'Open Rate': sender.openRate,
    'Click Rate': sender.clickRate,
    'Reply Rate': sender.replyRate,
  }));

  // Handle time range change
  const handleTimeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTimeRange(e.target.value as TimeRange);
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Analytics</h1>
          <p className="text-gray-500">Track your email campaign performance</p>
        </div>
        <div className="w-full md:w-48">
          <select 
            value={timeRange}
            onChange={handleTimeRangeChange}
            className="select select-bordered w-full"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {kpiData.map((item) => (
          <div key={item.name} className="card bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 text-sm">{item.name}</span>
              {item.change && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  item.changeType === 'positive' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {item.change}
                </span>
              )}
            </div>
            <h3 className="mt-1 text-xl font-semibold text-gray-900">
              {item.value.toLocaleString()}
            </h3>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs mb-6">
        <div className="flex border-b border-gray-200">
          {['Overview', 'By Sender', 'Performance'].map((tab, index) => (
            <button
              key={tab}
              className={`px-4 py-2 font-medium text-sm ${
                selectedTab === index
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setSelectedTab(index)}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="mt-4">
          {selectedTab === 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Email Activity</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metrics.timeSeries}
                      margin={{
                        top: 5,
                        right: 30,
                        left: 20,
                        bottom: 5,
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date_group" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="sent" stackId="a" fill="#9CA3AF" name="Sent" />
                      <Bar dataKey="delivered" stackId="a" fill="#10B981" name="Delivered" />
                      <Bar dataKey="opened" fill="#3B82F6" name="Opened" />
                      <Bar dataKey="clicked" fill="#6366F1" name="Clicked" />
                      <Bar dataKey="replied" fill="#8B5CF6" name="Replied" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="card bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Email Status</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        animationBegin={0}
                        animationDuration={1000}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [value, 'Emails']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {pieData.map((item, index) => (
                    <div key={item.name} className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-gray-700">{item.name}</span>
                      <span className="ml-auto font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {selectedTab === 1 && (
            <div className="card bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Engagement by Sender</h2>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={senderData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`${value}%`]} />
                    <Legend />
                    <Bar dataKey="Open Rate" fill="#3B82F6" name="Open Rate" />
                    <Bar dataKey="Click Rate" fill="#6366F6" name="Click Rate" />
                    <Bar dataKey="Reply Rate" fill="#8B5CF6" name="Reply Rate" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          
          {selectedTab === 2 && (
            <div className="card bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Performance Metrics</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Delivery Status</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={[
                          { name: 'Sent', value: metrics.totals.sent },
                          { name: 'Delivered', value: metrics.totals.delivered },
                          { name: 'Bounced', value: metrics.totals.bounced },
                        ]}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" fill="#10B981" name="Count" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-2">Engagement Rates</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Open Rate', value: metrics.rates.open, color: 'bg-blue-600' },
                      { label: 'Click Rate', value: metrics.rates.click, color: 'bg-indigo-600' },
                      { label: 'Reply Rate', value: metrics.rates.reply, color: 'bg-purple-600' },
                    ].map((metric) => (
                      <div key={metric.label}>
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-700">{metric.label}</span>
                          <span className="font-medium">{metric.value.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div 
                            className={`h-2.5 rounded-full ${metric.color}`}
                            style={{ width: `${Math.min(100, metric.value)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
