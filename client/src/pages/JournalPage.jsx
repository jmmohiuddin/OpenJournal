import { useDispatch, useSelector } from 'react-redux';
import JournalEditor from '../components/Editor/JournalEditor';
import { createEntry } from '../store/entriesSlice';

export default function JournalPage() {
  const dispatch = useDispatch();
  const { loading } = useSelector(state => state.entries);

  const handleSave = async (entryData) => {
    try {
      await dispatch(createEntry(entryData)).unwrap();
    } catch (err) {
      console.error('Failed to save entry:', err);
    }
  };

  return (
    <div className="py-8">
      <div className="max-w-3xl mx-auto mb-8">
        <h1 className="text-3xl font-semibold text-gray-800 mb-2 font-journal">
          Today's Reflection
        </h1>
        <p className="text-gray-600 font-system">
          Take a moment to capture your thoughts, challenges, or insights.
        </p>
      </div>

      <JournalEditor onSave={handleSave} loading={loading} />
    </div>
  );
}
