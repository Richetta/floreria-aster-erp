import { SuppliersDesktop } from './SuppliersDesktop';
import { SuppliersMobile } from './SuppliersMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Suppliers = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null;
    }

    return isMobile ? <SuppliersMobile /> : <SuppliersDesktop />;
};
