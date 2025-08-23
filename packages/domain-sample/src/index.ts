// Sample domain implementation
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export class UserService {
  private users: Map<string, User> = new Map();

  create(name: string, email: string): User {
    const user: User = {
      id: crypto.randomUUID(),
      name,
      email,
      createdAt: new Date()
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