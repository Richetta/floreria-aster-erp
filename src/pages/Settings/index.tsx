import { SettingsDesktop } from './SettingsDesktop';
import { SettingsMobile } from './SettingsMobile';
import { useMediaQuery } from '../../hooks/useMediaQuery';

export const Settings = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    
    if (isMobile === null) {
        return null;
    }

    return isMobile ? <SettingsMobile /> : <SettingsDesktop />;
};
