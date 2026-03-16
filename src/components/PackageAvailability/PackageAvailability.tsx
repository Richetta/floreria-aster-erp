import { CheckCircle2, XCircle } from 'lucide-react';
import './PackageAvailability.css';

interface PackageAvailabilityProps {
    isAvailable: boolean;
    missingComponents?: any[];
    compact?: boolean;
}

export const PackageAvailability = ({ 
    isAvailable, 
    missingComponents = [],
    compact = false 
}: PackageAvailabilityProps) => {
    if (compact) {
        return (
            <div className={`package-availability-compact ${isAvailable ? 'available' : 'unavailable'}`}>
                {isAvailable ? (
                    <CheckCircle2 size={16} />
                ) : (
                    <XCircle size={16} />
                )}
                <span>{isAvailable ? 'Disponible' : `Sin stock (${missingComponents.length})`}</span>
            </div>
        );
    }

    return (
        <div className={`package-availability ${isAvailable ? 'available' : 'unavailable'}`}>
            <div className="availability-header">
                {isAvailable ? (
                    <>
                        <CheckCircle2 size={24} className="text-success" />
                        <h4 className="text-success">✅ Ramo Disponible</h4>
                    </>
                ) : (
                    <>
                        <XCircle size={24} className="text-danger" />
                        <h4 className="text-danger">⚠️ Componentes Faltantes</h4>
                    </>
                )}
            </div>

            {!isAvailable && missingComponents.length > 0 && (
                <div className="missing-components">
                    <h5>Componentes con stock insuficiente:</h5>
                    <ul>
                        {missingComponents.map((component, idx) => (
                            <li key={idx}>
                                <div className="component-row">
                                    <span className="component-name">{component.productName}</span>
                                    <div className="component-stock">
                                        <span className="required">Necesita: {component.required}</span>
                                        <span className="available">Tenés: {component.available}</span>
                                        <span className="shortage">Faltan: {component.shortage}</span>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {isAvailable && (
                <p className="availability-message">
                    <CheckCircle2 size={16} />
                    Todos los componentes están en stock. ¡Se puede vender!
                </p>
            )}
        </div>
    );
};
