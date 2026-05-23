// components/waitlist/waitlist-setup-required.tsx

import { AlertTriangle, Database, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function WaitlistSetupRequired() {
  return (
    <div className="container mx-auto py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Waiting List</h1>
          <p className="text-muted-foreground text-sm">Customer waiting list management
          </p>
        </div>
      </div>

      {/* Setup Required Alert */}
      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          The waitlist feature requires database setup. Please contact your administrator to enable this feature.
        </AlertDescription>
      </Alert>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <CardTitle>Database Setup Required</CardTitle>
          </div>
          <CardDescription>
            The waitlist table and required database components need to be created in your Supabase database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h4 className="font-semibold">Setup Instructions:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground text-sm"><li>Open your Supabase project dashboard</li>
              <li>Navigate to the SQL Editor</li>
              <li>Run the setup script located at <code className="bg-muted px-1 py-0.5 rounded">db/setup-waitlist.sql</code></li>
              <li>Refresh this page after running the script</li>
            </ol>
          </div>

          <div className="pt-4 border-t">
            <h4 className="font-semibold mb-2">What will be created:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground text-sm"><li>Waitlist table with proper schema</li>
              <li>Required enum types (waiting_status, table_type)</li>
              <li>Database indexes for performance</li>
              <li>Row Level Security (RLS) policies</li>
              <li>Proper permissions for authenticated users</li>
            </ul>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="flex items-center space-x-2"
            >
              <span>Refresh Page</span>
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.open('https://supabase.com/dashboard', '_blank')}
              className="flex items-center space-x-2"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open Supabase Dashboard</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feature Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Waitlist Feature Preview</CardTitle>
          <CardDescription>
            Once set up, the waitlist feature will provide:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold">For Restaurant Staff:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground text-sm"><li>View all customer waitlist entries</li>
                <li>Filter by status, date, and customer</li>
                <li>Update entry status (contacted, seated, cancelled)</li>
                <li>Create bookings directly from waitlist entries</li>
                <li>Track waitlist conversion metrics</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">For Customers:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground text-sm"><li>Join waitlist when preferred time unavailable</li>
                <li>Specify table preferences</li>
                <li>Receive notifications when tables become available</li>
                <li>View and manage their waitlist entries</li>
                <li>Automatic booking conversion when seated</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
