import { Card, CardContent } from '@/client/components/template/ui/card';
import { useRouter } from '@/client/features';
import { adminMenuItems } from '@/client/components/NavLinks';
import { ChevronRight, Shield } from 'lucide-react';

export function Admin() {
    const { navigate } = useRouter();

    return (
        <div className="mx-auto max-w-2xl py-4 px-2 sm:px-4 pb-20 sm:pb-6 space-y-3">
            <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-xl font-semibold">Admin</h1>
            </div>

            {adminMenuItems.length === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        No admin pages registered.
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0 divide-y divide-border">
                        {adminMenuItems.map((item) => (
                            <button
                                key={item.path}
                                type="button"
                                onClick={() => navigate(item.path)}
                                className="w-full flex items-center gap-3 px-4 py-3 min-h-11 text-left hover:bg-muted/50 transition-colors"
                            >
                                <span className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground">
                                    {item.icon}
                                </span>
                                <span className="flex-1 text-sm font-medium">{item.label}</span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </button>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
