import { useAuth } from '../contexts/AuthContext';

export function useRole() {
  const { role, activeShopId } = useAuth();

  return {
    isOwner: role === 'shop_owner',
    isStaff: role === 'shop_staff',
    role,
    activeShopId,
  };
}
