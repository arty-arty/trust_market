import React from 'react';
import { Outlet } from 'react-router-dom';
import { Flex, Box } from '@radix-ui/themes';
import { BackButton } from './BackButton';

export function MarketplaceLayout() {
  return (
    <div className="design-flex design-flex-col design-gap-4">
      <BackButton />
      <div className="design-page-enter design-page-enter-active">
        <Outlet />
      </div>
    </div>
  );
}
