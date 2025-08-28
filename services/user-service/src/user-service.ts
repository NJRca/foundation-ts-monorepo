import { AuthenticationService, User } from '@foundation/security';
// ALLOW_COMPLEXITY_DELTA: User service wiring contains many handlers and
// auth helpers; mark as allowed complexity for repository policy.
import { User as BaseUser, UserRepository } from '@foundation/database';
import { DomainEventFactory, InMemoryEventStore } from '@foundation/events';

import { Logger } from '@foundation/contracts';
import { loadValidatedConfig } from '@foundation/config';
import { randomUUID } from 'crypto';

// Extended UserRepository that works with security User interface
class SecureUserRepository {
  private readonly baseRepository: UserRepository;

  constructor(baseRepository: UserRepository) {
    this.baseRepository = baseRepository;
  }

  async findById(id: string): Promise<User | undefined> {
    const baseUser = await this.baseRepository.findById(id);
    return baseUser ? this.toSecureUser(baseUser) : undefined;
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const baseUser = await this.baseRepository.findByEmail(email);
    return baseUser ? this.toSecureUser(baseUser) : undefined;
  }

  async findAll(): Promise<User[]> {
    const baseUsers = await this.baseRepository.findAll();
    return baseUsers.map((user: BaseUser) => this.toSecureUser(user));
  }

  async save(user: User): Promise<User> {
    const baseUser: BaseUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const savedUser = await this.baseRepository.save(baseUser);
    return {
      ...savedUser,
      passwordHash: user.passwordHash,
      roles: user.roles,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
    };
  }

  async delete(id: string): Promise<void> {
    return this.baseRepository.delete(id);
  }

  private toSecureUser(baseUser: BaseUser): User {
    return {
      ...baseUser,
      passwordHash: '', // Will be populated separately
      roles: ['user'], // Default role
      isActive: true, // Default active
      lastLoginAt: undefined,
    };
  }
}

/**
 * @intent: user-service-domain
 * Purpose: Core domain service for user management within the user-service.
 * Constraints: Keep persistence interactions through repository adapters and
 *             surface only domain-safe operations. Avoid direct DB SQL here.
 */
export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

export class UserService {
  private readonly userRepository: SecureUserRepository;
  private readonly eventStore: InMemoryEventStore;
  private readonly authService: AuthenticationService;
  private readonly logger: Logger;

  constructor(userRepository: UserRepository, eventStore: InMemoryEventStore, logger: Logger) {
    this.userRepository = new SecureUserRepository(userRepository);
    this.eventStore = eventStore;
    this.logger = logger;

    // Initialize auth service for password hashing using validated config
    const cfg = loadValidatedConfig();
    this.authService = new AuthenticationService(
      {
        jwtSecret: cfg.getRequired<string>('JWT_SECRET'),
        jwtRefreshSecret: cfg.getRequired<string>('JWT_REFRESH_SECRET'),
      },
      logger
    );
  }

  async createUser(name: string, email: string, password: string): Promise<User> {
    try {
      this.logger.info('Creating user', { email, name });

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await this.authService.hashPassword(password);

      // Create user
      const user: User = {
        id: randomUUID(),
        name,
        email,
        passwordHash,
        roles: ['user'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save user
      const savedUser = await this.userRepository.save(user);

      // Publish domain event
      const event = DomainEventFactory.create(
        user.id,
        'UserCreated',
        {
          userId: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
        {
          service: 'user-service',
          version: '1.0.0',
        }
      );

      await this.eventStore.saveEvents(user.id, 'User', [event]);

      this.logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
      });

      return savedUser;
    } catch (error) {
      this.logger.error('UserService.createUser failed', {
        email,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  async getUserById(id: string): Promise<User | undefined> {
    try {
      this.logger.debug('Fetching user by ID', { userId: id });
      return await this.userRepository.findById(id);
    } catch (error) {
      this.logger.error('UserService.getUserById failed', {
        userId: id,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      this.logger.debug('Fetching user by email', { email });
      return await this.userRepository.findByEmail(email);
    } catch (error) {
      this.logger.error('UserService.getUserByEmail failed', {
        email,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      this.logger.debug('Fetching all users');
      return await this.userRepository.findAll();
    } catch (error) {
      this.logger.error('UserService.getAllUsers failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  async updateUser(id: string, updates: UpdateUserRequest): Promise<User | undefined> {
    try {
      this.logger.info('Updating user', { userId: id, updates });

      const user = await this.userRepository.findById(id);
      if (!user) {
        return undefined;
      }

      // Check if email is being changed and if it's already taken
      if (updates.email && updates.email !== user.email) {
        const existingUser = await this.userRepository.findByEmail(updates.email);
        if (existingUser) {
          throw new Error('Email is already taken');
        }
      }

      // Update user
      const updatedUser: User = {
        ...user,
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.email ? { email: updates.email } : {}),
        updatedAt: new Date(),
      };

      const savedUser = await this.userRepository.save(updatedUser);

      // Publish domain event
      const event = DomainEventFactory.create(
        user.id,
        'UserUpdated',
        {
          userId: user.id,
          changes: updates,
          updatedAt: updatedUser.updatedAt,
        },
        {
          service: 'user-service',
          version: '1.0.0',
        }
      );

      await this.eventStore.saveEvents(user.id, 'User', [event]);

      this.logger.info('User updated successfully', {
        userId: user.id,
        changes: updates,
      });

      return savedUser;
    } catch (error) {
      this.logger.error('UserService.updateUser failed', {
        userId: id,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  async deleteUser(id: string): Promise<void> {
    this.logger.info('Deleting user', { userId: id });

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    await this.userRepository.delete(id);

    // Publish domain event
    const event = DomainEventFactory.create(
      user.id,
      'UserDeleted',
      {
        userId: user.id,
        email: user.email,
        deletedAt: new Date(),
      },
      {
        service: 'user-service',
        version: '1.0.0',
      }
    );

    await this.eventStore.saveEvents(user.id, 'User', [event]);

    this.logger.info('User deleted successfully', { userId: id });
  }

  async authenticateUser(email: string, password: string): Promise<User | undefined> {
    this.logger.info('Authenticating user', { email });

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      this.logger.warn('Authentication failed: user not found', { email });
      return undefined;
    }

    if (!user.isActive) {
      this.logger.warn('Authentication failed: user inactive', { email, userId: user.id });
      return undefined;
    }

    const isPasswordValid = await this.authService.verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn('Authentication failed: invalid password', { email, userId: user.id });
      return undefined;
    }

    // Update last login
    const updatedUser: User = {
      ...user,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    };

    await this.userRepository.save(updatedUser);

    // Publish domain event
    const event = DomainEventFactory.create(
      user.id,
      'UserLoggedIn',
      {
        userId: user.id,
        email: user.email,
        loginAt: updatedUser.lastLoginAt,
      },
      {
        service: 'user-service',
        version: '1.0.0',
      }
    );

    await this.eventStore.saveEvents(user.id, 'User', [event]);

    this.logger.info('User authenticated successfully', {
      userId: user.id,
      email: user.email,
    });

    return updatedUser;
  }

  async deactivateUser(id: string): Promise<User | undefined> {
    this.logger.info('Deactivating user', { userId: id });

    const user = await this.userRepository.findById(id);
    if (!user) {
      return undefined;
    }

    const updatedUser: User = {
      ...user,
      isActive: false,
      updatedAt: new Date(),
    };

    const savedUser = await this.userRepository.save(updatedUser);

    // Publish domain event
    const event = DomainEventFactory.create(
      user.id,
      'UserDeactivated',
      {
        userId: user.id,
        email: user.email,
        deactivatedAt: updatedUser.updatedAt,
      },
      {
        service: 'user-service',
        version: '1.0.0',
      }
    );

    await this.eventStore.saveEvents(user.id, 'User', [event]);

    this.logger.info('User deactivated successfully', { userId: id });

    return savedUser;
  }

  async activateUser(id: string): Promise<User | undefined> {
    this.logger.info('Activating user', { userId: id });

    const user = await this.userRepository.findById(id);
    if (!user) {
      return undefined;
    }

    const updatedUser: User = {
      ...user,
      isActive: true,
      updatedAt: new Date(),
    };

    const savedUser = await this.userRepository.save(updatedUser);

    // Publish domain event
    const event = DomainEventFactory.create(
      user.id,
      'UserActivated',
      {
        userId: user.id,
        email: user.email,
        activatedAt: updatedUser.updatedAt,
      },
      {
        service: 'user-service',
        version: '1.0.0',
      }
    );

    await this.eventStore.saveEvents(user.id, 'User', [event]);

    this.logger.info('User activated successfully', { userId: id });

    return savedUser;
  }

  async changeUserPassword(id: string, oldPassword: string, newPassword: string): Promise<boolean> {
    this.logger.info('Changing user password', { userId: id });

    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await this.authService.verifyPassword(
      oldPassword,
      user.passwordHash
    );
    if (!isOldPasswordValid) {
      this.logger.warn('Password change failed: invalid old password', { userId: id });
      return false;
    }

    // Hash new password
    const newPasswordHash = await this.authService.hashPassword(newPassword);

    // Update user
    const updatedUser: User = {
      ...user,
      passwordHash: newPasswordHash,
      updatedAt: new Date(),
    };

    await this.userRepository.save(updatedUser);

    // Publish domain event
    const event = DomainEventFactory.create(
      user.id,
      'UserPasswordChanged',
      {
        userId: user.id,
        changedAt: updatedUser.updatedAt,
      },
      {
        service: 'user-service',
        version: '1.0.0',
      }
    );

    await this.eventStore.saveEvents(user.id, 'User', [event]);

    this.logger.info('User password changed successfully', { userId: id });

    return true;
  }
}
