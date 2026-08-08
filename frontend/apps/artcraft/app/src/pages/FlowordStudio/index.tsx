import React from 'react';
import { FlowordApp } from './src/FlowordApp';
import { useTabStore } from '../Stores/TabState';
import './src/index.css';

export const PageFlowordStudio: React.FC = () => {
  const setActiveTab = useTabStore((state) => state.setActiveTab);

  return (
    <div className="h-[calc(100vh-56px)] w-full overflow-hidden">
      <FlowordApp onOpenCapCutAutomation={() => void setActiveTab('CAPCUT_AUTOMATION')} />
    </div>
  );
};

export default PageFlowordStudio;
