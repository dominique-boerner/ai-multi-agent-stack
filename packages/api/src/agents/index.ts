import { WriteTicketsCapability } from './product-owner/WriteTicketsCapability';
import { WriteCodeCapability } from './developer/WriteCodeCapability';
import { ReviewCodeCapability } from './reviewer/ReviewCodeCapability';

/**
 * Global registry for all available Agent Capabilities.
 * Use this in agent-stack.config.ts to assign capabilities to agents.
 */
export const CapabilityRegistry = {
  writeTickets: new WriteTicketsCapability(),
  writeCode:    new WriteCodeCapability(),
  reviewCode:   new ReviewCodeCapability(),
};

export * from './product-owner/WriteTicketsCapability';
export * from './developer/WriteCodeCapability';
export * from './reviewer/ReviewCodeCapability';
