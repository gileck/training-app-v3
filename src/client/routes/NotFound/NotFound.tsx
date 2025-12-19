import { Button } from '@/client/components/ui/button';
import { Home } from 'lucide-react';
import { useRouter } from '../../router';

export const NotFound = () => {
  const { navigate } = useRouter();

  return (
    <div className="w-full text-center">
      <h1 className="text-2xl font-semibold">404 - Page Not Found</h1>
      <p className="mt-2 text-sm text-muted-foreground">The page you are looking for doesn&apos;t exist or has been moved.</p>
      <Button className="mt-4" onClick={() => navigate('/')}>
        <Home className="mr-2 h-4 w-4" /> Back to Home
      </Button>
    </div>
  );
};

export default NotFound;
