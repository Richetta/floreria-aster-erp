import { FinancesDesktop } from './FinancesDesktop';
import { FinancesMobile } from './FinancesMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Finances = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null;
    }

    return isMobile ? <FinancesMobile /> : <FinancesDesktop />;
};
