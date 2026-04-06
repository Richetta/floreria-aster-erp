import { PurchasesDesktop } from './PurchasesDesktop';
import { PurchasesMobile } from './PurchasesMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Purchases = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null; // Don't render until media query is determined
    }

    return isMobile ? <PurchasesMobile /> : <PurchasesDesktop />;
};
