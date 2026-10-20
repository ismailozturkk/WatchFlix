import React from 'react';
import * as VectorIcons from '@expo/vector-icons';

export default function AppIcon({ family = 'Ionicons', name, size = 24, color = 'black', style, ...props }) {
  const IconComponent = VectorIcons[family];

  if (!IconComponent || !name) {
    return <VectorIcons.Ionicons name="warning" size={size} color="#EF4444" style={style} {...props} />;
  }

  return <IconComponent name={name} size={size} color={color} style={style} {...props} />;
}
