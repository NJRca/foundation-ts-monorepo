// Sample domain implementation (align with base User shape: include updatedAt)
import { randomUUID } from 'crypto';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserService {
  private readonly users: Map<string, User> = new Map();

  create(name: string, email: string): User {
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      name,
      email,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(user.id, user);
    return user;
  }

  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  findAll(): User[] {
    return Array.from(this.users.values());
  }
}
