import { CustomersDesktop } from './CustomersDesktop';
import { CustomersMobile } from './CustomersMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Customers = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null;
    }

    return isMobile ? <CustomersMobile /> : <CustomersDesktop />;
};
