"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiContentGenerator01Icon,
  LockPasswordIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";

import { signInAction, type SignInActionState } from "@/app/actions/auth";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: SignInActionState = {
  message: "",
  attemptId: 0,
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    signInAction,
    initialState,
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (state.message && state.attemptId > 0) {
      toast.error(state.message);
    }
  }, [state.attemptId, state.message]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <div className="rounded-lg bg-brand p-3 text-white">
        <HugeiconsIcon icon={AiContentGenerator01Icon} size={38} />
      </div>

      <h1 className="flex flex-col items-center text-3xl font-bold text-brand">
        ShiftGen
        <span className="text-base font-normal text-foreground">
          ระบบจัดตารางปฏิบัติงาน
        </span>
      </h1>

      <Card className="w-full max-w-md">
        <form action={formAction}>
          <CardHeader className="mb-4">
            <CardTitle className="text-xl font-bold">เข้าสู่ระบบ</CardTitle>
          </CardHeader>
          <CardContent className="mb-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">รหัสประจำตัว</Label>
              <div className="relative">
                <HugeiconsIcon
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                  icon={UserCircleIcon}
                />
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="กรอกรหัสประจำตัว"
                  className="pl-10"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <div className="relative">
                <HugeiconsIcon
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                  icon={LockPasswordIcon}
                />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="กรอกรหัสผ่าน"
                  className="pl-10"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isPending}>
              {isPending ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
