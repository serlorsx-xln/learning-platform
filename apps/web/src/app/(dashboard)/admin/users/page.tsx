"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operator";
  banned: boolean | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmUser, setConfirmUser] = useState<UserRow | null>(null);

  async function loadUsers() {
    const [usersRes, meRes] = await Promise.all([fetch("/api/admin/users"), fetch("/api/auth/me")]);
    if (usersRes.ok) {
      const data = await usersRes.json();
      setUsers(data.users);
    }
    if (meRes.ok) {
      const me = await meRes.json();
      setCurrentUserId(me.user.id);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    setLoading(false);

    if (!response.ok) {
      toast.error("Failed to create user");
      return;
    }

    toast.success("User created");
    setName("");
    setEmail("");
    setPassword("");
    void loadUsers();
  }

  async function updateRole(userId: string, role: "admin" | "operator") {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      const data = await response.json();
      toast.error(data.error ?? "Failed to update role");
      return;
    }
    toast.success("Role updated");
    void loadUsers();
  }

  async function toggleBanned(user: UserRow, banned: boolean) {
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banned }),
    });
    if (!response.ok) {
      const data = await response.json();
      toast.error(data.error ?? "Failed to update user");
      return;
    }
    toast.success(banned ? "User disabled" : "User enabled");
    setConfirmUser(null);
    void loadUsers();
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <PageHeader
        title="Users"
        subtitle="Manage admin and operator accounts."
      />

      <Card>
        <CardHeader>
          <CardTitle>Create operator</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={createUser} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="sm:col-span-3 sm:w-fit">
              {loading ? "Creating..." : "Create user"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{users.length} users</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-small text-muted-foreground">No users yet.</p>
          ) : (
            <div className="min-w-0 overflow-x-auto rounded-md border">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isSelf = user.id === currentUserId;
                    const isBanned = user.banned === true;
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-caption text-muted-foreground sm:hidden">{user.email}</p>
                            <div className="mt-1 flex flex-wrap gap-1 sm:mt-0">
                              {isBanned ? <Badge variant="outline">Disabled</Badge> : null}
                              {isSelf ? <Badge variant="muted">You</Badge> : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            disabled={isBanned || isSelf}
                            onValueChange={(role) => updateRole(user.id, role as "admin" | "operator")}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="operator">Operator</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          {!isSelf ? (
                            <Button
                              variant={isBanned ? "secondary" : "outline"}
                              size="sm"
                              onClick={() =>
                                isBanned ? toggleBanned(user, false) : setConfirmUser(user)
                              }
                            >
                              {isBanned ? "Enable" : "Disable"}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!confirmUser} onOpenChange={(open) => !open && setConfirmUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disable user?</DialogTitle>
            <DialogDescription>
              {confirmUser?.name} ({confirmUser?.email}) will no longer be able to sign in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmUser(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => confirmUser && toggleBanned(confirmUser, true)}>
              Disable user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
