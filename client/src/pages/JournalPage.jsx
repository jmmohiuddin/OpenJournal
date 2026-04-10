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
    <div className="py-4 sm:py-8">
      <div className="container-app mb-4 sm:mb-8">
        <h1 className="text-fluid-h1 font-semibold text-gray-800 mb-1.5 font-journal">
          Today's Reflection
        </h1>
        <p className="text-gray-500 font-system text-sm sm:text-base">
          Take a moment to capture your thoughts, challenges, or insights.
        </p>
      </div>

      <JournalEditor onSave={handleSave} loading={loading} />
    </div>
  );
}
