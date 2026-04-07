import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

export default function ProfilePage() {
  const { user } = useSelector(state => state.auth);

  const getMoodEmoji = (mood) => {
    const moods = {
      hopeful: '🌟',
      anxious: '😰',
      reflective: '🤔',
      frustrated: '😤',
      grateful: '🙏',
      confused: '😕',
      determined: '💪',
      melancholic: '😢'
    };
    return moods[mood] || '📝';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-800">Your Profile</h1>
        <p className="text-gray-500 mt-1">View and manage your Open Journal profile</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-lavender-web mb-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-eyes to-lavender-web flex items-center justify-center flex-shrink-0">
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <span className="text-2xl font-semibold text-white">
                {user?.displayName?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-800">{user?.displayName}</h2>
            <p className="text-gray-500">{user?.email}</p>
            <p className="text-sm text-gray-400 mt-1">
              Member since {user?.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : 'recently'}
            </p>
          </div>
          <Link
            to="/settings"
            className="px-4 py-2 text-sm text-blue-eyes border border-blue-eyes rounded-lg hover:bg-blue-eyes/10 transition"
          >
            Edit Profile
          </Link>
        </div>
      </div>

      {/* Discovery Status */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-lavender-web mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-800">Discovery Status</h3>
            <p className="text-sm text-gray-500 mt-1">
              {user?.discoveryEnabled 
                ? 'Your discoverable entries can be matched with others'
                : 'Discovery is disabled - entries won\'t be matched'}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            user?.discoveryEnabled 
              ? 'bg-honeydew text-green-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {user?.discoveryEnabled ? 'Active' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Values */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-lavender-web mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-800">Your Values</h3>
          <Link to="/settings" className="text-sm text-blue-eyes hover:underline">
            Edit
          </Link>
        </div>
        {user?.values?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {user.values.map(value => (
              <span
                key={value}
                className="px-3 py-1.5 bg-lavender-web rounded-full text-sm text-gray-700"
              >
                {value}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No values added yet.{' '}
            <Link to="/settings" className="text-blue-eyes hover:underline">Add some</Link>
          </p>
        )}
      </div>

      {/* Interests */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-lavender-web mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-gray-800">Your Interests</h3>
          <Link to="/settings" className="text-sm text-blue-eyes hover:underline">
            Edit
          </Link>
        </div>
        {user?.interests?.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {user.interests.map(interest => (
              <span
                key={interest}
                className="px-3 py-1.5 bg-honeydew rounded-full text-sm text-gray-700"
              >
                {interest}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No interests added yet.{' '}
            <Link to="/settings" className="text-blue-eyes hover:underline">Add some</Link>
          </p>
        )}
      </div>

      {/* Onboarding Profile (if completed) */}
      {user?.onboardingProfile && Object.keys(user.onboardingProfile).length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-lavender-web">
          <h3 className="font-medium text-gray-800 mb-4">Your Journey Story</h3>
          <p className="text-sm text-gray-500 mb-4">
            What you shared during onboarding with The Guide
          </p>
          <div className="space-y-4">
            {user.onboardingProfile.welcome && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">WHAT BROUGHT YOU HERE</p>
                <p className="text-sm text-gray-700 font-journal">
                  {user.onboardingProfile.welcome}
                </p>
              </div>
            )}
            {user.onboardingProfile.values && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">WHAT MATTERS TO YOU</p>
                <p className="text-sm text-gray-700 font-journal">
                  {user.onboardingProfile.values}
                </p>
              </div>
            )}
            {user.onboardingProfile.challenges && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">CURRENT CHALLENGES</p>
                <p className="text-sm text-gray-700 font-journal">
                  {user.onboardingProfile.challenges}
                </p>
              </div>
            )}
            {user.onboardingProfile.goals && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">YOUR GOALS</p>
                <p className="text-sm text-gray-700 font-journal">
                  {user.onboardingProfile.goals}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
