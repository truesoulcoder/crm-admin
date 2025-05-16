'use client';

import { Settings, UserCircle, Palette, Bell, Lock, Briefcase, CreditCard, HelpCircle, Moon, Sun, Info } from 'lucide-react';
import React, { useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
type NotificationChannel = 'email' | 'sms' | 'inApp';

interface ProfileSettings {
  fullName: string;
  email: string;
  timezone: string;
  language: string;
  avatarUrl?: string;
}

interface AppearanceSettings {
  theme: Theme;
  fontSize: 'small' | 'medium' | 'large';
  showTooltips: boolean;
}

interface NotificationSettings {
  newLead: NotificationChannel[];
  campaignUpdate: NotificationChannel[];
  systemAlerts: NotificationChannel[];
  newsletter: boolean;
}

interface SecuritySettings {
  twoFactorAuth: boolean;
  passwordLastChanged: string;
  activeSessions: number;
}

const mockProfile: ProfileSettings = {
  fullName: 'Casey Jones',
  email: 'casey.jones@example.com',
  timezone: 'America/New_York (GMT-4)',
  language: 'English (US)',
  avatarUrl: 'https://i.pravatar.cc/150?u=casey',
};

const mockAppearance: AppearanceSettings = {
  theme: 'system',
  fontSize: 'medium',
  showTooltips: true,
};

const mockNotifications: NotificationSettings = {
  newLead: ['email', 'inApp'],
  campaignUpdate: ['email'],
  systemAlerts: ['inApp', 'sms'],
  newsletter: true,
};

const mockSecurity: SecuritySettings = {
  twoFactorAuth: true,
  passwordLastChanged: '2024-04-15',
  activeSessions: 2,
};


const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'notifications' | 'security' | 'integrations' | 'billing' | 'support'>('profile');
  
  // Dummy state for controlled components - in a real app, these would update the mock data or backend
  const [profile, setProfile] = useState<ProfileSettings>(mockProfile);
  const [appearance, setAppearance] = useState<AppearanceSettings>(mockAppearance);
  const [notifications, setNotifications] = useState<NotificationSettings>(mockNotifications);
  const [security, setSecurity] = useState<SecuritySettings>(mockSecurity);

  const handleThemeChange = (theme: Theme) => {
    setAppearance(prev => ({ ...prev, theme }));
    // In a real app, you'd also apply the theme, e.g., by setting data-theme on <html>
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else { // system preference
        // This requires more logic to detect system preference and listen for changes
        // For DaisyUI, you might remove data-theme or set it based on prefers-color-scheme
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  };
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-base-content flex items-center"><UserCircle className="mr-3 text-primary" size={28}/> Profile Settings</h2>
            <div className="form-control">
              <label className="label"><span className="label-text">Full Name</span></label>
              <input type="text" value={profile.fullName} onChange={e => setProfile(p => ({...p, fullName: e.target.value}))} className="input input-bordered" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Email Address</span></label>
              <input type="email" value={profile.email} onChange={e => setProfile(p => ({...p, email: e.target.value}))} className="input input-bordered" />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Timezone</span></label>
              <select className="select select-bordered" value={profile.timezone} onChange={e => setProfile(p => ({...p, timezone: e.target.value}))}>
                <option>America/New_York (GMT-4)</option>
                <option>Europe/London (GMT+1)</option>
                <option>Asia/Tokyo (GMT+9)</option>
              </select>
            </div>
             <div className="form-control">
                <label className="label"><span className="label-text">Avatar URL (Optional)</span></label>
                <input type="url" value={profile.avatarUrl} onChange={e => setProfile(p => ({...p, avatarUrl: e.target.value}))} placeholder="https://example.com/avatar.png" className="input input-bordered" />
            </div>
            <button className="btn btn-primary">Update Profile</button>
          </div>
        );
      case 'appearance':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-base-content flex items-center"><Palette className="mr-3 text-accent" size={28}/> Appearance</h2>
            <div className="form-control">
              <label className="label"><span className="label-text">Theme</span></label>
              <div className="flex gap-2">
                <button className={`btn ${appearance.theme === 'light' ? 'btn-active' : ''}`} onClick={() => handleThemeChange('light')}><Sun size={16} className="mr-1"/> Light</button>
                <button className={`btn ${appearance.theme === 'dark' ? 'btn-active' : ''}`} onClick={() => handleThemeChange('dark')}><Moon size={16} className="mr-1"/> Dark</button>
                <button className={`btn ${appearance.theme === 'system' ? 'btn-active' : ''}`} onClick={() => handleThemeChange('system')}>System</button>
              </div>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text">Font Size</span></label>
              <select className="select select-bordered" value={appearance.fontSize} onChange={e => setAppearance(a => ({...a, fontSize: e.target.value as any}))}>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
            <div className="form-control">
                <label className="label cursor-pointer justify-start gap-2">
                    <input type="checkbox" checked={appearance.showTooltips} onChange={e => setAppearance(a => ({...a, showTooltips: e.target.checked}))} className="checkbox checkbox-primary" />
                    <span className="label-text">Show Tooltips</span> 
                </label>
            </div>
            <button className="btn btn-primary">Save Appearance</button>
          </div>
        );
      case 'notifications':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-base-content flex items-center"><Bell className="mr-3 text-info" size={28}/> Notification Settings</h2>
            {/* Simplified for brevity - In a real app, this would be more detailed */}
            <p>Configure how you receive notifications for various events.</p>
            <div className="form-control">
                <label className="label cursor-pointer justify-start gap-2">
                    <input type="checkbox" checked={notifications.newsletter} onChange={e => setNotifications(n => ({...n, newsletter: e.target.checked}))} className="checkbox checkbox-primary" />
                    <span className="label-text">Subscribe to Newsletter</span> 
                </label>
            </div>
            <p className="text-sm text-base-content/70">Detailed notification channel settings (Email, SMS, In-App) for New Leads, Campaign Updates, System Alerts would go here.</p>
            <button className="btn btn-primary">Update Notifications</button>
          </div>
        );
      case 'security':
         return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-base-content flex items-center"><Lock className="mr-3 text-error" size={28}/> Security Settings</h2>
            <div className="form-control">
                <label className="label cursor-pointer justify-start gap-2">
                    <input type="checkbox" checked={security.twoFactorAuth} onChange={e => setSecurity(s => ({...s, twoFactorAuth: e.target.checked}))} className="checkbox checkbox-primary" />
                    <span className="label-text">Enable Two-Factor Authentication (2FA)</span> 
                </label>
            </div>
            <p className="text-sm">Password last changed: {new Date(security.passwordLastChanged).toLocaleDateString()}</p>
            <p className="text-sm">Active sessions: {security.activeSessions}</p>
            <div className="flex gap-2">
                <button className="btn btn-secondary">Change Password</button>
                <button className="btn btn-outline btn-error">Log out all other sessions</button>
            </div>
          </div>
        );
      // Placeholder for other tabs
      default:
        return (
            <div className="card bg-base-200">
                <div className="card-body items-center text-center">
                    <Info size={48} className="text-neutral mb-4" />
                    <h2 className="card-title">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
                    <p>Settings for {activeTab} will be displayed here.</p>
                </div>
            </div>
        );
    }
  };

  const settingsTabs = [
    { id: 'profile', label: 'Profile', icon: UserCircle },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'integrations', label: 'Integrations', icon: Briefcase },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'support', label: 'Support', icon: HelpCircle },
  ] as const; // Use "as const" for stricter type checking on tab IDs

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-base-content mb-8 flex items-center">
        <Settings size={32} className="mr-3 text-warning" /> Application Settings
      </h1>
      
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation for Settings */}
        <div className="w-full md:w-1/4 card bg-base-100 shadow-lg p-2">
          <ul className="menu p-2 rounded-box">
            {settingsTabs.map(tab => (
              <li key={tab.id}>
                <a 
                  className={`${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)} // Cast needed due to "as const"
                >
                  <tab.icon size={18} className="mr-2" /> {tab.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Main Content Area for Settings */}
        <div className="w-full md:w-3/4 card bg-base-100 shadow-lg p-6 md:p-8">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;