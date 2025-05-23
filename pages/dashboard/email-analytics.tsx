import { useState, useEffect } from 'react';
import { Card, Title, Text, Select, Grid, DonutChart, BarChart, TabGroup, TabList, Tab, TabPanels, TabPanel } from '@tremor/react';
import { useSession } from 'next-auth/react';

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
    bounce: number;
    open: number;
    click: number;
    reply: number;
  };
  bySender: Array<{
    email: string;
    name: string;
    sent: number;
    delivered: number;
    bounced: number;
    opened: number;
    clicked: number;
    replied: number;
    deliveryRate: number;
    bounceRate: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
  }>;
  timeSeries: Array<{
    date_group: string;
    sent: number;
    delivered: number;
    bounced: number;
    opened: number;
    clicked: number;
    replied: number;
  }>;
};

export default function EmailAnalytics() {
  const { data: session } = useSession({ required: true });
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<EmailMetrics | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!session) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/email-metrics?timeRange=${timeRange}`);
        const data = await response.json();
        
        if (data.success) {
          setMetrics(data.data);
        } else {
          console.error('Failed to fetch metrics:', data.error);
        }
      } catch (error) {
        console.error('Error fetching email metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Wrap the fetchMetrics call in an async IIFE
    (async () => {
      await fetchMetrics();
    })();
  }, [timeRange, session, fetchMetrics]);

  if (!session) {
    return <div>Loading session...</div>;
  }

  if (isLoading || !metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const kpiData = [
    {
      name: 'Sent',
      value: metrics.totals.sent,
      change: 0,
      changeType: 'positive',
    },
    {
      name: 'Delivered',
      value: metrics.totals.delivered,
      change: metrics.rates.delivery.toFixed(1) + '%',
      changeType: 'positive',
    },
    {
      name: 'Bounced',
      value: metrics.totals.bounced,
      change: metrics.rates.bounce.toFixed(1) + '%',
      changeType: metrics.rates.bounce > 2 ? 'negative' : 'positive',
    },
    {
      name: 'Opened',
      value: metrics.totals.opened,
      change: metrics.rates.open.toFixed(1) + '%',
      changeType: 'positive',
    },
    {
      name: 'Clicked',
      value: metrics.totals.clicked,
      change: metrics.rates.click.toFixed(1) + '%',
      changeType: 'positive',
    },
    {
      name: 'Replied',
      value: metrics.totals.replied,
      change: metrics.rates.reply.toFixed(1) + '%',
      changeType: 'positive',
    },
  ];

  const timeSeriesData = metrics.timeSeries.map(day => ({
    date: new Date(day.date_group).toLocaleDateString(),
    Sent: day.sent,
    Delivered: day.delivered,
    Bounced: day.bounced,
    Opened: day.opened,
    Clicked: day.clicked,
  }));

  const senderData = metrics.bySender.map(sender => ({
    name: sender.name || sender.email.split('@')[0],
    'Sent': sender.sent,
    'Delivered': sender.delivered,
    'Bounced': sender.bounced,
    'Open Rate': sender.openRate,
    'Click Rate': sender.clickRate,
    'Reply Rate': sender.replyRate,
  }));

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Email Analytics</h1>
          <p className="text-gray-500">Track your email campaign performance</p>
        </div>
        <div className="w-48">
          <Select 
            value={timeRange} 
            onValueChange={(value) => setTimeRange(value as TimeRange)}
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <Grid numColsSm={2} numColsLg={3} className="gap-6 mb-6">
        {kpiData.map((item) => (
          <Card key={item.name} className="flex flex-col">
            <div className="flex items-center justify-between">
              <Text>{item.name}</Text>
              {item.name !== 'Sent' && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  item.changeType === 'positive' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {item.change}
                </span>
              )}
            </div>
            <Title className="mt-2 text-2xl font-semibold">
              {item.value.toLocaleString()}
            </Title>
          </Card>
        ))}
      </Grid>

      <TabGroup className="mb-6" onIndexChange={setSelectedTab}>
        <TabList>
          <Tab>Overview</Tab>
          <Tab>By Sender</Tab>
          <Tab>Performance</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <div className="mt-6">
              <Card>
                <Title>Email Activity Over Time</Title>
                <BarChart
                  className="mt-6"
                  data={timeSeriesData}
                  index="date"
                  categories={['Sent', 'Delivered', 'Bounced', 'Opened', 'Clicked']}
                  colors={['blue', 'green', 'red', 'yellow', 'indigo']}
                  yAxisWidth={48}
                  showAnimation={true}
                />
              </Card>
            </div>
          </TabPanel>
          <TabPanel>
            <div className="mt-6">
              <Card>
                <Title>Performance by Sender</Title>
                <BarChart
                  className="mt-6"
                  data={senderData}
                  index="name"
                  categories={['Sent', 'Delivered', 'Bounced']}
                  colors={['blue', 'green', 'red']}
                  yAxisWidth={48}
                  showAnimation={true}
                />
              </Card>
            </div>
          </TabPanel>
          <TabPanel>
            <div className="mt-6">
              <Card>
                <Title>Engagement Rates by Sender</Title>
                <BarChart
                  className="mt-6"
                  data={senderData}
                  index="name"
                  categories={['Open Rate', 'Click Rate', 'Reply Rate']}
                  colors={['blue', 'green', 'indigo']}
                  yAxisWidth={48}
                  valueFormatter={(value) => `${value}%`}
                  showAnimation={true}
                />
              </Card>
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Title>Delivery Status</Title>
          <DonutChart
            className="mt-6"
            data={[
              { name: 'Delivered', value: metrics.totals.delivered },
              { name: 'Bounced', value: metrics.totals.bounced },
              { name: 'Pending', value: Math.max(0, metrics.totals.sent - metrics.totals.delivered - metrics.totals.bounced) },
            ]}
            category="value"
            index="name"
            colors={['green', 'red', 'gray']}
            valueFormatter={(value) => `${value} emails`}
            showAnimation={true}
          />
        </Card>

        <Card>
          <Title>Engagement Metrics</Title>
          <div className="mt-6 space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <Text>Open Rate</Text>
                <Text className="font-medium">{metrics.rates.open.toFixed(1)}%</Text>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${Math.min(100, metrics.rates.open)}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <Text>Click Rate</Text>
                <Text className="font-medium">{metrics.rates.click.toFixed(1)}%</Text>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-600 h-2.5 rounded-full" 
                  style={{ width: `${Math.min(100, metrics.rates.click)}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <Text>Reply Rate</Text>
                <Text className="font-medium">{metrics.rates.reply.toFixed(1)}%</Text>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full" 
                  style={{ width: `${Math.min(100, metrics.rates.reply)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
