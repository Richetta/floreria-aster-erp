import { SalesDesktop } from './SalesDesktop';
import { SalesMobile } from './SalesMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Sales = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null;
    }

    return isMobile ? <SalesMobile /> : <SalesDesktop />;
};
