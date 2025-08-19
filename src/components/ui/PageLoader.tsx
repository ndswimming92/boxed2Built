import React from 'react';
import FlapLoader from './FlapLoader';

interface PageLoaderProps {
  message?: string;
  isDoneLoading?: boolean;
}

const PageLoader: React.FC<PageLoaderProps> = ({ 
  message = 'Loading...',
  isDoneLoading = false
}) => {
  return (
    <FlapLoader isDoneLoading={isDoneLoading} message={message} />
  );
};

export default PageLoader;