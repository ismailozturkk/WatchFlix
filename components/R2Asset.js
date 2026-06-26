import React from 'react';
import { Image } from 'expo-image';

const BASE_URL = "https://pub-8da9947755d445ebb717219a6bd737b5.r2.dev";

/**
 * @param {string} category - 'avatar', 'iconsBackground', 'pets'
 * @param {string} fileName - dosya adı (örn: 'eren.webp','1.png')
 */
export const R2Asset = ({ category, fileName, style, ...props }) => {
  const uri = `${BASE_URL}/${category}/${fileName}`;

  return (
    <Image
      source={{ uri }}
      style={style}
      transition={200}
      contentFit="contain" // Sprite ve ikonlar için 'contain' genelde daha iyidir
      cachePolicy="disk"
      {...props}
    />
  );
};