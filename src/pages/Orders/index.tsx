import { OrdersDesktop } from './OrdersDesktop';
import { OrdersMobile } from './OrdersMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Orders = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null;
    }

    return isMobile ? <OrdersMobile /> : <OrdersDesktop />;
};
