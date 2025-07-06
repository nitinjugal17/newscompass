
'use client';

import { AlertTriangle, ArrowLeft, Users, PlusCircle, Edit2, Trash2, RefreshCw, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { UserRole, type User } from '@/types';
import { mockUsers } from '@/lib/mockAuthData';
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getUsers, addUser, updateUser, deleteUser, type UserDataForAdd, type UserDataForUpdate } from '@/actions/userActions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

// --- Mock Current User for Page Access Control ---
const MOCK_CURRENT_LOGGED_IN_USER_FOR_ACCESS_CONTROL: User | undefined = mockUsers.find(u => u.role === UserRole.SUPER_ADMIN);
const currentUserPageAccessRole = MOCK_CURRENT_LOGGED_IN_USER_FOR_ACCESS_CONTROL ? MOCK_CURRENT_LOGGED_IN_USER_FOR_ACCESS_CONTROL.role : UserRole.USER;
// --- End Mock Current User ---

const UserFormSchema = {
  name: (value: string) => value.trim().length > 0 ? null : "Name is required.",
  email: (value: string) => {
    if (!value.trim()) return "Email is required.";
    if (!/\S+@\S+\.\S+/.test(value)) return "Invalid email format.";
    return null;
  },
  role: (value: UserRole | '') => Object.values(UserRole).includes(value as UserRole) ? null : "Role is required.",
  password: (value: string, isEditing: boolean) => {
    if (!isEditing && (!value.trim() || value.trim().length < 6)) { // Required for new users
      return "Password is required and must be at least 6 characters.";
    }
    if (isEditing && value.trim().length > 0 && value.trim().length < 6) { // Optional for edit, but if provided, must be valid
      return "If changing password, it must be at least 6 characters.";
    }
    return null;
  }
};


export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [formState, setFormState] = useState({ name: '', email: '', role: '' as UserRole | '', password: '' });
  const [formErrors, setFormErrors] = useState<{ name?: string; email?: string; role?: string; password?: string }>({});

  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      toast({
        title: 'Error Fetching Users',
        description: error instanceof Error ? error.message : 'Could not load users.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (currentUserPageAccessRole === UserRole.SUPER_ADMIN) {
      fetchUsers();
    }
  }, [fetchUsers, currentUserPageAccessRole]);

  const resetForm = () => {
    setFormState({ name: '', email: '', role: '' as UserRole | '', password: '' });
    setFormErrors({});
    setEditingUser(null);
  };

  const validateForm = () => {
    const errors: { name?: string; email?: string; role?: string; password?: string } = {};
    const nameError = UserFormSchema.name(formState.name);
    if (nameError) errors.name = nameError;

    const emailError = UserFormSchema.email(formState.email);
    if (emailError) errors.email = emailError;
    
    const roleError = UserFormSchema.role(formState.role);
    if (roleError) errors.role = roleError;

    const passwordError = UserFormSchema.password(formState.password, !!editingUser);
    if (passwordError) errors.password = passwordError;

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value: string) => {
     setFormState(prev => ({ ...prev, role: value as UserRole }));
  };

  const handleOpenDialog = (userToEdit?: User) => {
    resetForm();
    if (userToEdit) {
      setEditingUser(userToEdit);
      // Don't pre-fill password for editing for security, only if they want to change it
      setFormState({ name: userToEdit.name, email: userToEdit.email, role: userToEdit.role, password: '' });
    } else {
      setEditingUser(null); // Ensure we are in "add" mode
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      if (editingUser) {
        const userDataForUpdate: UserDataForUpdate = {
          name: formState.name,
          email: formState.email,
          role: formState.role as UserRole,
        };
        if (formState.password.trim() !== '') { // Only include password if it's being changed
          userDataForUpdate.password = formState.password;
        }
        await updateUser(editingUser.id, userDataForUpdate);
        toast({ title: 'User Updated', description: `User "${formState.name}" has been updated.` });
      } else {
        const userDataForAdd: UserDataForAdd = {
          name: formState.name,
          email: formState.email,
          password: formState.password, // Password is required for new users
          role: formState.role as UserRole,
        };
        await addUser(userDataForAdd);
        toast({ title: 'User Added', description: `User "${formState.name}" has been added.` });
      }
      await fetchUsers();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error("Failed to save user:", error);
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Could not save user details.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    setIsSubmitting(true); 
    try {
      await deleteUser(userId);
      toast({ title: 'User Deleted', description: `User "${userName}" has been deleted.` });
      await fetchUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Could not delete user.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  if (currentUserPageAccessRole !== UserRole.SUPER_ADMIN) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-destructive">
              <AlertTriangle className="h-8 w-8" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-muted-foreground">
              You do not have permission to view this page. User management is restricted to Super Admins.
            </p>
            <Button variant="outline" asChild className="mt-6">
              <Link href="/admin">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Users className="h-9 w-9 text-primary" />
          User Management
        </h1>
        <div className="flex items-center gap-2">
           <Button variant="outline" size="icon" onClick={fetchUsers} disabled={isLoading || isSubmitting} title="Refresh Users List">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin Dashboard
            </Link>
          </Button>
        </div>
      </div>
      
      <div className="bg-destructive/10 border-l-4 border-destructive text-destructive p-4 rounded-md" role="alert">
        <div className="flex items-center">
          <AlertTriangle className="h-6 w-6 mr-3 flex-shrink-0" />
          <div>
            <p className="font-bold">Security Warning: Plaintext Passwords</p>
            <p className="text-sm">Passwords are currently stored in plaintext in the CSV file. This is highly insecure and for demonstration purposes only. Do NOT use this in a production environment. Implement proper password hashing and secure storage.</p>
          </div>
        </div>
      </div>


      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Manage Users</CardTitle>
                <CardDescription>
                    Add, edit, or delete user accounts. User data is stored in a CSV file.
                </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsDialogOpen(open); }}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()} disabled={isSubmitting}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add New User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
                  <DialogDescription>
                    {editingUser ? 'Update the details for this user.' : 'Enter the details for the new user.'}
                    {editingUser && <span className="block text-xs text-muted-foreground mt-1">Leave password blank to keep current password.</span>}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" name="name" value={formState.name} onChange={handleInputChange} className="col-span-3" disabled={isSubmitting} />
                    {formErrors.name && <p className="col-start-2 col-span-3 text-xs text-destructive mt-1">{formErrors.name}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="email" className="text-right">Email</Label>
                    <Input id="email" name="email" type="email" value={formState.email} onChange={handleInputChange} className="col-span-3" disabled={isSubmitting} />
                    {formErrors.email && <p className="col-start-2 col-span-3 text-xs text-destructive mt-1">{formErrors.email}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password" className="text-right flex items-center gap-1">
                      <KeyRound className="h-3 w-3"/>Password
                    </Label>
                    <Input 
                      id="password" 
                      name="password" 
                      type="password" 
                      value={formState.password} 
                      onChange={handleInputChange} 
                      className="col-span-3" 
                      placeholder={editingUser ? "Leave blank to keep current" : "Min. 6 characters"}
                      disabled={isSubmitting} 
                    />
                    {formErrors.password && <p className="col-start-2 col-span-3 text-xs text-destructive mt-1">{formErrors.password}</p>}
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role" className="text-right">Role</Label>
                    <Select value={formState.role} onValueChange={handleRoleChange} disabled={isSubmitting}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(UserRole).map((role) => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                     {formErrors.role && <p className="col-start-2 col-span-3 text-xs text-destructive mt-1">{formErrors.role}</p>}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {editingUser ? 'Save Changes' : 'Add User'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-center py-4 text-muted-foreground">Loading users...</p>}
          {!isLoading && users.length === 0 && (
            <div className="text-center py-10">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-lg font-medium">No Users Found</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                There are no users in the system, or the CSV file is empty/corrupted.
              </p>
            </div>
          )}
          {!isLoading && users.length > 0 && (
            <ScrollArea className="h-[60vh] w-full overflow-x-auto border rounded-md">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {users.map((user) => (
                    <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.role}</TableCell>
                        <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(user)} aria-label={`Edit user ${user.name}`} disabled={isSubmitting}>
                            <Edit2 className="h-4 w-4 text-primary" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Delete user ${user.name}`} disabled={isSubmitting}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="text-destructive h-5 w-5"/>Confirm Deletion
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete user "{user.name}" ({user.email})? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id, user.name)}
                                className="bg-destructive hover:bg-destructive/90"
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Yes, delete"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
