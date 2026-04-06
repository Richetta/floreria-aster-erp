import { PackagesDesktop } from './PackagesDesktop';
import { PackagesMobile } from './PackagesMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Packages = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null;
    }
    
    return isMobile ? <PackagesMobile /> : <PackagesDesktop />;
};
