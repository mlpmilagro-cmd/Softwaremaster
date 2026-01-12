
import React, { FC } from 'react';

const LoadingSpinner: FC = () => (
    <div className="flex justify-center items-center h-full py-8">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-dece-blue-500"></div>
    </div>
);

export default LoadingSpinner;
