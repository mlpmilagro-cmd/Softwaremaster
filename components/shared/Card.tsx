
import React, { FC, ReactNode } from 'react';

const Card: FC<{ children: ReactNode; className?: string, onClick?: () => void }> = ({ children, className, onClick }) => (
    <div onClick={onClick} className={`bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 ${className}`}>{children}</div>
);

export default Card;
