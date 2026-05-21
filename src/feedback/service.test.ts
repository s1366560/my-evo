import {
  createFeedback,
  getFeedback,
  listFeedback,
  updateFeedbackStatus,
  getFeedbackStats,
  trackEvent,
  getUxAnalytics,
  startSessionMetric,
  endSessionMetric,
  setPrisma,
} from './service';

describe('FeedbackService', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      userFeedback: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
      },
      uxEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      sessionMetric: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    setPrisma(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createFeedback', () => {
    it('should create feedback with required fields', async () => {
      const mockFeedback = {
        feedback_id: 'test-feedback-id',
        user_id: null,
        node_id: 'test-node',
        type: 'general',
        rating: null,
        category: null,
        title: null,
        content: 'Test feedback content',
        metadata: {},
        status: 'pending',
        resolved_at: null,
        created_at: new Date(),
      };

      mockPrisma.userFeedback.create.mockResolvedValue(mockFeedback);

      const result = await createFeedback(null, 'test-node', {
        content: 'Test feedback content',
      });

      expect(result.feedback_id).toBe('test-feedback-id');
      expect(result.content).toBe('Test feedback content');
      expect(mockPrisma.userFeedback.create).toHaveBeenCalledTimes(1);
    });

    it('should create feedback with rating', async () => {
      const mockFeedback = {
        feedback_id: 'test-feedback-id',
        user_id: 'test-user',
        node_id: null,
        type: 'ui_feedback',
        rating: 5,
        category: 'navigation',
        title: 'Great UI',
        content: 'The navigation is intuitive',
        metadata: { browser: 'Chrome' },
        status: 'pending',
        resolved_at: null,
        created_at: new Date(),
      };

      mockPrisma.userFeedback.create.mockResolvedValue(mockFeedback);

      const result = await createFeedback('test-user', null, {
        type: 'ui_feedback',
        rating: 5,
        category: 'navigation',
        title: 'Great UI',
        content: 'The navigation is intuitive',
        metadata: { browser: 'Chrome' },
      });

      expect(result.rating).toBe(5);
      expect(result.title).toBe('Great UI');
    });

    it('should throw error for empty content', async () => {
      await expect(
        createFeedback(null, null, { content: '' }),
      ).rejects.toThrow('Feedback content is required');
    });

    it('should throw error for content exceeding limit', async () => {
      const longContent = 'a'.repeat(5001);
      await expect(
        createFeedback(null, null, { content: longContent }),
      ).rejects.toThrow('5000 characters or less');
    });

    it('should throw error for invalid rating', async () => {
      await expect(
        createFeedback(null, null, { content: 'Test', rating: 0 }),
      ).rejects.toThrow('between 1 and 5');
      await expect(
        createFeedback(null, null, { content: 'Test', rating: 6 }),
      ).rejects.toThrow('between 1 and 5');
    });
  });

  describe('getFeedback', () => {
    it('should return feedback when found', async () => {
      const mockFeedback = {
        feedback_id: 'test-id',
        user_id: null,
        node_id: 'test-node',
        type: 'general',
        rating: null,
        category: null,
        title: null,
        content: 'Test content',
        metadata: {},
        status: 'pending',
        resolved_at: null,
        created_at: new Date(),
      };

      mockPrisma.userFeedback.findUnique.mockResolvedValue(mockFeedback);

      const result = await getFeedback('test-id');

      expect(result).toBeDefined();
      expect(result?.feedback_id).toBe('test-id');
    });

    it('should return null when feedback not found', async () => {
      mockPrisma.userFeedback.findUnique.mockResolvedValue(null);

      const result = await getFeedback('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listFeedback', () => {
    it('should list feedback with pagination', async () => {
      const mockItems = [
        {
          feedback_id: 'id-1',
          user_id: null,
          node_id: 'node-1',
          type: 'general',
          rating: null,
          category: null,
          title: null,
          content: 'Content 1',
          metadata: {},
          status: 'pending',
          resolved_at: null,
          created_at: new Date(),
        },
        {
          feedback_id: 'id-2',
          user_id: null,
          node_id: 'node-2',
          type: 'bug_report',
          rating: 3,
          category: 'navigation',
          title: 'Bug',
          content: 'Content 2',
          metadata: {},
          status: 'reviewed',
          resolved_at: null,
          created_at: new Date(),
        },
      ];

      mockPrisma.userFeedback.findMany.mockResolvedValue(mockItems);
      mockPrisma.userFeedback.count.mockResolvedValue(2);

      const result = await listFeedback({ limit: 20, offset: 0 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by type and status', async () => {
      mockPrisma.userFeedback.findMany.mockResolvedValue([]);
      mockPrisma.userFeedback.count.mockResolvedValue(0);

      await listFeedback({
        type: 'bug_report',
        status: 'pending',
      });

      expect(mockPrisma.userFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            type: 'bug_report',
            status: 'pending',
          },
        }),
      );
    });
  });

  describe('updateFeedbackStatus', () => {
    it('should update feedback status to resolved', async () => {
      const existing = {
        feedback_id: 'test-id',
        user_id: null,
        node_id: null,
        type: 'general',
        rating: null,
        category: null,
        title: null,
        content: 'Test',
        metadata: {},
        status: 'pending',
        resolved_at: null,
        created_at: new Date(),
      };

      const updated = {
        ...existing,
        status: 'resolved',
        resolved_at: new Date(),
      };

      mockPrisma.userFeedback.findUnique.mockResolvedValue(existing);
      mockPrisma.userFeedback.update.mockResolvedValue(updated);

      const result = await updateFeedbackStatus('test-id', 'resolved');

      expect(result.status).toBe('resolved');
    });

    it('should throw NotFoundError for non-existent feedback', async () => {
      mockPrisma.userFeedback.findUnique.mockResolvedValue(null);

      await expect(
        updateFeedbackStatus('non-existent', 'resolved'),
      ).rejects.toThrow('Feedback');
    });
  });

  describe('getFeedbackStats', () => {
    it('should return aggregated feedback statistics', async () => {
      const mockItems = [
        { type: 'bug_report', category: 'navigation', status: 'pending', rating: 4 },
        { type: 'bug_report', category: 'navigation', status: 'resolved', rating: 5 },
        { type: 'feature_request', category: null, status: 'pending', rating: null },
      ];

      mockPrisma.userFeedback.findMany.mockResolvedValue(mockItems);
      mockPrisma.userFeedback.aggregate.mockResolvedValue({
        _count: 3,
        _avg: { rating: 4.5 },
      });

      const result = await getFeedbackStats();

      expect(result.total).toBe(3);
      expect(result.pending).toBe(2);
      expect(result.resolved).toBe(1);
      expect(result.avg_rating).toBe(4.5);
      expect(result.by_type.bug_report).toBe(2);
      expect(result.by_category.navigation).toBe(2);
    });
  });

  describe('trackEvent', () => {
    it('should track UX event', async () => {
      const mockEvent = {
        event_id: 'event-123',
        user_id: 'test-user',
        node_id: null,
        event_type: 'page_view',
        page: '/dashboard',
        component: null,
        action: null,
        duration: null,
        metadata: {},
        created_at: new Date(),
      };

      mockPrisma.uxEvent.create.mockResolvedValue(mockEvent);

      const result = await trackEvent('test-user', null, {
        event_type: 'page_view',
        page: '/dashboard',
      });

      expect(result.event_id).toBe('event-123');
      expect(result.event_type).toBe('page_view');
    });

    it('should throw error for missing event_type', async () => {
      await expect(
        trackEvent(null, null, { event_type: '' as any }),
      ).rejects.toThrow('Event type is required');
    });
  });

  describe('getUxAnalytics', () => {
    it('should return analytics summary', async () => {
      const mockEvents = [
        {
          event_type: 'page_view',
          page: '/dashboard',
          user_id: 'user-1',
          node_id: 'node-1',
          action: 'view',
        },
        {
          event_type: 'button_click',
          page: '/dashboard',
          user_id: 'user-1',
          node_id: 'node-1',
          action: 'click_button',
        },
        {
          event_type: 'page_view',
          page: '/browse',
          user_id: 'user-2',
          node_id: 'node-2',
          action: 'view',
        },
      ];

      mockPrisma.uxEvent.findMany.mockResolvedValue(mockEvents);
      mockPrisma.sessionMetric.findMany.mockResolvedValue([
        { duration: 120 },
        { duration: 180 },
      ]);

      const result = await getUxAnalytics(7);

      expect(result.total_events).toBe(3);
      expect(result.unique_users).toBe(2);
      expect(result.unique_nodes).toBe(2);
      expect(result.events_by_type.page_view).toBe(2);
      expect(result.events_by_type.button_click).toBe(1);
      expect(result.avg_session_duration).toBe(150);
    });
  });

  describe('startSessionMetric', () => {
    it('should create session metric', async () => {
      const mockMetric = {
        metric_id: 'metric-123',
        user_id: 'test-user',
        node_id: null,
        session_type: 'exploration',
        start_time: new Date(),
        end_time: null,
        duration: null,
        event_count: 0,
        action_count: 0,
        outcome: null,
        metadata: {},
        created_at: new Date(),
      };

      mockPrisma.sessionMetric.create.mockResolvedValue(mockMetric);

      const result = await startSessionMetric({
        session_type: 'exploration',
        user_id: 'test-user',
      });

      expect(result.metric_id).toBe('metric-123');
      expect(result.session_type).toBe('exploration');
    });
  });

  describe('endSessionMetric', () => {
    it('should end session with duration', async () => {
      const startTime = new Date(Date.now() - 60000); // 1 minute ago
      const mockMetric = {
        metric_id: 'metric-123',
        user_id: 'test-user',
        node_id: null,
        session_type: 'exploration',
        start_time: startTime,
        end_time: new Date(),
        duration: 60,
        event_count: 5,
        action_count: 3,
        outcome: 'completed',
        metadata: {},
        created_at: startTime,
      };

      mockPrisma.sessionMetric.findUnique.mockResolvedValue({
        ...mockMetric,
        end_time: null,
        duration: null,
      });
      mockPrisma.sessionMetric.update.mockResolvedValue(mockMetric);

      const result = await endSessionMetric('metric-123', {
        outcome: 'completed',
      });

      expect(result.outcome).toBe('completed');
      expect(result.duration).toBe(60);
    });
  });
});
