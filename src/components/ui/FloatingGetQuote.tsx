import React, { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { trackEvent } from '../../utils/analytics';

const FloatingGetQuote: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    trackEvent('floating-get-quote-click');
    navigate('/contact');
  };

  return (
    <>
      {isVisible && (
        <button
          onClick={handleClick}
          className="fixed bottom-6 right-6 px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 z-50 flex items-center gap-2 font-semibold animate-pulse hover:animate-none"
          aria-label="Get a quote"
        >
          <MessageSquare size={20} />
          <span className="hidden sm:inline">Get Quote</span>
        </button>
      )}
    </>
  );
};

export default FloatingGetQuote;
