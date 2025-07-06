
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Rss, Users, Settings, FileText, TestTube2, NewspaperIcon } from 'lucide-react';
import Link from 'next/link';
import { UserRole, type User } from '@/types'; // Import UserRole and User
import { mockUsers } from '@/lib/mockAuthData'; // Import mock users

export default function AdminDashboardPage() {
  // --- Mock Current User ---
  // In a real app, this would come from your authentication system.
  // To test different roles, change this user:
  // const mockCurrentUser: User | undefined = mockUsers.find(u => u.role === UserRole.ADMIN);
  const mockCurrentUser: User | undefined = mockUsers.find(u => u.role === UserRole.SUPER_ADMIN);
  // const mockCurrentUser: User | undefined = mockUsers.find(u => u.role === UserRole.USER);


  // Fallback if no user is found (e.g. if mockUsers is empty or role doesn't exist)
  const currentUserRole = mockCurrentUser ? mockCurrentUser.role : UserRole.USER;
  // --- End Mock Current User ---

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ShieldCheck className="h-9 w-9 text-primary" />
          Admin Dashboard
        </h1>
      </div>
      <p className="text-muted-foreground">
        Welcome to the admin control panel. Your role is: <strong>{currentUserRole}</strong>. Manage your application settings and content here.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Manage Saved Analysis
            </CardTitle>
            <CardDescription>View and manage saved AI analysis results. Promote analysis to blog posts.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/admin/articles">Go to Saved Analysis</Link>
            </Button>
          </CardContent>
        </Card>

        {(currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.SUPER_ADMIN) && (
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <NewspaperIcon className="h-5 w-5 text-primary" />
                Manage Blog Posts
              </CardTitle>
              <CardDescription>View and manage published blog posts.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link href="/admin/blog">Go to Blog Management</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rss className="h-5 w-5 text-primary" />
              Feed Management
            </CardTitle>
            <CardDescription>Add, edit, or remove RSS feed sources.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/admin/feeds">Go to Feed Management</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube2 className="h-5 w-5 text-primary" />
              Analyze Content
            </CardTitle>
            <CardDescription>Use AI to analyze article text for bias and summaries.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/admin/analyze">Go to Content Analysis</Link>
            </Button>
          </CardContent>
        </Card>

        {currentUserRole === UserRole.SUPER_ADMIN && (
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                User Management
              </CardTitle>
              <CardDescription>View and manage user accounts (Super Admin only).</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link href="/admin/users">Go to User Management</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              System Settings
            </CardTitle>
            <CardDescription>Configure application-wide settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/admin/settings">Go to System Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

