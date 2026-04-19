import { useDispatch, useSelector } from 'react-redux';
import JournalEditor from '../components/Editor/JournalEditor';
import { createEntry, createEntryFromImage } from '../store/entriesSlice';

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

  const handleImageUpload = async (formData) => {
    try {
      await dispatch(createEntryFromImage(formData)).unwrap();
    } catch (err) {
      console.error('Failed to process image:', err);
      throw err; // Re-throw so the editor can show an error state
    }
  };

  return (
    <div className="py-4 sm:py-8">
      <div className="container-app mb-4 sm:mb-8">
        <h1 className="text-fluid-h1 font-semibold text-gray-800 mb-1.5 font-journal">
          Today's Reflection
        </h1>
        <p className="text-gray-500 font-system text-sm sm:text-base mb-6">
          Take a moment to capture your thoughts, challenges, or insights.
        </p>
        
        <JournalEditor onSave={handleSave} onImageUpload={handleImageUpload} loading={loading} />
      </div>
    </div>
  );
}
