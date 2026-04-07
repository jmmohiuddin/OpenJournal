import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { updateUser } from '../store/authSlice';
import api from '../services/api';

export default function SettingsPage() {
  const { user } = useSelector(state => state.auth);
  const dispatch = useDispatch();
  
  const [settings, setSettings] = useState({
    displayName: user?.displayName || '',
    discoveryEnabled: user?.discoveryEnabled ?? true,
    values: user?.values || [],
    interests: user?.interests || []
  });
  const [newValue, setNewValue] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (user) {
      setSettings({
        displayName: user.displayName || '',
        discoveryEnabled: user.discoveryEnabled ?? true,
        values: user.values || [],
        interests: user.interests || []
      });
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const { data } = await api.put('/auth/profile', settings);
      dispatch(updateUser(data.data));
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const addValue = () => {
    if (newValue.trim() && !settings.values.includes(newValue.trim())) {
      setSettings(prev => ({
        ...prev,
        values: [...prev.values, newValue.trim()]
      }));
      setNewValue('');
    }
  };

  const removeValue = (value) => {
    setSettings(prev => ({
      ...prev,
      values: prev.values.filter(v => v !== value)
    }));
  };

  const addInterest = () => {
    if (newInterest.trim() && !settings.interests.includes(newInterest.trim())) {
      setSettings(prev => ({
        ...prev,
        interests: [...prev.interests, newInterest.trim()]
      }));
      setNewInterest('');
    }
  };

  const removeInterest = (interest) => {
    setSettings(prev => ({
      ...prev,
      interests: prev.interests.filter(i => i !== interest)
    }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-800">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your profile and preferences</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-honeydew text-green-800' 
            : 'bg-peach-crayola/50 text-gray-800'
        }`}>
          {message.text}
        </div>
      )}

      <div className="space-y-8">
        {/* Profile Section */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-lavender-web">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Profile</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={settings.displayName}
                onChange={(e) => setSettings(prev => ({ ...prev, displayName: e.target.value }))}
                className="w-full px-4 py-2 border border-lavender-web rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-eyes"
                placeholder="How others see you"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 border border-lavender-web rounded-lg bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>
          </div>
        </section>

        {/* Discovery & Privacy Section */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-lavender-web">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Discovery & Privacy</h2>
          
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-800">Enable Discovery</p>
                <p className="text-sm text-gray-500 mt-1">
                  Allow your entries to be matched with others for meaningful connections
                </p>
              </div>
              <button
                onClick={() => setSettings(prev => ({ ...prev, discoveryEnabled: !prev.discoveryEnabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.discoveryEnabled ? 'bg-blue-eyes' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.discoveryEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600">
                <strong>Note:</strong> Even with discovery enabled, only entries you mark as "discoverable" 
                when writing will be used for matching. Your private entries remain private.
              </p>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-lavender-web">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Security</h2>
          
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-800">End-to-End Encryption</p>
                <p className="text-sm text-gray-500 mt-1">
                  Encrypt journal entries locally before upload. Only you can read them.
                </p>
                <p className="text-xs text-peach-crayola mt-2">
                  ⚠️ Experimental: If you lose your password, encrypted entries cannot be recovered.
                </p>
              </div>
              <button
                onClick={() => {
                  const enabled = localStorage.getItem('oj_encryption_enabled') === 'true';
                  localStorage.setItem('oj_encryption_enabled', enabled ? 'false' : 'true');
                  setMessage({ 
                    type: 'success', 
                    text: enabled 
                      ? 'Encryption disabled. New entries will not be encrypted.' 
                      : 'Encryption enabled. New entries will be encrypted locally.'
                  });
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  typeof window !== 'undefined' && localStorage.getItem('oj_encryption_enabled') === 'true' 
                    ? 'bg-blue-eyes' 
                    : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    typeof window !== 'undefined' && localStorage.getItem('oj_encryption_enabled') === 'true' 
                      ? 'translate-x-6' 
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-lavender-web">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Your Values</h2>
          <p className="text-sm text-gray-500 mb-4">
            What matters most to you? These help us find meaningful connections.
          </p>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {settings.values.map(value => (
              <span
                key={value}
                className="inline-flex items-center gap-1 px-3 py-1 bg-lavender-web rounded-full text-sm"
              >
                {value}
                <button
                  onClick={() => removeValue(value)}
                  className="ml-1 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addValue())}
              className="flex-1 px-4 py-2 border border-lavender-web rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-eyes"
              placeholder="Add a value (e.g., authenticity, growth)"
            />
            <button
              onClick={addValue}
              className="px-4 py-2 bg-blue-eyes text-white rounded-lg hover:bg-opacity-90"
            >
              Add
            </button>
          </div>
        </section>

        {/* Interests Section */}
        <section className="bg-white rounded-xl p-6 shadow-sm border border-lavender-web">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Your Interests</h2>
          <p className="text-sm text-gray-500 mb-4">
            Topics you're curious about or want to explore.
          </p>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {settings.interests.map(interest => (
              <span
                key={interest}
                className="inline-flex items-center gap-1 px-3 py-1 bg-honeydew rounded-full text-sm"
              >
                {interest}
                <button
                  onClick={() => removeInterest(interest)}
                  className="ml-1 text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          
          <div className="flex gap-2">
            <input
              type="text"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
              className="flex-1 px-4 py-2 border border-lavender-web rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-eyes"
              placeholder="Add an interest (e.g., mindfulness, career)"
            />
            <button
              onClick={addInterest}
              className="px-4 py-2 bg-blue-eyes text-white rounded-lg hover:bg-opacity-90"
            >
              Add
            </button>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-blue-eyes text-white font-medium rounded-lg hover:bg-opacity-90 disabled:opacity-50 transition"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
