// components/Tag.tsx
import React from 'react';

interface TagProps {
  color?: 'green' | 'orange' | 'red' | 'blue' | 'gray';
  children: React.ReactNode;
}

const Tag: React.FC<TagProps> = ({ color = 'gray', children }) => {
  const colorClasses = {
    green: 'bg-green-100 text-green-800',
    orange: 'bg-orange-100 text-orange-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-blue-100 text-blue-800',
    gray: 'bg-gray-100 text-gray-800',
  };

  return (
    <span className={`inline-block px-2 py-1 text-xs rounded-full ${colorClasses[color]}`}>
      {children}
    </span>
  );
};

export default Tag;