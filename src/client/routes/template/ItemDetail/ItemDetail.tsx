import { useRouter } from '@/client/features/template/router';
import { ItemDetailPage } from './ItemDetailPage';

export function ItemDetail() {
    const { routeParams } = useRouter();
    const id = routeParams.id;

    if (!id) {
        return (
            <div className="container mx-auto max-w-4xl px-3 py-6">
                <p className="text-muted-foreground">No item ID provided.</p>
            </div>
        );
    }

    return <ItemDetailPage id={id} />;
}
