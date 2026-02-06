import type { User, SafeUser } from './auth.types';

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
}

export interface IUserRepository {
  create(request: CreateUserRequest): Promise<SafeUser>;
  findByEmail(email: string): Promise<SafeUser | null>;
  findById(id: string): Promise<SafeUser | null>;
  exists(email: string): Promise<boolean>;
  verifyPassword(email: string, password: string): Promise<SafeUser | null>;
}

export class InMemoryUserRepository implements IUserRepository {
  private users = new Map<string, User>();
  private emailToId = new Map<string, string>();

  async create({ email, password, name }: CreateUserRequest): Promise<SafeUser> {
    const user: User = {
      id: this.generateUserId(),
      email,
      password,
      name,
      createdAt: new Date()
    };

    this.users.set(user.id, user);
    this.emailToId.set(user.email, user.id);

    return this.toSafeUser(user);
  }

  async findByEmail(email: string): Promise<SafeUser | null> {
    const userId = this.emailToId.get(email);
    if (!userId) return null;
    const user = this.users.get(userId);
    return user ? this.toSafeUser(user) : null;
  }

  async findById(id: string): Promise<SafeUser | null> {
    const user = this.users.get(id);
    return user ? this.toSafeUser(user) : null;
  }

  async exists(email: string): Promise<boolean> {
    return this.emailToId.has(email);
  }

  async verifyPassword(email: string, password: string): Promise<SafeUser | null> {
    const userId = this.emailToId.get(email);
    if (!userId) return null;

    const user = this.users.get(userId);
    if (!user) return null;

    const isValid = await Bun.password.verify(password, user.password);
    if (!isValid) return null;

    return this.toSafeUser(user);
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private toSafeUser(user: User): SafeUser {
    const { password, ...safeUser } = user;
    return safeUser;
  }
}

let userRepositoryInstance: IUserRepository = new InMemoryUserRepository();

export function getUserRepository(): IUserRepository {
  return userRepositoryInstance;
}

export function setUserRepository(repository: IUserRepository): void {
  userRepositoryInstance = repository;
}
