import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

export default function WaitlistPage() {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // If not waitlisted, redirect to home
    if (user && user.status !== 'waitlist') {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user) return null;

  const referralLink = `${window.location.origin}/register?ref=${user.referralCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#EDF2FB' }}>
      <div className="max-w-2xl w-full bg-white/80 backdrop-blur-md rounded-3xl shadow-xl p-10 text-center relative overflow-hidden text-gray-800">
        <h1 className="text-4xl font-light mb-4">You're on the list.</h1>
        <p className="text-lg text-gray-600 mb-8 font-light">
          We limit our initial Founder Circle to maintain a high signal-to-noise ratio. 
          Thank you for joining the Open Journal journey.
        </p>

        <div className="my-10 p-8 rounded-2xl bg-blue-50 border border-blue-100 flex flex-col items-center justify-center shadow-inner">
          <p className="text-sm font-medium text-blue-400 uppercase tracking-widest mb-2">Your Current Position</p>
          <p className="text-7xl font-bold text-blue-900 drop-shadow-sm">#{user.waitlistPosition}</p>
        </div>

        <div className="mt-12 bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-2xl font-medium mb-2">Moved to action? Skip the line.</h2>
          <p className="text-gray-500 mb-6 font-light">
            Invite 3 friends to secure Early Beta Access ("Private Vault") and skip the waitlist.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <input 
              type="text" 
              readOnly 
              value={referralLink} 
              className="flex-1 w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none text-gray-600 truncate"
            />
            <button 
              onClick={copyToClipboard}
              className={`w-full sm:w-auto px-8 py-3 rounded-xl font-medium transition duration-300 ${
                copied 
                  ? 'bg-green-500 text-white shadow-green-500/30' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/30'
              } shadow-lg`}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
          <div className="mt-6 flex justify-between items-center text-sm font-medium text-gray-400 border-t border-gray-100 pt-6">
            <span>Current Referrals: {user.referrals || 0}</span>
            <span>Target: 3</span>
          </div>
        </div>
      </div>
    </div>
  );
}
