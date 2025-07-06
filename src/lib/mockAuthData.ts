import type { User } from '@/types';
import { UserRole } from '@/types';

// WARNING: Storing plaintext passwords, even in mock data, is bad practice.
// This is for conceptual demonstration ONLY. Do NOT do this in production.
export const mockUsers: User[] = [
  {
    id: 'user-001',
    name: 'Alice Wonderland',
    email: 'alice@example.com',
    password: 'passwordAlice', // Plaintext password - INSECURE
    role: UserRole.USER,
    avatarUrl: 'https://placehold.co/100x100.png',
    avatarAiHint: 'user avatar',
  },
  {
    id: 'admin-001',
    name: 'Bob The Builder',
    email: 'bob@example.com',
    password: 'passwordBob', // Plaintext password - INSECURE
    role: UserRole.ADMIN,
    avatarUrl: 'https://placehold.co/100x100.png',
    avatarAiHint: 'user avatar',
  },
  {
    id: 'superadmin-001',
    name: 'Charlie Root',
    email: 'charlie@example.com',
    password: 'passwordCharlie', // Plaintext password - INSECURE
    role: UserRole.SUPER_ADMIN,
    avatarUrl: 'https://placehold.co/100x100.png',
    avatarAiHint: 'user avatar',
  },
];

export function getMockUserByEmail(email: string): User | undefined {
  return mockUsers.find(user => user.email === email);
}

export function getMockUserById(id: string): User | undefined {
  return mockUsers.find(user => user.id === id);
}
