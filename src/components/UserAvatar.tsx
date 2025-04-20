import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/auth/AuthContext";

interface UserAvatarProps {
  size?: 'sm' | 'md' | 'lg';
}

const UserAvatar = ({ size = 'sm' }: UserAvatarProps) => {
  const { user } = useAuth();
  
  // Get user's initials for avatar fallback - simplified version without queries
  const getInitials = () => {
    if (user?.user_metadata?.full_name) {
      const nameParts = user.user_metadata.full_name.split(' ');
      if (nameParts.length > 1) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
      }
      return user.user_metadata.full_name.substring(0, 2).toUpperCase();
    } else if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-16 w-16"
  };

  return (
    <Avatar className={`border-2 border-primary/20 ${sizeClasses[size]}`}>
      <AvatarFallback className="bg-primary/10 text-primary">
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
