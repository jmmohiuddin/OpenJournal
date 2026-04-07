import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { updateUser } from '../../store/authSlice';
import api from '../../services/api';

const STAGES = ['welcome', 'values', 'challenges', 'goals', 'summary'];

export default function OnboardingInterview({ onComplete }) {
  const [stage, setStage] = useState(0);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Fetch question for current stage
  useEffect(() => {
    fetchQuestion();
  }, [stage]);

  // Typewriter effect for questions
  useEffect(() => {
    if (!currentQuestion) return;
    
    setIsTyping(true);
    setDisplayedText('');
    let index = 0;
    
    const interval = setInterval(() => {
      if (index < currentQuestion.length) {
        setDisplayedText(prev => prev + currentQuestion[index]);
        index++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 30);
    
    return () => clearInterval(interval);
  }, [currentQuestion]);

  const fetchQuestion = async () => {
    setIsLoading(true);
    try {
      const response = await api.post('/ai/onboarding', {
        stage: STAGES[stage],
        previousAnswers: answers
      });
      setCurrentQuestion(response.data.question);
    } catch (error) {
      console.error('Failed to get question:', error);
      // Fallback questions
      const fallbacks = {
        welcome: "Welcome to Open Journal! What brings you here today? I'd love to understand what you're hoping to find.",
        values: "What matters most to you in life right now? What values guide your decisions?",
        challenges: "Is there anything you're currently working through or trying to figure out?",
        goals: "What do you hope to discover or achieve through reflective journaling?",
        summary: "Thank you for sharing! I'm excited to be your journaling companion on this journey."
      };
      setCurrentQuestion(fallbacks[STAGES[stage]]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentAnswer.trim() && stage !== STAGES.length - 1) return;

    // Save answer
    const newAnswers = {
      ...answers,
      [STAGES[stage]]: currentAnswer
    };
    setAnswers(newAnswers);
    setCurrentAnswer('');

    if (stage < STAGES.length - 1) {
      setStage(stage + 1);
    } else {
      // Onboarding complete - save profile and redirect
      try {
        await api.post('/auth/profile', {
          onboarded: true,
          profile: newAnswers
        });
        // Update Redux store to reflect onboarding complete
        dispatch(updateUser({ onboardingComplete: true }));
      } catch (error) {
        console.error('Failed to save profile:', error);
      }
      
      if (onComplete) {
        onComplete(newAnswers);
      } else {
        navigate('/journal');
      }
    }
  };

  const handleSkip = async () => {
    if (stage < STAGES.length - 1) {
      setStage(stage + 1);
    } else {
      // Skipping on last stage - still mark onboarding as complete
      try {
        await api.post('/auth/profile', {
          onboarded: true,
          profile: answers
        });
        dispatch(updateUser({ onboardingComplete: true }));
      } catch (error) {
        console.error('Failed to save profile:', error);
      }
      navigate('/journal');
    }
  };

  const handleSkipAll = async () => {
    try {
      await api.post('/auth/profile', {
        onboarded: true,
        profile: {}
      });
      dispatch(updateUser({ onboardingComplete: true }));
    } catch (error) {
      console.error('Failed to skip onboarding:', error);
    }
    navigate('/journal');
  };

  const isSummaryStage = STAGES[stage] === 'summary';

  return (
    <div className="min-h-screen bg-gradient-to-br from-alice-blue via-white to-lavender-web flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {STAGES.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= stage ? 'bg-blue-eyes' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* The Guide Avatar */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-eyes to-lavender-web flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🌟</span>
          </div>
          <div className="flex-1">
            <p className="text-sm text-blue-eyes font-medium mb-1">The Guide</p>
            <div className="bg-white rounded-2xl rounded-tl-sm p-6 shadow-sm border border-lavender-web">
              {isLoading ? (
                <div className="flex items-center gap-2 text-gray-400">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                    <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                  </div>
                </div>
              ) : (
                <p className="text-gray-700 leading-relaxed font-journal text-lg">
                  {displayedText}
                  {isTyping && <span className="inline-block w-0.5 h-5 bg-blue-eyes ml-1 animate-pulse" />}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* User Response */}
        {!isLoading && !isTyping && (
          <form onSubmit={handleSubmit} className="mt-6">
            {!isSummaryStage ? (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-lavender-web">
                <textarea
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="Share your thoughts..."
                  className="w-full p-3 border-none resize-none focus:outline-none focus:ring-0 text-gray-700 font-journal text-lg min-h-[120px]"
                  autoFocus
                />
                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Skip for now
                  </button>
                  <button
                    type="submit"
                    disabled={!currentAnswer.trim()}
                    className="px-6 py-2 bg-blue-eyes text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <button
                  type="submit"
                  className="px-8 py-3 bg-gradient-to-r from-blue-eyes to-honeydew text-white rounded-xl hover:shadow-lg transition-all font-medium"
                >
                  Begin My Journey ✨
                </button>
              </div>
            )}
          </form>
        )}

        {/* Stage indicator and Skip All button */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-sm text-gray-400">
            {stage + 1} of {STAGES.length}
          </p>
          <button
            type="button"
            onClick={handleSkipAll}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors underline"
          >
            Skip onboarding and go to journal
          </button>
        </div>
      </div>
    </div>
  );
}
