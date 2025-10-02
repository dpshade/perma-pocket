import { MoreVertical, Upload, Bell, Sun, Moon, Package } from 'lucide-react';
import { Button } from '@/frontend/components/ui/button';
import { Badge } from '@/frontend/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/frontend/components/ui/dropdown-menu';
import { useTheme } from '@/frontend/hooks/useTheme';

interface MobileMenuProps {
  onUploadClick: () => void;
  onExportClick: () => void;
  onNotificationsClick: () => void;
  unreadCount: number;
}

export function MobileMenu({ onUploadClick, onExportClick, onNotificationsClick, unreadCount }: MobileMenuProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="relative h-10 w-10 sm:hidden"
        >
          <MoreVertical className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={2} className="w-48">
        <DropdownMenuItem onClick={onUploadClick}>
          <Upload className="mr-2 h-4 w-4" />
          <span>Upload Files</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportClick}>
          <Package className="mr-2 h-4 w-4" />
          <span>Export Collection</span>
          <Badge variant="secondary" className="ml-auto h-4 px-1.5 text-[9px] font-medium">
            BETA
          </Badge>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onNotificationsClick} className="relative">
          <Bell className="mr-2 h-4 w-4" />
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="ml-auto h-5 w-5 flex items-center justify-center p-0 text-[10px]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleTheme}>
          {theme === 'dark' ? (
            <>
              <Sun className="mr-2 h-4 w-4" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="mr-2 h-4 w-4" />
              <span>Dark Mode</span>
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
