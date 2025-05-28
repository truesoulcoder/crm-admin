'use client';

import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export function GoogleLoginButton({
  className,
  onClick,
  isLoading = false,
}: {
  className?: string;
  onClick: () => void;
  isLoading?: boolean;
}) {
  return (
    <Button
      variant="outline"
      type="button"
      className={cn('w-full', className)}
      onClick={onClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icons.google className="mr-2 h-4 w-4" />
      )}
      Continue with Google
    </Button>
  );
}
