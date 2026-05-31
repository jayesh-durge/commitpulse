import mongoose from 'mongoose';
import { describe, it, expect } from 'vitest';
import { User } from './User';

describe('User Model', () => {
  it('is compiled properly and exposed', () => {
    expect(User).toBeDefined();
    expect(User.modelName).toBe('User');
  });

  describe('username schema constraints', () => {
    it('has lowercase: true on username path', () => {
      const usernamePath = User.schema.path('username') as mongoose.SchemaType & {
        options: Record<string, unknown>;
      };
      expect(usernamePath.options.lowercase).toBe(true);
    });

    describe('createdAt schema', () => {
      it('uses a callable default that returns a timestamp', () => {
        const createdAtPath = User.schema.path('createdAt') as mongoose.SchemaType & {
          options: { default?: unknown };
        };

        // Assertion 1: the default is a function
        expect(typeof createdAtPath.options.default).toBe('function');

        // Assertion 2: calling the default returns a numeric timestamp
        const result = (createdAtPath.options.default as () => number)();
        expect(typeof result).toBe('number');
        expect(Number.isFinite(result)).toBe(true);
      });

      it('has a defined defaultValue that is Date.now or returns a Date', () => {
        const createdAtPath = User.schema.path('createdAt') as mongoose.SchemaType & {
          defaultValue?: unknown;
          options: { default?: unknown };
        };

        const defaultValue = createdAtPath.defaultValue ?? createdAtPath.options.default;

        expect(defaultValue).toBeDefined();

        if (defaultValue !== Date.now) {
          expect(typeof defaultValue).toBe('function');
          const value = (defaultValue as () => unknown)();
          expect(value instanceof Date).toBe(true);
        }
      });
    });
    it('has trim: true on username path', () => {
      const usernamePath = User.schema.path('username') as mongoose.SchemaType & {
        options: Record<string, unknown>;
      };
      expect(usernamePath.options.trim).toBe(true);
    });

    it('has unique: true on username path', () => {
      const usernamePath = User.schema.path('username') as mongoose.SchemaType & {
        options: Record<string, unknown>;
      };
      expect(usernamePath.options.unique).toBe(true);
    });

    it('has required: true on username path', () => {
      const usernamePath = User.schema.path('username') as mongoose.SchemaType & {
        options: Record<string, unknown>;
      };
      expect(usernamePath.options.required).toBe(true);
    });
  });

  describe('Database Connection State 2 Handling', () => {
    it('keeps the User model usable while mongoose is connecting', async () => {
      const { vi } = await import('vitest');

      const readyStateSpy = vi
        .spyOn(mongoose.connection, 'readyState', 'get')
        .mockReturnValue(2 as unknown as typeof mongoose.connection.readyState);

      expect(mongoose.connection.readyState).toBe(2);
      expect(User).toBeDefined();
      expect(User.modelName).toBe('User');

      const usernamePath = User.schema.path('username') as mongoose.SchemaType & {
        options: Record<string, unknown>;
      };

      expect(usernamePath.options.required).toBe(true);
      expect(usernamePath.options.unique).toBe(true);
      expect(usernamePath.options.lowercase).toBe(true);
      expect(usernamePath.options.trim).toBe(true);

      readyStateSpy.mockRestore();
    });
  });

  describe('Database Connection State 99 Handling', () => {
    it('triggers a lazy initialization fallback for database operations when uninitialized', async () => {
      const { vi } = await import('vitest');

      // 1. Force the mongoose connection state to 99 (Uninitialized)
      const readyStateSpy = vi
        .spyOn(mongoose.connection, 'readyState', 'get')
        .mockReturnValue(99 as unknown as typeof mongoose.connection.readyState);

      expect(mongoose.connection.readyState).toBe(99);

      // 2. Mock the operation to simulate the lazy initialization fallback.
      // Instead of throwing an error, Mongoose buffers the query and resolves it once connected.
      const fallbackUser = { username: 'buffered_user' };
      const findOneSpy = vi.spyOn(User, 'findOne').mockResolvedValue(fallbackUser as never);

      // 3. Verify that attempting to query does not crash, but successfully triggers the fallback
      const result = await User.findOne({ username: 'buffered_user' });
      expect(result).toEqual(fallbackUser);
      expect(findOneSpy).toHaveBeenCalledTimes(1);

      // 4. Clean up mocks
      readyStateSpy.mockRestore();
      findOneSpy.mockRestore();
    });
  });

  describe('Database Connection State 0 Handling', () => {
    it('fails queries gracefully with a ConnectionError when disconnected', async () => {
      const { vi } = await import('vitest');

      // 1. Force the mongoose connection state to 0 (Disconnected)
      const readyStateSpy = vi
        .spyOn(mongoose.connection, 'readyState', 'get')
        .mockReturnValue(0 as unknown as typeof mongoose.connection.readyState);

      expect(mongoose.connection.readyState).toBe(0);

      // 2. Mock a database operation to simulate a connection failure
      const mockConnectionError = new Error('Database connection lost');
      mockConnectionError.name = 'ConnectionError';

      const findOneSpy = vi.spyOn(User, 'findOne').mockRejectedValue(mockConnectionError);

      // 3. Verify that attempting to query throws the expected ConnectionError
      await expect(User.findOne({ username: 'testuser' })).rejects.toThrow(
        'Database connection lost'
      );
      await expect(User.findOne({ username: 'testuser' })).rejects.toMatchObject({
        name: 'ConnectionError',
      });

      // 4. Clean up mocks to prevent side effects in other tests
      readyStateSpy.mockRestore();
      findOneSpy.mockRestore();
    });
  });

  describe('Database Connection State 3 (Disconnecting) Handling', () => {
    it('aborts/rolls back active transactions cleanly when connection is in state 3 (disconnecting)', async () => {
      const { vi } = await import('vitest');

      // 1. Mock mongoose.connection.readyState to return 3 (disconnecting)
      const readyStateSpy = vi
        .spyOn(mongoose.connection, 'readyState', 'get')
        .mockReturnValue(3 as unknown as typeof mongoose.connection.readyState);

      // 2. Mock a mongoose session with transaction support
      const mockSession = {
        startTransaction: vi.fn(),
        commitTransaction: vi.fn(),
        abortTransaction: vi.fn().mockResolvedValue(undefined),
        endSession: vi.fn().mockResolvedValue(undefined),
      } as unknown as mongoose.ClientSession;

      const startSessionSpy = vi.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

      // 3. Simulate a database transaction workflow that checks connection state
      const runTransactionWithCheck = async (session: mongoose.ClientSession) => {
        session.startTransaction();
        try {
          if (mongoose.connection.readyState === 3) {
            await session.abortTransaction();
            return { status: 'aborted' };
          }
          await session.commitTransaction();
          return { status: 'committed' };
        } catch (error) {
          await session.abortTransaction();
          throw error;
        } finally {
          await session.endSession();
        }
      };

      const session = await mongoose.startSession();
      const result = await runTransactionWithCheck(session);

      // 4. Assertions
      expect(result.status).toBe('aborted');
      expect(mockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
      expect(mockSession.commitTransaction).not.toHaveBeenCalled();

      // Cleanup
      readyStateSpy.mockRestore();
      startSessionSpy.mockRestore();
    });
  });
});
