'use client';

import React from 'react';
import {
  Users, Send, FileText, DollarSign, TrendingUp, TrendingDown, AlertCircle, Crown, BarChart3, LineChart as LineChartIcon, Activity, Target, Award, Star, MessageSquare, UserCheck, UserX, UserPlus
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line
} from 'recharts';

// --- Mock Data Structures ---
interface StatCard {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  trendColor?: string;
  subtext?: string;
}

interface CampaignPerformance {
  id: string;
  name: string;
  sent: number;
  opened: number;
  clicked: number;
  conversionRate: number; // percentage
  status: 'Active' | 'Completed' | 'Paused';
}

interface UserKPI {
  id: string;
  name: string;
  avatarUrl: string;
  leadsGenerated: number;
  dealsClosed: number;
  revenueGenerated: number; // in USD
  activityScore: number; // 0-100
  role: 'Admin' | 'Manager' | 'Agent';
}

// --- Mock Data ---
const generalStats: StatCard[] = [
  { title: 'Total Leads', value: '2,480', icon: <Users size={24} className="text-info" />, trend: '+120', trendColor: 'text-success', subtext: 'This month' },
  { title: 'Active Campaigns', value: '5', icon: <Send size={24} className="text-success" />, trend: '-2', trendColor: 'text-warning', subtext: 'vs last month' },
  { title: 'Avg. Open Rate', value: '28.6%', icon: <MessageSquare size={24} className="text-primary" />, trend: '+1.5%', trendColor: 'text-success', subtext: 'All campaigns' },
  { title: 'Deals Closed (QTD)', value: '132', icon: <DollarSign size={24} className="text-accent" />, trend: '+18', trendColor: 'text-success', subtext: 'Target: 200' },
];

const mockCampaignPerformances: CampaignPerformance[] = [
  { id: 'camp-001', name: 'Q2 Newsletter', sent: 15000, opened: 4200, clicked: 750, conversionRate: 5.0, status: 'Completed' },
  { id: 'camp-002', name: 'Product Launch X', sent: 9500, opened: 3800, clicked: 950, conversionRate: 10.0, status: 'Active' },
  { id: 'camp-003', name: 'Summer Sale Early Bird', sent: 22000, opened: 5500, clicked: 1100, conversionRate: 5.0, status: 'Active' },
  { id: 'camp-004', name: 'Win-Back Initiative', sent: 7000, opened: 1400, clicked: 210, conversionRate: 3.0, status: 'Paused' },
  { id: 'camp-005', name: 'Holiday Special', sent: 18000, opened: 6300, clicked: 1260, conversionRate: 7.0, status: 'Completed' },
];

const unsortedMockUserKPIs: UserKPI[] = [
  {
    id: 'user-001', name: 'Alice Wonderland',
    avatarUrl: 'https://i.pravatar.cc/150?u=alice',
    leadsGenerated: 120, dealsClosed: 15, revenueGenerated: 75000, activityScore: 92, role: 'Admin'
  },
  {
    id: 'user-002', name: 'Bob The Builder',
    avatarUrl: 'https://i.pravatar.cc/150?u=bob',
    leadsGenerated: 95, dealsClosed: 12, revenueGenerated: 62000, activityScore: 88, role: 'Manager'
  },
  {
    id: 'user-004', name: 'Diana Prince',
    avatarUrl: 'https://i.pravatar.cc/150?u=diana',
    leadsGenerated: 150, dealsClosed: 22, revenueGenerated: 110000, activityScore: 95, role: 'Agent'
  },
  {
    id: 'user-003', name: 'Charlie Brown',
    avatarUrl: 'https://i.pravatar.cc/150?u=charlie',
    leadsGenerated: 70, dealsClosed: 8, revenueGenerated: 35000, activityScore: 75, role: 'Agent'
  },
  {
    id: 'user-00X', name: 'Eve Polastri',
    avatarUrl: 'https://i.pravatar.cc/150?u=eve',
    leadsGenerated: 88, dealsClosed: 10, revenueGenerated: 52000, activityScore: 81, role: 'Agent'
  },
];

const mockUserKPIs: UserKPI[] = [...unsortedMockUserKPIs].sort((a, b) => b.revenueGenerated - a.revenueGenerated); // Sort by revenue for leaderboard

const recentActivities = [
  { icon: <UserPlus size={20} className="text-success" />, text: 'New lead "John B. Good" (Website) assigned to Diana Prince.' },
  { icon: <Send size={20} className="text-info" />, text: 'Campaign "Product Launch X" successfully sent to 9,500 contacts.' },
  { icon: <DollarSign size={20} className="text-accent" />, text: 'Deal "Gamma Inc. Onboarding" ($12,000) won by Bob The Builder.' },
  { icon: <AlertCircle size={20} className="text-warning" />, text: 'Campaign "Win-Back Initiative" has low engagement. Consider review.' },
  { icon: <UserCheck size={20} className="text-primary" />, text: 'Alice Wonderland updated settings for lead scoring.' },
  { icon: <UserX size={20} className="text-error" />, text: 'Email to "test@invalid-domain-yo.com" bounced (Hard Bounce).' },
];

// --- Email Metrics Mock Data ---
const emailMetricsData = [
  { name: 'May 1', Sent: 1200, Bounced: 45, Delivered: 1155 },
  { name: 'May 2', Sent: 1100, Bounced: 25, Delivered: 1075 },
  { name: 'May 3', Sent: 1300, Bounced: 32, Delivered: 1268 },
  { name: 'May 4', Sent: 900,  Bounced: 18, Delivered: 882 },
  { name: 'May 5', Sent: 1500, Bounced: 60, Delivered: 1440 },
  { name: 'May 6', Sent: 1700, Bounced: 55, Delivered: 1645 },
  { name: 'May 7', Sent: 1600, Bounced: 40, Delivered: 1560 },
];

// --- Chart Data Preparation ---
const campaignChartData = mockCampaignPerformances.map(c => ({
  name: c.name,
  Sent: c.sent,
  Opened: c.opened,
  Clicked: c.clicked,
}));

const leadConversionData = [
  { stage: 'New Leads', count: 2480, fill: 'hsl(var(--b3))' }, 
  { stage: 'Contacted', count: 1800, fill: 'hsl(var(--in))' }, 
  { stage: 'Qualified', count: 750, fill: 'hsl(var(--wa))' }, 
  { stage: 'Negotiation', count: 300, fill: 'hsl(var(--su))' }, 
  { stage: 'Won Deals', count: 132, fill: 'hsl(var(--ac))' }, 
];

// --- Components ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-base-300 border border-base-content/20 rounded shadow-lg">
        <p className="label font-bold text-base-content">{label}</p>
        {payload.map((entry: any) => (
          <p key={`item-${entry.name}`} style={{ color: entry.color }} className="text-sm">
            {`${entry.name}: ${entry.value.toLocaleString()}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const DashboardView: React.FC = () => {
  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-base-content mb-6">CRM Dashboard</h1>
      {/* General Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {generalStats.map((stat, index) => (
          <div key={index} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
            <div className="card-body">
              <div className="flex items-center justify-between mb-1">
                <p className="text-base-content/80 font-medium text-sm uppercase tracking-wider">{stat.title}</p>
                <div className="tooltip tooltip-left" data-tip={stat.subtext || stat.title}>
                  {stat.icon}
                </div>
              </div>
              <h2 className="card-title text-4xl font-extrabold mb-1 text-base-content">{stat.value}</h2>
              {stat.trend && (
                <div className={`flex items-center text-xs ${stat.trendColor || 'text-base-content/70'}`}>
                  {stat.trend.startsWith('+') ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
                  <span>{stat.trend} {stat.subtext && !stat.subtext.includes('month') && !stat.subtext.includes('Target') ? ' ' : ''}{stat.subtext && (stat.subtext.includes('month') || stat.subtext.includes('Target')) ? '' : 'vs last period'}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Email Metrics Chart */}
      <div className="card bg-base-100 shadow-xl mb-6">
        <div className="card-body">
          <h2 className="card-title text-xl font-semibold text-base-content mb-4 flex items-center">
            <LineChartIcon className="mr-2 text-info" /> Email Metrics (Sent, Bounced, Delivered)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={emailMetricsData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--bc) / 0.7)' }} axisLine={{strokeOpacity: 0.2}} tickLine={{strokeOpacity: 0.2}} />
              <YAxis tickFormatter={(value) => value.toLocaleString()} tick={{ fontSize: 12, fill: 'hsl(var(--bc) / 0.7)' }} axisLine={{strokeOpacity: 0.2}} tickLine={{strokeOpacity: 0.2}} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--b2))' }} />
              <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
              <Line type="monotone" dataKey="Sent" stroke="hsl(var(--in))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Bounced" stroke="hsl(var(--er))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Delivered" stroke="hsl(var(--su))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign Performance Chart */}
        <div className="lg:col-span-2 card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-xl font-semibold text-base-content mb-4 flex items-center"><BarChart3 className="mr-2 text-primary"/> Campaign Performance Overview</h2>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={campaignChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2}/>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--bc) / 0.7)' }} axisLine={{strokeOpacity: 0.2}} tickLine={{strokeOpacity: 0.2}}/>
                <YAxis tickFormatter={(value) => value.toLocaleString()} tick={{ fontSize: 12, fill: 'hsl(var(--bc) / 0.7)' }} axisLine={{strokeOpacity: 0.2}} tickLine={{strokeOpacity: 0.2}}/>
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--b2))' }}/>
                <Legend wrapperStyle={{ fontSize: '13px', paddingTop: '10px' }} />
                <Bar dataKey="Sent" fill="hsl(var(--in))" radius={[4, 4, 0, 0]} barSize={15}/>
                <Bar dataKey="Opened" fill="hsl(var(--su))" radius={[4, 4, 0, 0]} barSize={15}/>
                <Bar dataKey="Clicked" fill="hsl(var(--ac))" radius={[4, 4, 0, 0]} barSize={15}/>
              </BarChart>
            </ResponsiveContainer>
          </div>

      
        </div>

      

        {/* Lead Conversion Funnel (Simplified) */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-xl font-semibold text-base-content mb-4 flex items-center"><Target className="mr-2 text-info"/> Lead Conversion Funnel</h2>
            <ResponsiveContainer width="100%" height={350}>
               <BarChart data={leadConversionData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.2}/>
                <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} tick={{ fontSize: 12, fill: 'hsl(var(--bc) / 0.7)' }} axisLine={{strokeOpacity: 0.2}} tickLine={{strokeOpacity: 0.2}}/>
                <YAxis dataKey="stage" type="category" tick={{ fontSize: 12, fill: 'hsl(var(--bc) / 0.7)' }} width={80} axisLine={{strokeOpacity: 0.2}} tickLine={{strokeOpacity: 0.2}}/>
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--b2))' }}/>
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                  {/* Individual bar colors are set in data */} 
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

      
        </div>

      
      </div>

      

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User KPI Leaderboard */}
        <div className="lg:col-span-2 card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-xl font-semibold text-base-content mb-4 flex items-center"><Crown className="mr-2 text-warning" /> Top Performing Users (by Revenue)</h2>
            <div className="overflow-x-auto">
              <table className="table w-full table-zebra">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>User</th>
                    <th className="text-right">Leads</th>
                    <th className="text-right">Deals Closed</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-center">Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {mockUserKPIs.map((user, index) => (
                    <tr key={user.id} className="hover">
                      <td className="font-semibold">
                        {index < 3 ? <Award size={16} className={`inline mr-1 ${index === 0 ? 'text-warning' : index === 1 ? 'text-neutral-focus' : 'text-orange-400'}`} /> : ''}
                        {index + 1}
                      </td>
                      <td>
                        <div className="flex items-center space-x-3">
                          <div className="avatar">
                            <div className="mask mask-squircle w-10 h-10">
                              <img src={user.avatarUrl} alt={`${user.name}'s avatar`} />
                            </div>

      
                          </div>

      
                          <div>
                            <div className="font-bold text-base-content">{user.name}</div>
                            <div className="text-xs text-base-content/70">{user.role}</div>
                          </div>

      
                        </div>

      
                      </td>
                      <td className="text-right">{user.leadsGenerated.toLocaleString()}</td>
                      <td className="text-right">{user.dealsClosed.toLocaleString()}</td>
                      <td className="text-right font-semibold text-success">${user.revenueGenerated.toLocaleString()}</td>
                      <td className="text-center">
                        <div className="tooltip" data-tip={`Score: ${user.activityScore}/100`}>
                           <progress className="progress progress-primary w-20" value={user.activityScore} max="100"></progress>
                        </div>

      
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

      
          </div>

      
        </div>

      

        {/* Recent Activity */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title text-xl font-semibold text-base-content mb-4 flex items-center"><Activity className="mr-2 text-info"/> Recent Activities</h2>
            <ul className="space-y-3 overflow-y-auto max-h-96 pr-1">
              {recentActivities.map((activity, index) => (
                <li key={index} className="flex items-start p-2.5 rounded-lg hover:bg-base-200 transition-colors text-sm">
                  <div className="mt-0.5 mr-2.5 shrink-0">{activity.icon}</div>
                  <span className="text-base-content/90">{activity.text}</span>
                </li>
              ))}
            </ul>
          </div>

      
        </div>

      
      </div>

      

    </div>
  );
};

export default DashboardView;
