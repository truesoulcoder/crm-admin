// src/app/dashboard/page.tsx
'use client';

import { 
  Send, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users, 
  Mail,
  BarChart2,
  Activity,
  AlertCircle,
  Settings
} from 'lucide-react';

import Eli5EngineControlView from '@/components/views/Eli5EngineControlView';

const DashboardPage = () => {
  // Mock data - replace with real data from your API
  const stats = {
    totalLeads: 1245,
    activeCampaigns: 3,
    emailsSent: 8452,
    openRate: 68,
    clickRate: 12,
    replyRate: 4.5,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-base-content/70">Welcome back! Here's what's happening with your campaigns.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="badge badge-primary gap-2">
            <Activity className="h-3.5 w-3.5" />
            Live Updates
          </div>
          <div className="badge badge-ghost gap-2">
            <Clock className="h-3.5 w-3.5" />
            Updated just now
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-base-100 shadow-sm hover:shadow-md transition-shadow">
          <Statistic
            title="Total Leads"
            value={stats.totalLeads}
            prefix={<Users className="h-5 w-5 text-primary" />}
            className="font-mono"
          />
          <div className="mt-2 text-sm text-base-content/70">
            <span className="text-success">+12.5%</span> from last month
          </div>
        </Card>

        <Card className="bg-base-100 shadow-sm hover:shadow-md transition-shadow">
          <Statistic
            title="Active Campaigns"
            value={stats.activeCampaigns}
            prefix={<Send className="h-5 w-5 text-secondary" />}
            className="font-mono"
          />
          <div className="mt-2 text-sm text-base-content/70">
            <span className="text-success">+1</span> new this week
          </div>
        </Card>

        <Card className="bg-base-100 shadow-sm hover:shadow-md transition-shadow">
          <Statistic
            title="Emails Sent"
            value={stats.emailsSent.toLocaleString()}
            prefix={<Mail className="h-5 w-5 text-accent" />}
            className="font-mono"
          />
          <div className="mt-2 text-sm text-base-content/70">
            <span className="text-success">+8.2%</span> from last week
          </div>
        </Card>

        <Card className="bg-base-100 shadow-sm hover:shadow-md transition-shadow">
          <Statistic
            title="Avg. Open Rate"
            value={stats.openRate}
            suffix="%"
            prefix={<BarChart2 className="h-5 w-5 text-info" />}
            className="font-mono"
          />
          <div className="mt-2 text-sm text-base-content/70">
            <span className="text-success">+2.1%</span> from average
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign Stats */}
        <Card 
          title={
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              <span>Campaign Performance</span>
            </div>
          }
          className="lg:col-span-2 bg-base-100 shadow-sm"
        >
          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Open Rate</span>
                <span className="text-sm font-mono">{stats.openRate}%</span>
              </div>
              <Progress 
                percent={stats.openRate} 
                strokeColor="hsl(var(--p))" 
                showInfo={false}
                className="[&>.ant-progress-bg]:bg-primary"
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Click Rate</span>
                <span className="text-sm font-mono">{stats.clickRate}%</span>
              </div>
              <Progress 
                percent={stats.clickRate} 
                strokeColor="hsl(var(--s))" 
                showInfo={false}
                className="[&>.ant-progress-bg]:bg-secondary"
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">Reply Rate</span>
                <span className="text-sm font-mono">{stats.replyRate}%</span>
              </div>
              <Progress 
                percent={stats.replyRate} 
                strokeColor="hsl(var(--a))" 
                showInfo={false}
                className="[&>.ant-progress-bg]:bg-accent"
              />
            </div>
          </div>
          
          <Divider className="my-4" />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-base-content/70">
              <AlertCircle className="h-4 w-4" />
              <span>Last updated 5 minutes ago</span>
            </div>
            <button className="btn btn-sm btn-ghost">View All Campaigns</button>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card 
          title={
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <span>Quick Actions</span>
            </div>
          }
          className="bg-base-100 shadow-sm"
        >
          <div className="space-y-3">
            <button className="btn btn-primary btn-block justify-start gap-2">
              <Send className="h-4 w-4" />
              Start New Campaign
            </button>
            <button className="btn btn-outline btn-block justify-start gap-2">
              <Users className="h-4 w-4" />
              Import Leads
            </button>
            <button className="btn btn-outline btn-block justify-start gap-2">
              <Mail className="h-4 w-4" />
              Create Template
            </button>
            <button className="btn btn-outline btn-block justify-start gap-2">
              <BarChart2 className="h-4 w-4" />
              View Reports
            </button>
          </div>
          
          <Divider className="my-4" />
          
          <div className="space-y-2">
            <h4 className="font-medium">Recent Activity</h4>
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-start gap-3 p-2 rounded-lg hover:bg-base-200">
                  <div className="mt-0.5">
                    {item % 2 === 0 ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <XCircle className="h-4 w-4 text-error" />
                    )}
                  </div>
                  <div className="text-sm">
                    <p>Campaign "Summer Sale {item}" {item % 2 === 0 ? 'completed' : 'failed'}</p>
                    <p className="text-xs text-base-content/50">2 hours ago</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Engine Control */}
      <Card 
        title={
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            <span>Email Engine Control</span>
          </div>
        }
        className="bg-base-100 shadow-sm"
      >
        <Eli5EngineControlView />
      </Card>
    </div>
  );
};

export default DashboardPage;