
'use server';

import type { User } from '@/types';
import { UserRole } from '@/types';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { mockUsers } from '@/lib/mockAuthData'; // For seeding
import bcrypt from 'bcryptjs';

const dataDir = path.join(process.cwd(), 'data');
const usersFilePath = path.join(dataDir, 'users.csv');
const SALT_ROUNDS = 10; // Cost factor for bcrypt hashing

// Helper function to ensure the data directory exists
async function ensureDataDirectory(): Promise<void> {
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error('Error creating data directory for users:', error);
      console.error('Original error:', error);
      throw new Error('Failed to ensure data directory for users.');
    }
  }
}

// Helper to escape CSV fields
function escapeCsvField(field: string | undefined | null): string {
  if (field === undefined || field === null) return '""';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

// Helper function to read users from CSV
async function readUsersFromCSV(): Promise<User[]> {
  await ensureDataDirectory();
  const headerLineContent = '"id","name","email","password","role","avatarUrl","avatarAiHint"\n';

  try {
    await fs.access(usersFilePath);
  } catch (error) {
    // File doesn't exist, so seed it with mock users (passwords will be hashed on first write)
    console.log('Users CSV not found, seeding with initial mock user data...');
    try {
      // For initial seed, passwords in mockUsers are plaintext.
      // They will be hashed when saved through addUser/updateUser.
      // If seeding directly, they should be pre-hashed or a migration script run.
      // For simplicity, this seed assumes they'll be overwritten/hashed via UI.
      await writeUsersToCSV(mockUsers.map(u => ({...u, password: u.password ? bcrypt.hashSync(u.password, SALT_ROUNDS) : undefined })));
      return mockUsers.map(u => ({...u, password: u.password ? bcrypt.hashSync(u.password, SALT_ROUNDS) : undefined }));
    } catch (seedError) {
      console.error('Failed to seed users.csv:', seedError);
      console.error('Original seed error:', seedError);
      throw new Error('Failed to initialize user data file.');
    }
  }

  let csvData;
  try {
    csvData = await fs.readFile(usersFilePath, 'utf-8');
  } catch (readError) {
    console.error('Critical error reading users.csv:', readError);
    console.error('Original read error:', readError);
    throw new Error('Failed to read user data.');
  }

  if (!csvData.trim()) {
    console.log('Users CSV is empty, re-seeding with initial mock user data (passwords will be hashed)...');
    try {
      await writeUsersToCSV(mockUsers.map(u => ({...u, password: u.password ? bcrypt.hashSync(u.password, SALT_ROUNDS) : undefined })));
      return mockUsers.map(u => ({...u, password: u.password ? bcrypt.hashSync(u.password, SALT_ROUNDS) : undefined }));
    } catch (seedError) {
      console.error('Failed to re-seed empty users.csv:', seedError);
      console.error('Original seed error:', seedError);
      throw new Error('Failed to initialize empty user data file.');
    }
  }

  const lines = csvData.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return []; 

  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const expectedHeaders = ['id', 'name', 'email', 'password', 'role', 'avatarurl', 'avataraihint']; 
  const missingHeaders = expectedHeaders.filter(eh => !header.includes(eh));

  if (missingHeaders.length > 0 || header.length !== expectedHeaders.length) {
    console.warn(`Users CSV header is malformed. Expected: ${expectedHeaders.join(', ')}. Found: ${header.join(', ')}. Re-seeding with mock data (passwords will be hashed).`);
    try {
      await writeUsersToCSV(mockUsers.map(u => ({...u, password: u.password ? bcrypt.hashSync(u.password, SALT_ROUNDS) : undefined })));
      return mockUsers.map(u => ({...u, password: u.password ? bcrypt.hashSync(u.password, SALT_ROUNDS) : undefined }));
    } catch (seedError) {
      console.error('Failed to re-seed malformed users.csv:', seedError);
      console.error('Original seed error:', seedError);
      throw new Error('Failed to repair malformed user data file.');
    }
  }

  return lines.slice(1).map(line => {
    const values: string[] = [];
    let inQuotes = false;
    let currentValue = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i+1] === '"') {
          currentValue += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue);
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue);

    const user: Partial<User> = {};
    header.forEach((colName, index) => {
      const val = values[index] !== undefined ? values[index].trim() : '';
      const unquotedVal = val.startsWith('"') && val.endsWith('"') ? val.slice(1, -1).replace(/""/g, '"') : val;

      switch (colName) {
        case 'id': user.id = unquotedVal; break;
        case 'name': user.name = unquotedVal; break;
        case 'email': user.email = unquotedVal; break;
        case 'password': user.password = (unquotedVal === '""' || !unquotedVal) ? undefined : unquotedVal; break; 
        case 'role': user.role = unquotedVal as UserRole; break;
        case 'avatarurl': user.avatarUrl = unquotedVal === '""' || !unquotedVal ? undefined : unquotedVal; break;
        case 'avataraihint': user.avatarAiHint = unquotedVal === '""' || !unquotedVal ? undefined : unquotedVal; break;
      }
    });
    
    if (!user.id || !user.name || !user.email || !user.role || !Object.values(UserRole).includes(user.role)) {
        console.warn('Skipping invalid user record from CSV:', user);
        return null;
    }
    return user as User;
  }).filter(user => user !== null) as User[];
}

// Helper function to write users to CSV
async function writeUsersToCSV(users: User[]): Promise<void> {
  await ensureDataDirectory();
  const headerLine = '"id","name","email","password","role","avatarUrl","avatarAiHint"';
  const csvContent = [
    headerLine,
    ...users.map(u =>
      [
        escapeCsvField(u.id),
        escapeCsvField(u.name),
        escapeCsvField(u.email),
        escapeCsvField(u.password), // Store HASHED password
        escapeCsvField(u.role),
        escapeCsvField(u.avatarUrl),
        escapeCsvField(u.avatarAiHint),
      ].join(',')
    )
  ].join('\n');
  try {
    await fs.writeFile(usersFilePath, csvContent + '\n', 'utf-8');
  } catch (error) {
    console.error('Error writing to users.csv:', error);
    console.error('Original error:', error);
    throw new Error('Failed to save users to data file.');
  }
}

// --- Server Actions ---

export async function getUsers(): Promise<User[]> {
  try {
    const users = await readUsersFromCSV();
    // Omit password when sending to client
    return users.map(({ password, ...rest }) => rest).sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error("Error in getUsers:", error);
    console.error('Original error object:', error);
    const message = error instanceof Error ? error.message : 'Could not fetch users.';
    throw new Error(message);
  }
}

// UserDataForAdd now includes password
export type UserDataForAdd = Omit<User, 'id' | 'avatarUrl' | 'avatarAiHint'> & { role: UserRole, password?: string, avatarUrl?: string, avatarAiHint?: string };

export async function addUser(userData: UserDataForAdd): Promise<User> {
  try {
    const users = await readUsersFromCSV();
    if (users.some(user => user.email === userData.email)) {
      throw new Error(`User with email "${userData.email}" already exists.`);
    }
    if (!userData.password || userData.password.trim().length < 6) {
      throw new Error('Password is required and must be at least 6 characters long.');
    }

    const hashedPassword = bcrypt.hashSync(userData.password, SALT_ROUNDS);

    const newUser: User = {
      id: randomUUID(),
      name: userData.name,
      email: userData.email,
      password: hashedPassword, 
      role: userData.role,
      avatarUrl: userData.avatarUrl || 'https://placehold.co/100x100.png',
      avatarAiHint: userData.avatarAiHint || 'user avatar',
    };
    const updatedUsers = [...users, newUser];
    await writeUsersToCSV(updatedUsers);
    const { password, ...userToReturn } = newUser; // Omit password from return
    return userToReturn;
  } catch (error) {
    console.error("Error in addUser:", error);
    console.error('Original error object:', error);
    const message = error instanceof Error ? error.message : 'Could not add new user.';
    throw new Error(message);
  }
}

// UserDataForUpdate now includes optional password
export type UserDataForUpdate = Partial<Omit<User, 'id'>>;

export async function updateUser(userId: string, updatedData: UserDataForUpdate): Promise<User> {
  try {
    let users = await readUsersFromCSV();
    const userIndex = users.findIndex(user => user.id === userId);
    if (userIndex === -1) {
      throw new Error(`User with ID "${userId}" not found.`);
    }
    
    if (updatedData.email && updatedData.email !== users[userIndex].email) {
      if (users.some(user => user.email === updatedData.email && user.id !== userId)) {
        throw new Error(`Another user with email "${updatedData.email}" already exists.`);
      }
    }
    
    let newPasswordHash = users[userIndex].password; // Keep old hash by default
    if (updatedData.password && updatedData.password.trim() !== '') {
      if (updatedData.password.trim().length < 6) {
        throw new Error('If changing password, it must be at least 6 characters long.');
      }
      newPasswordHash = bcrypt.hashSync(updatedData.password, SALT_ROUNDS);
    }

    const updatedUser = { ...users[userIndex], ...updatedData, password: newPasswordHash };
    users[userIndex] = updatedUser;
    await writeUsersToCSV(users);
    const { password, ...userToReturn } = updatedUser; // Omit password from return
    return userToReturn;
  } catch (error) {
    console.error("Error in updateUser:", error);
    console.error('Original error object:', error);
    const message = error instanceof Error ? error.message : 'Could not update user.';
    throw new Error(message);
  }
}

export async function deleteUser(userId: string): Promise<{ success: boolean }> {
  try {
    let users = await readUsersFromCSV();
    const initialCount = users.length;
    users = users.filter(user => user.id !== userId);

    if (users.length === initialCount && !users.some(u => u.id === userId)) {
         console.warn(`User with ID "${userId}" not found for deletion (or already deleted).`);
    }
    await writeUsersToCSV(users);
    return { success: true };
  } catch (error) {
    console.error("Error in deleteUser:", error);
    console.error('Original error object:', error);
    const message = error instanceof Error ? error.message : 'Could not delete user.';
    throw new Error(message);
  }
}
