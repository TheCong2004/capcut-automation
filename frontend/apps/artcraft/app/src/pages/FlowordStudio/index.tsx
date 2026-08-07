import React from 'react';
import { FlowordApp } from './src/FlowordApp';

export const PageFlowordStudio: React.FC = () => {
  return (
    <div className="h-[calc(100vh-56px)] w-full overflow-hidden">
      <FlowordApp />
    </div>
  );
};

export default PageFlowordStudio;
