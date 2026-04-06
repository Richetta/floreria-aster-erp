import { CashRegisterDesktop } from './CashRegisterDesktop';
import { CashRegisterMobile } from './CashRegisterMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const CashRegister = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null;
    }

    return isMobile ? <CashRegisterMobile /> : <CashRegisterDesktop />;
};
