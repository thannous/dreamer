import type { User } from '@supabase/supabase-js';
import type { QuotaProvider, QuotaDreamTarget } from './quota/types';
import type { QuotaStatus } from '@/lib/types';
import { GuestQuotaProvider } from './quota/GuestQuotaProvider';
import { MockQuotaProvider } from './quota/MockQuotaProvider';
import { RemoteGuestQuotaProvider } from './quota/RemoteGuestQuotaProvider';
import { SupabaseQuotaProvider } from './quota/SupabaseQuotaProvider';
import { isMockModeEnabled } from '@/lib/env';

const isMockMode = isMockModeEnabled();

/**
 * Quota service - unified interface for quota checking
 * Automatically selects the correct provider based on user authentication status
 */
class QuotaService {
  private guestProvider: GuestQuotaProvider;
  private remoteGuestProvider: QuotaProvider | null;
  private supabaseProvider: QuotaProvider;
  private mockProvider: QuotaProvider | null;
  private subscribers: Set<() => void> = new Set();

  constructor() {
    this.guestProvider = new GuestQuotaProvider();
    this.remoteGuestProvider = isMockMode ? null : new RemoteGuestQuotaProvider(this.guestProvider);
    this.supabaseProvider = new SupabaseQuotaProvider();
    this.mockProvider = isMockMode ? new MockQuotaProvider() : null;
  }

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('Quota subscriber error', error);
      }
    });
  }

  /**
   * Get the appropriate provider for the user
   */
  private getProvider(user: User | null): QuotaProvider {
    if (this.mockProvider) {
      return this.mockProvider;
    }
    if (user === null && this.remoteGuestProvider) {
      return this.remoteGuestProvider;
    }
    return user === null ? this.guestProvider : this.supabaseProvider;
  }

  /**
   * Get number of analyses performed by user
   */
  async getUsedAnalysisCount(user: User | null): Promise<number> {
    const provider = this.getProvider(user);
    return provider.getUsedAnalysisCount(user);
  }

  /**
   * Get number of dreams explored (chat started) by user
   */
  async getUsedExplorationCount(user: User | null): Promise<number> {
    const provider = this.getProvider(user);
    return provider.getUsedExplorationCount(user);
  }

  /**
   * Get number of user messages sent for a specific dream
   */
  async getUsedMessagesCount(target: QuotaDreamTarget | undefined, user: User | null): Promise<number> {
    const provider = this.getProvider(user);
    return provider.getUsedMessagesCount(target, user);
  }

  /**
   * Check if user can perform a new analysis
   */
  async canAnalyzeDream(user: User | null): Promise<boolean> {
    const provider = this.getProvider(user);
    return provider.canAnalyzeDream(user);
  }

  /**
   * Check if user can explore a specific dream (start/continue chat)
   */
  async canExploreDream(target: QuotaDreamTarget | undefined, user: User | null): Promise<boolean> {
    const provider = this.getProvider(user);
    return provider.canExploreDream(target, user);
  }

  /**
   * Check if user can send another chat message for a specific dream
   */
  async canSendChatMessage(target: QuotaDreamTarget | undefined, user: User | null): Promise<boolean> {
    const provider = this.getProvider(user);
    return provider.canSendChatMessage(target, user);
  }

  /**
   * Get complete quota status for user
   */
  async getQuotaStatus(user: User | null, target?: QuotaDreamTarget): Promise<QuotaStatus> {
    const provider = this.getProvider(user);
    return provider.getQuotaStatus(user, target);
  }

  /**
   * Invalidate quota cache
   * Should be called after any quota-consuming action
   * (analysis completed, exploration started, message sent)
   */
  invalidate(user: User | null): void {
    const provider = this.getProvider(user);
    provider.invalidate();
    this.notifySubscribers();
  }

  /**
   * Invalidate all caches (guest + authenticated)
   * Useful when user signs in/out
   */
  invalidateAll(): void {
    this.guestProvider.invalidate();
    this.remoteGuestProvider?.invalidate();
    this.supabaseProvider.invalidate();
    this.mockProvider?.invalidate();
  }
}

// Export singleton instance
export const quotaService = new QuotaService();
