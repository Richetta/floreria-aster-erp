import { ProductsDesktop } from './ProductsDesktop';
import { ProductsMobile } from './ProductsMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Products = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null;
    }

    return isMobile ? <ProductsMobile /> : <ProductsDesktop />;
};
