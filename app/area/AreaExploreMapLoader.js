'use client';

import dynamic from 'next/dynamic';

const AreaExploreMap = dynamic(() => import('./AreaExploreMap'), { ssr: false });

export default function AreaExploreMapLoader(props) {
  return <AreaExploreMap {...props} />;
}
