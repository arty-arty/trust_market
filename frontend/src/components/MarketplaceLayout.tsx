import React from 'react';
import { Outlet } from 'react-router-dom';
import { Flex, Box } from '@radix-ui/themes';
import { BackButton } from './BackButton';

export function MarketplaceLayout() {
  return (
    <Flex direction="column" gap="3">
      <Box>
        <BackButton />
      </Box>
      <Outlet />
    </Flex>
  );
}
